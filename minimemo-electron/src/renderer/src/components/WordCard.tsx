import { memo } from 'react'
import { ActionIcon, Group, Paper, Text, Transition } from '@mantine/core'
import { IconCheck, IconVolume } from '@tabler/icons-react'
import type { Word } from '../db/types'
import { primaryMeaning } from '../utils/meaning'
import { speak } from '../utils/speak'

interface WordCardProps {
  word: Word
  exiting: boolean
  speakable: boolean
  onStrike: (word: Word) => void
}

/**
 * 背词卡：点一下 / 回车 / 空格 = 划掉（送检测或标记掌握）。
 * memo 化 + 稳定 onStrike，让划单张时只重渲染受影响的卡。
 */
function WordCardBase({ word, exiting, speakable, onStrike }: WordCardProps) {
  return (
    <Transition mounted={!exiting} transition="slide-left" duration={250}>
      {(styles) => (
        <Paper
          withBorder
          p="sm"
          className="grind-word-card"
          role="button"
          tabIndex={0}
          aria-label={`划掉 ${word.text}`}
          style={{
            ...styles,
            textDecoration: exiting ? 'line-through' : 'none',
            opacity: exiting ? 0.55 : 1,
            background: exiting ? 'var(--mantine-color-teal-light)' : undefined
          }}
          onClick={() => onStrike(word)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onStrike(word)
            }
          }}
        >
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
              <span className="grind-check" data-done={exiting}>
                <IconCheck size={14} stroke={3} />
              </span>
              <Text fw={600}>{word.text}</Text>
            </Group>
            <Group gap={4} wrap="nowrap" style={{ flexShrink: 1, minWidth: 0 }}>
              {word.meaning && (
                <Text size="sm" c="dimmed" ta="right" truncate>
                  {primaryMeaning(word.meaning)}
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
                  <IconVolume size={18} stroke={1.7} />
                </ActionIcon>
              )}
            </Group>
          </Group>
        </Paper>
      )}
    </Transition>
  )
}

export const WordCard = memo(WordCardBase)
