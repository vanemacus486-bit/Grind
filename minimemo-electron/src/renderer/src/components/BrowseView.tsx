import { useEffect, useMemo, useState } from 'react'
import {
  Stack,
  SimpleGrid,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  SegmentedControl,
  Box
} from '@mantine/core'
import { IconPencil, IconTrash, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { getWordsByDecks, renameDeck, deleteDeck } from '../db/dexie'
import type { Word, WordStatus } from '../db/types'
import { isSpeechSupported } from '../utils/speak'
import { useDecks } from '../hooks/useDecks'
import { DeckPills } from './DeckPills'
import { WordRow } from './WordRow'
import { EmptyState, LoadingState } from './common/States'

type StatusFilter = 'all' | WordStatus

const VISIBLE_LIMIT = 300

export default function BrowseView() {
  const { decks, loading: decksLoading, reload, resolveCumulativeIds } = useDecks()
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

  // 选中项默认取第一个 deck
  useEffect(() => {
    if (selectedId === undefined && decks.length > 0) setSelectedId(decks[0].id)
  }, [decks, selectedId])

  // 载入选中 deck 的词（内置 → 累进聚合）
  useEffect(() => {
    if (decksLoading) return
    if (selectedId === undefined) {
      setWords([])
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      setWords(await getWordsByDecks(resolveCumulativeIds(selectedId)))
      setLoading(false)
      setRenaming(false)
    })()
  }, [selectedId, decksLoading, resolveCumulativeIds])

  const selectedDeck = decks.find((d) => d.id === selectedId)

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
    await reload()
    setRenaming(false)
    notifications.show({ title: '已重命名', message: renameVal.trim(), color: 'blue' })
  }

  const doDelete = async (): Promise<void> => {
    if (selectedId === undefined || !selectedDeck) return
    if (!window.confirm(`确定删除词库「${selectedDeck.name}」及其所有单词？此操作不可撤销。`))
      return
    await deleteDeck(selectedId)
    setSelectedId(undefined)
    await reload()
    notifications.show({ title: '已删除', message: selectedDeck.name, color: 'red' })
  }

  return (
    <Stack gap="sm">
      {/* deck 选择 */}
      <DeckPills decks={decks} selectedId={selectedId} onSelect={setSelectedId} />

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
        <LoadingState py={60} />
      ) : shown.length === 0 ? (
        <EmptyState icon={IconSearch} label="没有符合条件的单词。" py={60} />
      ) : (
        <Stack gap={4}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={4} verticalSpacing={4}>
            {shown.map((w) => (
              <WordRow key={w.id} word={w} speakable={speakable} />
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
