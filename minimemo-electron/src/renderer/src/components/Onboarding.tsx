import type { ComponentType } from 'react'
import {
  Container,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem
} from '@mantine/core'
import {
  IconBackpack,
  IconBolt,
  IconBook,
  IconBooks,
  IconWorld,
  type IconProps
} from '@tabler/icons-react'
import type { VocabLevel } from '../db/types'
import { BUILTIN_DECKS } from '../db/types'
import { BRAND_GRADIENT } from '../theme'

const LEVELS: VocabLevel[] = ['gk', 'cet4', 'cet6', 'ielts']

const DESCRIPTIONS: Record<VocabLevel, string> = {
  gk: '推荐 — 从高考词汇打地基',
  cet4: '已有高考基础，直接补四级',
  cet6: '四级无忧，挑战六级',
  ielts: '全量 7000+，冲刺雅思'
}

const ICONS: Record<VocabLevel, ComponentType<IconProps>> = {
  gk: IconBackpack,
  cet4: IconBook,
  cet6: IconBooks,
  ielts: IconWorld
}

/** 首次启动引导：选一个起点分级 deck 开刷 */
export default function Onboarding({
  onSelect
}: {
  onSelect: (level: VocabLevel) => void
}) {
  return (
    <Container size="xs" py={rem(64)}>
      <Stack align="center" gap="lg">
        <ThemeIcon
          size={64}
          radius="xl"
          variant="gradient"
          gradient={BRAND_GRADIENT}
          style={{ boxShadow: 'var(--mantine-shadow-md)' }}
        >
          <IconBolt size={32} stroke={2} />
        </ThemeIcon>
        <Stack align="center" gap={4}>
          <Title order={2}>欢迎来到 Grind</Title>
          <Text c="dimmed" ta="center" maw={320}>
            内置了从高考到雅思的分级词库，先挑一个起点开刷吧
          </Text>
        </Stack>

        <Stack gap="sm" w="100%" maw={360}>
          {LEVELS.map((lv) => {
            const Icon = ICONS[lv]
            return (
              <Paper
                key={lv}
                withBorder
                p="lg"
                className="grind-card-interactive"
                onClick={() => onSelect(lv)}
              >
                <Group wrap="nowrap" gap="md">
                  <ThemeIcon size={40} radius="md" variant="light" color="indigo">
                    <Icon size={22} stroke={1.7} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="lg">
                      {BUILTIN_DECKS[lv]}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {DESCRIPTIONS[lv]}
                    </Text>
                  </div>
                </Group>
              </Paper>
            )
          })}
        </Stack>

        <Text size="xs" c="dimmed">
          之后可在设置中随时切换
        </Text>
      </Stack>
    </Container>
  )
}
