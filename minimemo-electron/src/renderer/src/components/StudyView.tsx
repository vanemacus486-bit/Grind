import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stack,
  SimpleGrid,
  Text,
  Group,
  Button,
  Progress,
  SegmentedControl,
  Box
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import {
  IconRefresh,
  IconArrowLeft,
  IconArrowRight,
  IconChecklist,
  IconConfetti,
  IconCheck
} from '@tabler/icons-react'
import {
  db,
  getActiveWords,
  getActiveWordsByDecks,
  getSettings,
  logEvent
} from '../db/dexie'
import type { Word } from '../db/types'
import { isSpeechSupported } from '../utils/speak'
import { notifications } from '@mantine/notifications'
import { useDecks } from '../hooks/useDecks'
import { DeckPills } from './DeckPills'
import { WordCard } from './WordCard'
import { BRAND_GRADIENT } from '../theme'
import { LoadingState } from './common/States'

function chunkWords(words: Word[], batchSize: number): Word[][] {
  const chunks: Word[][] = []
  for (let i = 0; i < words.length; i += batchSize) {
    chunks.push(words.slice(i, i + batchSize))
  }
  return chunks
}

export default function StudyView() {
  const nav = useNavigate()
  const { decks, loading: decksLoading, resolveCumulativeIds } = useDecks()
  const [tables, setTables] = useState<Word[][]>([])
  const [tableIndex, setTableIndex] = useState(0)
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'study' | 'screen'>('study')

  const [selectedDeckId, setSelectedDeckId] = useState<number | undefined>(undefined)
  const [initialized, setInitialized] = useState(false)
  const [deckNames, setDeckNames] = useState<string>('')

  // deck 列表就绪后，按 settings.startingDeck 选初始项（无则取第一个）
  useEffect(() => {
    if (decksLoading || initialized) return
    ;(async () => {
      const settings = await getSettings()
      let initId: number | undefined
      if (settings.startingDeck) {
        initId = decks.find((d) => d.level === settings.startingDeck)?.id
      }
      if (initId === undefined && decks.length > 0) initId = decks[0].id
      setSelectedDeckId(initId)
      setInitialized(true)
    })()
  }, [decksLoading, decks, initialized])

  /**
   * 取当前选择对应的 active 词。
   * 内置分级 deck → 累进：聚合所有 ≤ 当前等级的内置 deck（选「雅思」= 全部）。
   * 用户自建 deck → 单 deck。
   */
  const fetchActives = useCallback(async (): Promise<Word[]> => {
    if (selectedDeckId === undefined) return getActiveWords()
    const sel = decks.find((d) => d.id === selectedDeckId)
    if (sel?.level) return getActiveWordsByDecks(resolveCumulativeIds(selectedDeckId))
    return getActiveWords(selectedDeckId)
  }, [selectedDeckId, decks, resolveCumulativeIds])

  const reassemble = useCallback(async () => {
    const settings = await getSettings()
    const actives = await fetchActives()
    const ch = chunkWords(actives, settings.batchSize)
    setTables(ch)
    setTableIndex((prev) => Math.min(prev, Math.max(0, ch.length - 1)))
    setExitingIds(new Set())

    const deck = decks.find((d) => d.id === selectedDeckId)
    setDeckNames(deck ? deck.name : '全部')
  }, [fetchActives, selectedDeckId, decks])

  useEffect(() => {
    if (!initialized) return
    reassemble().then(() => setLoading(false))
  }, [reassemble, initialized])

  const handleDeckChange = (deckId: number) => {
    setSelectedDeckId(deckId)
    setLoading(true)
  }

  const undoMaster = async (id: number): Promise<void> => {
    notifications.hide(`undo-${id}`)
    await db.words.update(id, { status: 'active', masteredAt: undefined })
    await reassemble()
  }

  const strikeWord = async (word: Word) => {
    if (exitingIds.has(word.id)) return
    setExitingIds((prev) => new Set(prev).add(word.id))
    await logEvent('strike')

    setTimeout(async () => {
      if (mode === 'screen') {
        await db.words.update(word.id, {
          status: 'mastered',
          masteredAt: new Date()
        })
        notifications.show({
          id: `undo-${word.id}`,
          color: 'teal',
          title: '已标记为掌握',
          message: (
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm" truncate>
                {word.text}
              </Text>
              <Button
                size="compact-xs"
                variant="white"
                color="teal"
                onClick={() => undoMaster(word.id)}
              >
                撤销
              </Button>
            </Group>
          ),
          autoClose: 4000
        })
      } else {
        await db.words.update(word.id, {
          status: 'struck',
          struckAt: new Date()
        })
      }
      const allActive = await fetchActives()
      const settings = await getSettings()
      if (settings.recombineMode === 'auto' && allActive.length > 0) {
        const newTables = chunkWords(allActive, settings.batchSize)
        if (newTables.length < tables.length) {
          setTables(newTables)
          setTableIndex((prev) =>
            Math.min(prev, Math.max(0, newTables.length - 1))
          )
          setExitingIds(new Set())
          return
        }
      }
      setTables((prev) => {
        const updated = prev.map((tbl) => tbl.filter((w) => w.id !== word.id))
        return updated.filter((tbl) => tbl.length > 0)
      })
      setExitingIds((prev) => {
        const next = new Set(prev)
        next.delete(word.id)
        return next
      })
    }, 300)
  }

  const undoMasterMany = async (ids: number[]): Promise<void> => {
    notifications.hide('undo-page')
    await db.words
      .where('id')
      .anyOf(ids)
      .modify({ status: 'active', masteredAt: undefined })
    await reassemble()
  }

  const screenWholeTable = async (): Promise<void> => {
    const ids = (tables[tableIndex] ?? []).map((w) => w.id)
    if (ids.length === 0) return
    await db.words
      .where('id')
      .anyOf(ids)
      .modify({ status: 'mastered', masteredAt: new Date() })
    await logEvent('strike')
    await reassemble()
    notifications.show({
      id: 'undo-page',
      color: 'teal',
      title: `整页已移出 ${ids.length} 个`,
      message: (
        <Button
          size="compact-xs"
          variant="white"
          color="teal"
          onClick={() => undoMasterMany(ids)}
        >
          撤销
        </Button>
      ),
      autoClose: 6000
    })
  }

  // 稳定的划词回调：让 WordCard 的 memo 生效（划单张只重渲染受影响的卡）
  const strikeRef = useRef(strikeWord)
  strikeRef.current = strikeWord
  const onStrike = useCallback((w: Word) => strikeRef.current(w), [])

  // 键盘快捷键：← / → 翻表，r 重组剩余
  useHotkeys([
    ['ArrowLeft', () => setTableIndex((i) => Math.max(0, i - 1))],
    ['ArrowRight', () => setTableIndex((i) => Math.min(tables.length - 1, i + 1))],
    ['r', () => reassemble()]
  ])

  if (loading) {
    return <LoadingState />
  }

  const currentTable = tables[tableIndex] ?? []
  const allWords = tables.flat()
  const speakable = isSpeechSupported()
  const struckCount = exitingIds.size
  const tableTotal = currentTable.length
  const pct = tableTotal > 0 ? (struckCount / tableTotal) * 100 : 0

  if (!allWords.length) {
    return (
      <Stack gap="md">
        <DeckPills
          decks={decks}
          selectedId={selectedDeckId}
          onSelect={handleDeckChange}
          hideWhenSingle
        />
        <Stack align="center" py={60} gap="md">
          <IconConfetti size={48} stroke={1.5} color="var(--mantine-color-indigo-5)" />
          <Text c="dimmed" ta="center">
            {selectedDeckId !== undefined
              ? '选中的词库没有待背的词了。'
              : '还没有待背的词。'}
          </Text>
          <Group>
            <Button
              variant="gradient"
              gradient={BRAND_GRADIENT}
              onClick={() => nav('/import')}
            >
              导入单词
            </Button>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconRefresh size={16} stroke={1.7} />}
              onClick={reassemble}
            >
              重组
            </Button>
          </Group>
        </Stack>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <DeckPills
        decks={decks}
        selectedId={selectedDeckId}
        onSelect={handleDeckChange}
        hideWhenSingle
      />

      {/* 筛选 / 背诵 模式切换 */}
      <Stack gap={4} align="center">
        <SegmentedControl
          size="sm"
          radius="xl"
          value={mode}
          onChange={(v) => setMode(v as 'study' | 'screen')}
          data={[
            { value: 'screen', label: '筛选区' },
            { value: 'study', label: '背诵区' }
          ]}
        />
        <Text size="xs" c="dimmed" ta="center">
          {mode === 'screen'
            ? '筛选区：点一下 = 已经会了，移出学习（可撤销）'
            : '背诵区：点一下 = 记住了，送去检测区'}
        </Text>
      </Stack>

      {/* Table indicator + progress */}
      <Stack gap={6}>
        <Group justify="space-between" align="flex-end">
          <Text size="sm" c="dimmed">
            {deckNames && `${deckNames} · `}第 {tableIndex + 1}/{tables.length} 表
            · 共 {allWords.length} 词
          </Text>
          <Text size="sm" fw={600} c="indigo">
            {struckCount}/{tableTotal} {mode === 'screen' ? '已掌握' : '已划'}
          </Text>
        </Group>

        <Progress
          value={pct}
          size="md"
          radius="xl"
          color="indigo"
          striped={pct > 0}
          animated={pct > 0 && pct < 100}
        />
      </Stack>

      {mode === 'screen' && currentTable.length > 0 && (
        <Button
          variant="light"
          color="teal"
          radius="md"
          leftSection={<IconCheck size={16} stroke={2} />}
          onClick={screenWholeTable}
        >
          这一页我全会，整页移出（{currentTable.length}）
        </Button>
      )}

      {/* Word cards */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8} verticalSpacing={8}>
        {currentTable.map((word) => (
          <WordCard
            key={word.id}
            word={word}
            exiting={exitingIds.has(word.id)}
            speakable={speakable}
            onStrike={onStrike}
          />
        ))}
      </SimpleGrid>

      {/* Navigation */}
      <Group justify="center" gap="xs">
        {tableIndex > 0 && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={16} stroke={1.7} />}
            onClick={() => setTableIndex((i) => i - 1)}
          >
            上一表
          </Button>
        )}
        {tableIndex < tables.length - 1 && (
          <Button
            variant="subtle"
            color="gray"
            rightSection={<IconArrowRight size={16} stroke={1.7} />}
            onClick={() => setTableIndex((i) => i + 1)}
          >
            下一表
          </Button>
        )}
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconRefresh size={16} stroke={1.7} />}
          onClick={reassemble}
        >
          重组剩余
        </Button>
      </Group>

      {tables.length > 1 && (
        <Text size="xs" c="dimmed" ta="center">
          快捷键：← / → 翻表 · R 重组
        </Text>
      )}

      {/* Review entry */}
      <Box
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group justify="center">
          <Button
            variant="light"
            color="indigo"
            radius="xl"
            leftSection={<IconChecklist size={18} stroke={1.7} />}
            onClick={() => nav('/review')}
          >
            检测区
          </Button>
        </Group>
      </Box>
    </Stack>
  )
}
