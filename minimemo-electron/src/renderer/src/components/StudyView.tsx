import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stack,
  Text,
  Group,
  Button,
  Paper,
  Progress,
  Transition,
  Box,
  Center,
  Loader,
  ActionIcon
} from '@mantine/core'
import {
  db,
  getActiveWords,
  getActiveWordsByDecks,
  getSettings,
  logEvent
} from '../db/dexie'
import type { Word, VocabLevel } from '../db/types'
import { BUILTIN_DECKS, BUILTIN_LEVELS } from '../db/types'
import { speak, isSpeechSupported } from '../utils/speak'

function chunkWords(words: Word[], batchSize: number): Word[][] {
  const chunks: Word[][] = []
  for (let i = 0; i < words.length; i += batchSize) {
    chunks.push(words.slice(i, i + batchSize))
  }
  return chunks
}

export default function StudyView() {
  const nav = useNavigate()
  const [tables, setTables] = useState<Word[][]>([])
  const [tableIndex, setTableIndex] = useState(0)
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  // —— 内置 deck 切换 ——
  const [allDecks, setAllDecks] = useState<
    { id: number; name: string; level?: VocabLevel }[]
  >([])
  const [selectedDeckId, setSelectedDeckId] = useState<number | undefined>(
    undefined
  )
  const [deckNames, setDeckNames] = useState<string>('')

  // 加载内置 deck 列表
  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      let initDeckId: number | undefined

      if (settings.startingDeck) {
        const level = settings.startingDeck
        const deck = await db.decks
          .where('name')
          .equals(BUILTIN_DECKS[level])
          .first()
        if (deck) initDeckId = deck.id
      }

      const builtinDeckIds: number[] = []
      for (const level of BUILTIN_LEVELS) {
        const deck = await db.decks
          .where('name')
          .equals(BUILTIN_DECKS[level])
          .first()
        if (deck) builtinDeckIds.push(deck.id)
      }

      const all = await db.decks.toArray()
      const userDecks = all
        .filter((d) => !builtinDeckIds.includes(d.id))
        .map((d) => ({ id: d.id, name: d.name }))

      const allDeckOptions: {
        id: number
        name: string
        level?: VocabLevel
      }[] = [
        ...(BUILTIN_LEVELS
          .map((lv) => {
            const d = all.find((d) => d.name === BUILTIN_DECKS[lv])
            return d
              ? { id: d.id, name: d.name, level: lv }
              : null
          })
          .filter(Boolean) as { id: number; name: string; level: VocabLevel }[]),
        ...userDecks
      ]

      setAllDecks(allDeckOptions)

      if (initDeckId && allDeckOptions.some((d) => d.id === initDeckId)) {
        setSelectedDeckId(initDeckId)
      } else if (allDeckOptions.length > 0) {
        setSelectedDeckId(allDeckOptions[0].id)
      } else {
        setSelectedDeckId(undefined)
      }
    })()
  }, [])

  /**
   * 取当前选择对应的 active 词。
   * 内置分级 deck → 累进：聚合所有 ≤ 当前等级的内置 deck（选「雅思」= 全部）。
   * 用户自建 deck → 单 deck。
   */
  const fetchActives = useCallback(async (): Promise<Word[]> => {
    if (selectedDeckId === undefined) return getActiveWords()
    const sel = allDecks.find((d) => d.id === selectedDeckId)
    if (sel?.level) {
      const selIdx = BUILTIN_LEVELS.indexOf(sel.level)
      const cumulativeIds = allDecks
        .filter((d) => d.level && BUILTIN_LEVELS.indexOf(d.level) <= selIdx)
        .map((d) => d.id)
      return getActiveWordsByDecks(cumulativeIds)
    }
    return getActiveWords(selectedDeckId)
  }, [selectedDeckId, allDecks])

  const reassemble = useCallback(async () => {
    const settings = await getSettings()
    const actives = await fetchActives()
    const ch = chunkWords(actives, settings.batchSize)
    setTables(ch)
    setTableIndex((prev) => Math.min(prev, Math.max(0, ch.length - 1)))
    setExitingIds(new Set())

    const deck = allDecks.find((d) => d.id === selectedDeckId)
    setDeckNames(deck ? deck.name : '全部')
  }, [fetchActives, selectedDeckId, allDecks])

  useEffect(() => {
    if (allDecks.length === 0 && loading) return
    reassemble().then(() => setLoading(false))
  }, [reassemble, allDecks])

  const handleDeckChange = (deckId: number) => {
    setSelectedDeckId(deckId)
    setLoading(true)
  }

  const strikeWord = async (word: Word) => {
    if (exitingIds.has(word.id)) return
    setExitingIds((prev) => new Set(prev).add(word.id))
    await logEvent('strike')

    setTimeout(async () => {
      await db.words.update(word.id, {
        status: 'struck',
        struckAt: new Date()
      })
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

  if (loading) {
    return (
      <Center py={80}>
        <Loader color="indigo" type="dots" />
      </Center>
    )
  }

  const currentTable = tables[tableIndex] ?? []
  const allWords = tables.flat()
  const speakable = isSpeechSupported()
  const struckCount = exitingIds.size
  const tableTotal = currentTable.length
  const pct = tableTotal > 0 ? (struckCount / tableTotal) * 100 : 0

  // Deck selector (reusable)
  const renderDeckSelector = () => {
    if (allDecks.length <= 1) return null
    return (
      <Group justify="center" gap={6} wrap="wrap">
        {allDecks.map((d) => {
          const active = selectedDeckId === d.id
          return (
            <Button
              key={d.id}
              size="xs"
              radius="xl"
              variant={active ? 'gradient' : 'default'}
              gradient={
                active ? { from: 'indigo', to: 'violet', deg: 135 } : undefined
              }
              onClick={() => handleDeckChange(d.id)}
            >
              {d.level ? `📚 ${d.name}` : `📂 ${d.name}`}
            </Button>
          )
        })}
      </Group>
    )
  }

  if (!allWords.length) {
    return (
      <Stack align="center" py={60} gap="md">
        {renderDeckSelector()}
        <Text style={{ fontSize: 44 }}>🎉</Text>
        <Text c="dimmed" ta="center">
          {selectedDeckId !== undefined
            ? '选中的词库没有待背的词了。'
            : '还没有待背的词。'}
        </Text>
        <Group>
          <Button
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
            onClick={() => nav('/import')}
          >
            导入单词
          </Button>
          <Button variant="subtle" color="gray" onClick={reassemble}>
            🔄 重组
          </Button>
        </Group>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      {renderDeckSelector()}

      {/* Table indicator + progress */}
      <Stack gap={6}>
        <Group justify="space-between" align="flex-end">
          <Text size="sm" c="dimmed">
            {deckNames && `${deckNames} · `}第 {tableIndex + 1}/{tables.length} 表
            · 共 {allWords.length} 词
          </Text>
          <Text size="sm" fw={600} c="indigo">
            {struckCount}/{tableTotal} 已划
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

      {/* Word cards */}
      <Stack gap={8}>
        {currentTable.map((word) => {
          const exiting = exitingIds.has(word.id)
          return (
            <Transition
              key={word.id}
              mounted={!exiting}
              transition="slide-left"
              duration={250}
            >
              {(styles) => (
                <Paper
                  withBorder
                  p="sm"
                  className="grind-word-card"
                  style={{
                    ...styles,
                    textDecoration: exiting ? 'line-through' : 'none',
                    opacity: exiting ? 0.55 : 1,
                    background: exiting
                      ? 'var(--mantine-color-teal-0)'
                      : undefined
                  }}
                  onClick={() => strikeWord(word)}
                >
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <span className="grind-check" data-done={exiting}>
                        ✓
                      </span>
                      <Text fw={600} truncate>
                        {word.text}
                      </Text>
                    </Group>
                    <Group
                      gap={4}
                      wrap="nowrap"
                      style={{ flexShrink: 1, minWidth: 0 }}
                    >
                      {word.meaning && (
                        <Text size="sm" c="dimmed" ta="right" truncate>
                          {word.meaning}
                        </Text>
                      )}
                      {speakable && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          radius="xl"
                          aria-label="朗读"
                          onClick={(e) => {
                            e.stopPropagation()
                            speak(word.text)
                          }}
                        >
                          🔊
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                </Paper>
              )}
            </Transition>
          )
        })}
      </Stack>

      {/* Navigation */}
      <Group justify="center" gap="xs">
        {tableIndex > 0 && (
          <Button
            variant="subtle"
            color="gray"
            onClick={() => setTableIndex((i) => i - 1)}
          >
            ← 上一表
          </Button>
        )}
        {tableIndex < tables.length - 1 && (
          <Button
            variant="subtle"
            color="gray"
            onClick={() => setTableIndex((i) => i + 1)}
          >
            下一表 →
          </Button>
        )}
        <Button variant="subtle" color="gray" onClick={reassemble}>
          🔄 重组剩余
        </Button>
      </Group>

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
            onClick={() => nav('/review')}
          >
            📝 检验模式
          </Button>
        </Group>
      </Box>
    </Stack>
  )
}
