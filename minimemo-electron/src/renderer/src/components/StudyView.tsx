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
  Tooltip,
  ActionIcon
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import {
  IconRefresh,
  IconArrowLeft,
  IconArrowRight,
  IconChecklist,
  IconConfetti,
  IconCheck,
  IconHelp
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
import { DeckMenu } from './DeckMenu'
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
  const [deckStats, setDeckStats] = useState<{ total: number; mastered: number } | null>(null)

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

  // 当前词库的掌握度（total / mastered）——用索引计数，便宜；deck 变化或重组时刷新
  const refreshDeckStats = useCallback(async () => {
    const ids = selectedDeckId === undefined ? undefined : resolveCumulativeIds(selectedDeckId)
    let total: number
    let mastered: number
    if (ids === undefined) {
      total = await db.words.count()
      mastered = await db.words.where('status').equals('mastered').count()
    } else {
      total = await db.words.where('deckId').anyOf(ids).count()
      mastered = await db.words
        .where('deckId')
        .anyOf(ids)
        .and((w) => w.status === 'mastered')
        .count()
    }
    setDeckStats({ total, mastered })
  }, [selectedDeckId, resolveCumulativeIds])

  const reassemble = useCallback(async () => {
    const settings = await getSettings()
    const actives = await fetchActives()
    const ch = chunkWords(actives, settings.batchSize)
    setTables(ch)
    setTableIndex((prev) => Math.min(prev, Math.max(0, ch.length - 1)))
    setExitingIds(new Set())
    refreshDeckStats()
  }, [fetchActives, refreshDeckStats])

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
  const remaining = allWords.length
  const masteryPct =
    deckStats && deckStats.total > 0 ? (deckStats.mastered / deckStats.total) * 100 : 0

  if (!allWords.length) {
    return (
      <Stack gap="md">
        <DeckMenu decks={decks} selectedId={selectedDeckId} onSelect={handleDeckChange} />
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
      {/* 顶栏：词库下拉 + 模式切换 + 说明（一行收纳，省出注意力给单词）*/}
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <DeckMenu decks={decks} selectedId={selectedDeckId} onSelect={handleDeckChange} />
        <Group gap="xs" wrap="nowrap">
          <SegmentedControl
            size="xs"
            radius="xl"
            value={mode}
            onChange={(v) => setMode(v as 'study' | 'screen')}
            data={[
              { value: 'screen', label: '筛选区' },
              { value: 'study', label: '背诵区' }
            ]}
          />
          <Tooltip
            multiline
            w={260}
            withArrow
            position="bottom-end"
            label={
              <Stack gap={2}>
                <Text size="xs">筛选区：点一下 = 已经会了，移出学习（可撤销）</Text>
                <Text size="xs">背诵区：点一下 = 记住了，送去检测区（释义 hover 才显）</Text>
                <Text size="xs">快捷键：← / → 翻表 · R 重组 · 回车/空格 划词</Text>
              </Stack>
            }
          >
            <ActionIcon variant="subtle" color="gray" radius="xl" aria-label="说明">
              <IconHelp size={18} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 进度：剩余词数（随划词递减）+ 本词库掌握度 */}
      <Stack gap={6}>
        <Group justify="space-between" align="flex-end">
          <Text size="sm" c="dimmed">
            第 {tableIndex + 1}/{tables.length} 表
          </Text>
          <Text size="sm" fw={600} c="indigo">
            剩 {remaining} 词
          </Text>
        </Group>
        <Tooltip
          withArrow
          label={
            deckStats
              ? `已掌握 ${deckStats.mastered}/${deckStats.total}（${masteryPct.toFixed(1)}%）`
              : '已掌握 —'
          }
        >
          <Progress value={masteryPct} size="sm" radius="xl" color="teal" />
        </Tooltip>
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

      {/* 单词卡（主角）。背诵区释义默认隐藏，hover/聚焦才显 */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8} verticalSpacing={8}>
        {currentTable.map((word) => (
          <WordCard
            key={word.id}
            word={word}
            exiting={exitingIds.has(word.id)}
            speakable={speakable}
            peek={mode === 'study'}
            onStrike={onStrike}
          />
        ))}
      </SimpleGrid>

      {/* 一行底栏：翻页 · 重组 · 检测区 */}
      <Group justify="center" gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          disabled={tableIndex === 0}
          leftSection={<IconArrowLeft size={16} stroke={1.7} />}
          onClick={() => setTableIndex((i) => Math.max(0, i - 1))}
        >
          上一表
        </Button>
        <Text size="sm" c="dimmed">
          {tableIndex + 1}/{tables.length}
        </Text>
        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          disabled={tableIndex >= tables.length - 1}
          rightSection={<IconArrowRight size={16} stroke={1.7} />}
          onClick={() => setTableIndex((i) => Math.min(tables.length - 1, i + 1))}
        >
          下一表
        </Button>
        <Text size="sm" c="dimmed">
          ·
        </Text>
        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          leftSection={<IconRefresh size={16} stroke={1.7} />}
          onClick={reassemble}
        >
          重组
        </Button>
        <Button
          size="compact-sm"
          variant="subtle"
          color="indigo"
          leftSection={<IconChecklist size={16} stroke={1.7} />}
          onClick={() => nav('/review')}
        >
          检测区
        </Button>
      </Group>
    </Stack>
  )
}
