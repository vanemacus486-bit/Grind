import { useEffect, useState } from 'react'
import {
  Stack,
  Text,
  SimpleGrid,
  Paper,
  Group,
  Tooltip,
  Center,
  Loader,
  type MantineColor
} from '@mantine/core'
import {
  IconFlame,
  IconCalendarStats,
  IconPencil,
  IconStar,
  IconTrophy,
  IconBooks,
  type IconProps
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { db } from '../db/dexie'
import type { Word, AppEvent } from '../db/types'

interface Stats {
  totalStruck: number
  totalMastered: number
  totalActive: number
  todayMastered: number
  daysActive: number
  currentStreak: number
  hourHistogram: number[]
  eventsByDay: Record<string, number>
}

function buildStats(words: Word[], events: AppEvent[]): Stats {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const totalStruck = words.filter((w) => w.status === 'struck').length
  const totalMastered = words.filter((w) => w.status === 'mastered').length
  const totalActive = words.filter((w) => w.status === 'active').length
  const todayMastered = words.filter(
    (w) =>
      w.status === 'mastered' &&
      w.masteredAt?.toISOString().slice(0, 10) === today
  ).length

  const eventsByDay: Record<string, number> = {}
  for (const e of events) {
    const day = e.ts.toISOString().slice(0, 10)
    eventsByDay[day] = (eventsByDay[day] ?? 0) + 1
  }

  const activeDays = Object.keys(eventsByDay).length

  let streak = 0
  const d = new Date(now)
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if (eventsByDay[key]) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  const hourHistogram = new Array(24).fill(0)
  for (const e of events) {
    const h = e.ts.getHours()
    hourHistogram[h]++
  }

  return {
    totalStruck,
    totalMastered,
    totalActive,
    todayMastered,
    daysActive: activeDays,
    currentStreak: streak,
    hourHistogram,
    eventsByDay
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
  if (best < 0) return ''
  return `${best.toString().padStart(2, '0')}:00`
}

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
        background: `var(--mantine-color-${color}-0)`,
        borderColor: `var(--mantine-color-${color}-2)`
      }}
    >
      <Icon
        size={24}
        stroke={1.7}
        color={`var(--mantine-color-${color}-6)`}
        style={{ display: 'block', margin: '0 auto' }}
      />
      <Text fw={800} fz={28} c={`${color}.7`} mt={6} style={{ lineHeight: 1.1 }}>
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
      const [words, events] = await Promise.all([
        db.words.toArray(),
        db.events.toArray()
      ])
      setStats(buildStats(words, events))
    })()
  }, [])

  if (!stats) {
    return (
      <Center py={80}>
        <Loader color="indigo" type="dots" />
      </Center>
    )
  }

  const total = stats.totalActive + stats.totalStruck + stats.totalMastered
  const hour = bestHour(stats.hourHistogram)
  const maxHourCount = Math.max(...stats.hourHistogram, 1)

  const tiles: {
    icon: ComponentType<IconProps>
    value: number
    label: string
    color: MantineColor
  }[] = [
    { icon: IconFlame, value: stats.currentStreak, label: '连续天数', color: 'orange' },
    { icon: IconCalendarStats, value: stats.daysActive, label: '累计活跃', color: 'indigo' },
    {
      icon: IconPencil,
      value: stats.totalStruck + stats.totalMastered,
      label: '累计划掉',
      color: 'grape'
    },
    { icon: IconStar, value: stats.todayMastered, label: '今日掌握', color: 'yellow' },
    { icon: IconTrophy, value: stats.totalMastered, label: '累计掌握', color: 'teal' },
    { icon: IconBooks, value: total, label: '总词条', color: 'blue' }
  ]

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, xs: 3, md: 6 }} spacing="sm">
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </SimpleGrid>

      {/* Heatmap */}
      <Paper withBorder p="md">
        <Text size="sm" fw={600} mb="sm">
          活跃热力图
        </Text>
        <Group gap={3}>
          {(() => {
            const cells: React.ReactNode[] = []
            const now = new Date()
            for (let i = 83; i >= 0; i--) {
              const d = new Date(now)
              d.setDate(d.getDate() - i)
              const key = d.toISOString().slice(0, 10)
              const count = stats.eventsByDay[key] ?? 0
              let bg = 'var(--mantine-color-gray-2)'
              if (count > 0) bg = 'var(--mantine-color-indigo-2)'
              if (count > 3) bg = 'var(--mantine-color-indigo-4)'
              if (count > 10) bg = 'var(--mantine-color-indigo-6)'
              if (count > 25) bg = 'var(--mantine-color-indigo-8)'
              cells.push(
                <Tooltip key={key} label={`${key}: ${count} 次`} withArrow>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: bg
                    }}
                  />
                </Tooltip>
              )
            }
            return cells
          })()}
        </Group>
      </Paper>

      {/* Hour histogram */}
      {stats.hourHistogram.some((h) => h > 0) && (
        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="sm">
            时间习惯{hour && ` — 你常在 ${hour} 左右背`}
          </Text>
          <Group gap={3} align="flex-end" h={60}>
            {stats.hourHistogram.map((h, i) => (
              <Tooltip
                key={i}
                label={`${i.toString().padStart(2, '0')}:00 — ${h} 次`}
                withArrow
              >
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
            <Text size="xs" c="dimmed">
              00:00
            </Text>
            <Text size="xs" c="dimmed">
              12:00
            </Text>
            <Text size="xs" c="dimmed">
              23:00
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  )
}
