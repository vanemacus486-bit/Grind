import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Stack,
  Text,
  SimpleGrid,
  Paper,
  Group,
  Tooltip,
  Center,
  Loader,
  RingProgress,
  Progress,
  type MantineColor
} from '@mantine/core'
import {
  IconFlame,
  IconCalendarStats,
  IconPencil,
  IconBooks,
  type IconProps
} from '@tabler/icons-react'
import { db } from '../db/dexie'
import type { Word, AppEvent, Deck } from '../db/types'

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface DeckProgress {
  name: string
  total: number
  mastered: number
}

interface Stats {
  totalWords: number
  totalStruck: number
  totalMastered: number
  todayMastered: number
  totalCorrect: number
  totalWrong: number
  daysActive: number
  currentStreak: number
  hourHistogram: number[]
  eventsByDay: Record<string, number>
  masteredByDay: Record<string, number>
  decks: DeckProgress[]
}

const BUILTIN_ORDER = ['高考', '四级', '六级', '雅思']

function buildStats(words: Word[], events: AppEvent[], decks: Deck[]): Stats {
  const now = new Date()
  const today = dayKey(now)

  const totalWords = words.length
  const totalStruck = words.filter((w) => w.status === 'struck').length
  const totalMastered = words.filter((w) => w.status === 'mastered').length
  const todayMastered = words.filter(
    (w) => w.status === 'mastered' && w.masteredAt && dayKey(w.masteredAt) === today
  ).length

  const totalCorrect = words.reduce((n, w) => n + (w.correctCount ?? 0), 0)
  const totalWrong = words.reduce((n, w) => n + (w.wrongCount ?? 0), 0)

  const eventsByDay: Record<string, number> = {}
  for (const e of events) {
    const k = dayKey(e.ts)
    eventsByDay[k] = (eventsByDay[k] ?? 0) + 1
  }

  const masteredByDay: Record<string, number> = {}
  for (const w of words) {
    if (w.status === 'mastered' && w.masteredAt) {
      const k = dayKey(w.masteredAt)
      masteredByDay[k] = (masteredByDay[k] ?? 0) + 1
    }
  }

  const daysActive = Object.keys(eventsByDay).length

  let streak = 0
  const d = new Date(now)
  while (eventsByDay[dayKey(d)]) {
    streak++
    d.setDate(d.getDate() - 1)
  }

  const hourHistogram = new Array(24).fill(0)
  for (const e of events) hourHistogram[e.ts.getHours()]++

  const deckName = new Map(decks.map((dk) => [dk.id, dk.name]))
  const agg = new Map<number, DeckProgress>()
  for (const w of words) {
    let a = agg.get(w.deckId)
    if (!a) {
      a = { name: deckName.get(w.deckId) ?? '其它', total: 0, mastered: 0 }
      agg.set(w.deckId, a)
    }
    a.total++
    if (w.status === 'mastered') a.mastered++
  }
  const deckProgress = Array.from(agg.values()).sort((a, b) => {
    const ia = BUILTIN_ORDER.indexOf(a.name)
    const ib = BUILTIN_ORDER.indexOf(b.name)
    return (
      (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name)
    )
  })

  return {
    totalWords,
    totalStruck,
    totalMastered,
    todayMastered,
    totalCorrect,
    totalWrong,
    daysActive,
    currentStreak: streak,
    hourHistogram,
    eventsByDay,
    masteredByDay,
    decks: deckProgress
  }
}

function bestHour(hours: number[]): string {
  let max = 0
  let best = -1
  for (let i = 0; i < hours.length; i++) {
    if (hours[i] > max) {
      max = hours[i]
      best = i
    }
  }
  return best < 0 ? '' : `${best.toString().padStart(2, '0')}:00`
}

function heatColor(count: number): string {
  if (count > 25) return 'var(--mantine-color-indigo-8)'
  if (count > 10) return 'var(--mantine-color-indigo-6)'
  if (count > 3) return 'var(--mantine-color-indigo-4)'
  if (count > 0) return 'var(--mantine-color-indigo-2)'
  return 'var(--mantine-color-default-border)'
}

const LEGEND = [
  'var(--mantine-color-default-border)',
  'var(--mantine-color-indigo-2)',
  'var(--mantine-color-indigo-4)',
  'var(--mantine-color-indigo-6)',
  'var(--mantine-color-indigo-8)'
]

