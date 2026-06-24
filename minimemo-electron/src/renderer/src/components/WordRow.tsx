import { memo } from 'react'
import { ActionIcon, Badge, Group, Paper, Text } from '@mantine/core'
import { IconVolume } from '@tabler/icons-react'
import type { Word, WordStatus } from '../db/types'
import { speak } from '../utils/speak'

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

/** 词库浏览的单行（只读）。memo 化：列表滚动/筛选时只重渲染变化的行。 */
function WordRowBase({ word, speakable }: { word: Word; speakable: boolean }) {
  return (
    <Paper withBorder p="xs" radius="md">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Badge
            circle
            size="xs"
            variant="filled"
            color={STATUS_COLOR[word.status]}
            title={STATUS_LABEL[word.status]}
          />
          <Text fw={600} size="sm">
            {word.text}
          </Text>
          {word.collins ? (
            <Text size="xs" c="yellow.7" style={{ flexShrink: 0 }}>
              {'★'.repeat(word.collins)}
            </Text>
          ) : null}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ minWidth: 0, flexShrink: 1 }}>
          <Text size="sm" c="dimmed" ta="right" truncate>
            {word.meaning}
          </Text>
          {speakable && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              aria-label="朗读"
              onClick={() => speak(word.text)}
            >
              <IconVolume size={18} stroke={1.7} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Paper>
  )
}

export const WordRow = memo(WordRowBase)
