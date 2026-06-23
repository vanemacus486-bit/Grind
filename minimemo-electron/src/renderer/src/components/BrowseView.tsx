import { useEffect, useMemo, useState } from 'react'
import {
  Stack,
  SimpleGrid,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Paper,
  SegmentedControl,
  Center,
  Loader,
  Box
} from '@mantine/core'
import {
  IconBooks,
  IconFolder,
  IconPencil,
  IconTrash,
  IconSearch,
  IconVolume
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  db,
  getWordsByDecks,
  renameDeck,
  deleteDeck
} from '../db/dexie'
import type { Word, VocabLevel, WordStatus } from '../db/types'
import { BUILTIN_DECKS, BUILTIN_LEVELS } from '../db/types'
import { speak, isSpeechSupported } from '../utils/speak'

type DeckOption = { id: number; name: string; level?: VocabLevel }
type StatusFilter = 'all' | WordStatus

const STATUS_LABEL: Record<WordStatus, string> = {
  active: '待背',
  struck: '待检测',
  mastered: '已掌握'
}
const STATUS_COLOR: Record<WordStatus, string> = {
  active: 'indigo',
  struck: 'yellow',
  mastered: 'teal'
}

const VISIBLE_LIMIT = 300

export default function BrowseView() {
  const [allDecks, setAllDecks] = useState<DeckOption[]>([])
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined)
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [minCollins, setMinCollins] = useState('0')
  const [oxfordOnly, setOxfordOnly] = useState(false)

  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')

  const speakable = isSpeechSupported()

  // 载入 deck 列表
  useEffect(() => {
    ;(async () => {
      const all = await db.decks.toArray()
      const builtin = BUILTIN_LEVELS.map((lv) => {
        const d = all.find((x) => x.name === BUILTIN_DECKS[lv])
        return d ? { id: d.id, name: d.name, level: lv } : null
      }).filter(Boolean) as DeckOption[]
      const builtinIds = new Set(builtin.map((d) => d.id))
      const user = all
        .filter((d) => !builtinIds.has(d.id))
        .map((d) => ({ id: d.id, name: d.name }))
      const opts = [...builtin, ...user]
      setAllDecks(opts)
      setSelectedId(opts[0]?.id)
    })()
  }, [])

  // 载入选中 deck 的词（内置 → 累进聚合）
  useEffect(() => {
    ;(async () => {
      if (selectedId === undefined) {
        setWords([])
        setLoading(false)
        return
      }
      setLoading(true)
      const sel = allDecks.find((d) => d.id === selectedId)
      let ids: number[]
      if (sel?.level) {
        const idx = BUILTIN_LEVELS.indexOf(sel.level)
        ids = allDecks
          .filter((d) => d.level && BUILTIN_LEVELS.indexOf(d.level) <= idx)
          .map((d) => d.id)
      } else {
        ids = [selectedId]
      }
      setWords(await getWordsByDecks(ids))
      setLoading(false)
      setRenaming(false)
    })()
  }, [selectedId, allDecks])

  const selectedDeck = allDecks.find((d) => d.id === selectedId)

  const counts = useMemo(() => {
    let a = 0,
      s = 0,
      m = 0
    for (const w of words) {
      if (w.status === 'active') a++
      else if (w.status === 'struck') s++
      else m++
    }
    return { a, s, m, total: words.length }
  }, [words])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const minC = Number(minCollins)
    return words.filter((w) => {
      if (status !== 'all' && w.status !== status) return false
      if (minC > 0 && (w.collins ?? 0) < minC) return false
      if (oxfordOnly && w.oxford !== 1) return false
      if (
        qq &&
        !(
          w.text.toLowerCase().includes(qq) ||
          (w.meaning ?? '').toLowerCase().includes(qq)
        )
      )
        return false
      return true
    })
  }, [words, q, status, minCollins, oxfordOnly])

  const shown = filtered.slice(0, VISIBLE_LIMIT)

  const doRename = async (): Promise<void> => {
    if (selectedId === undefined || !renameVal.trim()) return
    await renameDeck(selectedId, renameVal.trim())
    setAllDecks((prev) =>
      prev.map((d) => (d.id === selectedId ? { ...d, name: renameVal.trim() } : d))
    )
    setRenaming(false)
    notifications.show({ title: '已重命名', message: renameVal.trim(), color: 'blue' })
  }

  const doDelete = async (): Promise<void> => {
    if (selectedId === undefined || !selectedDeck) return
    if (!window.confirm(`确定删除词库「${selectedDeck.name}」及其所有单词？此操作不可撤销。`))
      return
    await deleteDeck(selectedId)
    const rest = allDecks.filter((d) => d.id !== selectedId)
    setAllDecks(rest)
    setSelectedId(rest[0]?.id)
    notifications.show({ title: '已删除', message: selectedDeck.name, color: 'red' })
  }

  return (
    <Stack gap="sm">
      {/* deck 选择 */}
      <Group justify="center" gap={6} wrap="wrap">
        {allDecks.map((d) => {
          const active = selectedId === d.id
          return (
            <Button
              key={d.id}
              size="xs"
              radius="xl"
              variant={active ? 'gradient' : 'default'}
              gradient={
                active ? { from: 'indigo', to: 'violet', deg: 135 } : undefined
              }
              leftSection={
                d.level ? <IconBooks size={14} stroke={1.7} /> : <IconFolder size={14} stroke={1.7} />
              }
              onClick={() => setSelectedId(d.id)}
            >
              {d.name}
            </Button>
          )
        })}
      </Group>

      {/* deck 管理（仅用户自建 deck 可改名/删除） */}
      {selectedDeck && !selectedDeck.level && (
        <Group gap="xs">
          {renaming ? (
            <>
              <TextInput
                value={renameVal}
                onChange={(e) => setRenameVal(e.currentTarget.value)}
                placeholder="新名称"
                size="xs"
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && doRename()}
                autoFocus
              />
              <Button size="xs" variant="light" onClick={doRename}>
                保存
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setRenaming(false)}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconPencil size={14} stroke={1.7} />}
                onClick={() => {
                  setRenameVal(selectedDeck.name)
                  setRenaming(true)
                }}
              >
                重命名
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconTrash size={14} stroke={1.7} />}
                onClick={doDelete}
              >
                删除词库
              </Button>
            </>
          )}
        </Group>
      )}

      {/* 搜索 */}
      <TextInput
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder="搜索单词或释义"
        leftSection={<IconSearch size={16} stroke={1.7} />}
        size="sm"
      />

      {/* 筛选 */}
      <Group justify="space-between" gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          data={[
            { value: 'all', label: '全部' },
            { value: 'active', label: '待背' },
            { value: 'struck', label: '待检测' },
            { value: 'mastered', label: '已掌握' }
          ]}
        />
        <Group gap="xs">
          <Select
            size="xs"
            w={120}
            value={minCollins}
            onChange={(v) => setMinCollins(v ?? '0')}
            allowDeselect={false}
            data={[
              { value: '0', label: '柯林斯不限' },
              { value: '5', label: '★★★★★' },
              { value: '4', label: '★★★★+' },
              { value: '3', label: '★★★+' }
            ]}
          />
          <Button
            size="xs"
            variant={oxfordOnly ? 'filled' : 'default'}
            color="indigo"
            onClick={() => setOxfordOnly((v) => !v)}
          >
            牛津核心
          </Button>
        </Group>
      </Group>

      {/* 统计 */}
      <Text size="xs" c="dimmed">
        共 {counts.total} · 待背 {counts.a} · 待检测 {counts.s} · 已掌握 {counts.m}
        {filtered.length !== counts.total && ` · 筛出 ${filtered.length}`}
      </Text>

      {/* 列表 */}
      {loading ? (
        <Center py={60}>
          <Loader color="indigo" type="dots" />
        </Center>
      ) : shown.length === 0 ? (
        <Center py={60}>
          <Text c="dimmed">没有符合条件的单词。</Text>
        </Center>
      ) : (
        <Stack gap={4}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={4} verticalSpacing={4}>
            {shown.map((w) => (
            <Paper key={w.id} withBorder p="xs" radius="md">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge
                    circle
                    size="xs"
                    variant="filled"
                    color={STATUS_COLOR[w.status]}
                    title={STATUS_LABEL[w.status]}
                  />
                  <Text fw={600} size="sm">
                    {w.text}
                  </Text>
                  {w.collins ? (
                    <Text size="xs" c="yellow.7" style={{ flexShrink: 0 }}>
                      {'★'.repeat(w.collins)}
                    </Text>
                  ) : null}
                </Group>
                <Group gap={4} wrap="nowrap" style={{ minWidth: 0, flexShrink: 1 }}>
                  <Text size="sm" c="dimmed" ta="right" truncate>
                    {w.meaning}
                  </Text>
                  {speakable && (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      radius="xl"
                      aria-label="朗读"
                      onClick={() => speak(w.text)}
                    >
                      <IconVolume size={18} stroke={1.7} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
            </Paper>
            ))}
          </SimpleGrid>
          {filtered.length > VISIBLE_LIMIT && (
            <Box ta="center" py="sm">
              <Text size="xs" c="dimmed">
                仅显示前 {VISIBLE_LIMIT} 个（共 {filtered.length}），请用搜索缩小范围。
              </Text>
            </Box>
          )}
        </Stack>
      )}
    </Stack>
  )
}