function StatTile({
  icon: Icon,
  value,
  label,
  color
}: {
  icon: ComponentType<IconProps>
  value: number
  label: string
  color: MantineColor
}) {
  return (
    <Paper
      withBorder
      p="md"
      ta="center"
      style={{
        background: `var(--mantine-color-${color}-light)`,
        borderColor: 'var(--mantine-color-default-border)'
      }}
    >
      <Icon
        size={24}
        stroke={1.7}
        color={`var(--mantine-color-${color}-light-color)`}
        style={{ display: 'block', margin: '0 auto' }}
      />
      <Text
        fw={800}
        fz={28}
        mt={6}
        style={{ lineHeight: 1.1, color: `var(--mantine-color-${color}-light-color)` }}
      >
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        {label}
      </Text>
    </Paper>
  )
}

export default function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    ;(async () => {
      const [words, events, decks] = await Promise.all([
        db.words.toArray(),
        db.events.toArray(),
        db.decks.toArray()
      ])
      setStats(buildStats(words, events, decks))
    })()
  }, [])

  if (!stats) {
    return (
      <Center py={80}>
        <Loader color="indigo" type="dots" />
      </Center>
    )
  }

  const masteredPct =
    stats.totalWords > 0 ? (stats.totalMastered / stats.totalWords) * 100 : 0
  const tested = stats.totalCorrect + stats.totalWrong
  const accuracy = tested > 0 ? Math.round((stats.totalCorrect / tested) * 100) : null
  const hour = bestHour(stats.hourHistogram)
  const maxHourCount = Math.max(...stats.hourHistogram, 1)

  // 热力图：近 18 周日历网格
  const WEEKS = 18
  const now = new Date()
  const today0 = new Date(now)
  today0.setHours(0, 0, 0, 0)
  const firstSunday = new Date(today0)
  firstSunday.setDate(today0.getDate() - today0.getDay() - (WEEKS - 1) * 7)
  const columns: { key: string; count: number; month: number; future: boolean }[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const col: { key: string; count: number; month: number; future: boolean }[] = []
    for (let r = 0; r < 7; r++) {
      const cell = new Date(firstSunday)
      cell.setDate(firstSunday.getDate() + w * 7 + r)
      const key = dayKey(cell)
      col.push({
        key,
        count: stats.eventsByDay[key] ?? 0,
        month: cell.getMonth() + 1,
        future: cell.getTime() > today0.getTime()
      })
    }
    columns.push(col)
  }

  // 掌握趋势：近 30 天每天掌握词数
  const TREND_DAYS = 30
  const trend: { key: string; count: number }[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today0)
    d.setDate(today0.getDate() - i)
    const key = dayKey(d)
    trend.push({ key, count: stats.masteredByDay[key] ?? 0 })
  }
  const maxTrend = Math.max(...trend.map((t) => t.count), 1)

  return (
    <Stack gap="md">
      {/* 关键指标 */}
      <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm">
        <StatTile icon={IconFlame} value={stats.currentStreak} label="连续天数" color="orange" />
        <StatTile icon={IconCalendarStats} value={stats.daysActive} label="累计活跃" color="indigo" />
        <StatTile icon={IconPencil} value={stats.totalStruck} label="待检测" color="grape" />
        <StatTile icon={IconBooks} value={stats.totalWords} label="总词条" color="blue" />
      </SimpleGrid>

      {/* 掌握进度 + 正确率 */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="md">
            掌握进度
          </Text>
          <Group wrap="nowrap" align="center" gap="lg">
            <RingProgress
              size={132}
              thickness={12}
              roundCaps
              sections={[{ value: masteredPct, color: 'indigo' }]}
              label={
                <Stack gap={0} align="center">
                  <Text fw={800} fz={22} style={{ lineHeight: 1.1 }}>
                    {masteredPct.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    已掌握
                  </Text>
                </Stack>
              }
            />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" c="dimmed">
                {stats.totalMastered} / {stats.totalWords} 词
              </Text>
              <Text size="sm" c="teal" fw={600}>
                今日 +{stats.todayMastered}
              </Text>
            </Stack>
          </Group>

          <Stack gap="xs" mt="md">
            {stats.decks
              .filter((d) => d.total > 0)
              .map((d) => {
                const pct = d.total > 0 ? Math.round((d.mastered / d.total) * 100) : 0
                return (
                  <div key={d.name}>
                    <Group justify="space-between" mb={2}>
                      <Text size="xs" fw={600}>
                        {d.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {d.mastered} / {d.total} · {pct}%
                      </Text>
                    </Group>
                    <Progress value={pct} color="indigo" radius="xl" size="sm" />
                  </div>
                )
              })}
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="md">
            检测正确率
          </Text>
          <Group justify="center">
            <RingProgress
              size={150}
              thickness={14}
              roundCaps
              sections={accuracy === null ? [] : [{ value: accuracy, color: 'teal' }]}
              label={
                <Text ta="center" fw={800} fz={28}>
                  {accuracy === null ? '—' : `${accuracy}%`}
                </Text>
              }
            />
          </Group>
          <Text ta="center" size="sm" c="dimmed" mt="md">
            {tested > 0
              ? `答对 ${stats.totalCorrect} · 答错 ${stats.totalWrong}`
              : '尚未检测，去检测区试试'}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* 活跃热力图 */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" fw={600}>
            活跃热力图 · 近 18 周
          </Text>
          <Group gap={4} align="center">
            <Text size="xs" c="dimmed">
              少
            </Text>
            {LEGEND.map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            ))}
            <Text size="xs" c="dimmed">
              多
            </Text>
          </Group>
        </Group>

        <Group gap={3} wrap="nowrap" mb={4} style={{ height: 14 }}>
          {columns.map((col, ci) => {
            const show = ci === 0 ? false : col[0].month !== columns[ci - 1][0].month
            return (
              <div key={ci} style={{ width: 12, position: 'relative' }}>
                {show && (
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      whiteSpace: 'nowrap',
                      fontSize: 10
                    }}
                  >
                    {col[0].month}月
                  </Text>
                )}
              </div>
            )
          })}
        </Group>

        <Group gap={3} wrap="nowrap" align="flex-start" style={{ overflowX: 'auto' }}>
          {columns.map((col, ci) => (
            <Stack key={ci} gap={3}>
              {col.map((cell) =>
                cell.future ? (
                  <div key={cell.key} style={{ width: 12, height: 12 }} />
                ) : (
                  <Tooltip key={cell.key} label={`${cell.key}: ${cell.count} 次`} withArrow>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: heatColor(cell.count)
                      }}
                    />
                  </Tooltip>
                )
              )}
            </Stack>
          ))}
        </Group>
      </Paper>

      {/* 掌握趋势 + 时间习惯 */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="sm">
            掌握趋势 · 近 30 天
          </Text>
          <Group gap={2} align="flex-end" h={80} wrap="nowrap">
            {trend.map((t) => (
              <Tooltip key={t.key} label={`${t.key.slice(5)}：掌握 ${t.count} 词`} withArrow>
                <div
                  style={{
                    flex: 1,
                    height: `${(t.count / maxTrend) * 100}%`,
                    minHeight: 2,
                    background:
                      'linear-gradient(180deg, var(--mantine-color-teal-4), var(--mantine-color-teal-6))',
                    borderRadius: '3px 3px 0 0'
                  }}
                />
              </Tooltip>
            ))}
          </Group>
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">
              {trend[0]?.key.slice(5)}
            </Text>
            <Text size="xs" c="dimmed">
              {trend[trend.length - 1]?.key.slice(5)}
            </Text>
          </Group>
        </Paper>

        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="sm">
            时间习惯{hour && ` — 你常在 ${hour} 左右背`}
          </Text>
          <Group gap={3} align="flex-end" h={80}>
            {stats.hourHistogram.map((h, i) => (
              <Tooltip key={i} label={`${i.toString().padStart(2, '0')}:00 — ${h} 次`} withArrow>
                <div
                  style={{
                    flex: 1,
                    height: `${(h / maxHourCount) * 100}%`,
                    minHeight: 2,
                    background:
                      'linear-gradient(180deg, var(--mantine-color-violet-5), var(--mantine-color-indigo-5))',
                    borderRadius: '3px 3px 0 0'
                  }}
                />
              </Tooltip>
            ))}
          </Group>
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">00:00</Text>
            <Text size="xs" c="dimmed">12:00</Text>
            <Text size="xs" c="dimmed">23:00</Text>
          </Group>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
