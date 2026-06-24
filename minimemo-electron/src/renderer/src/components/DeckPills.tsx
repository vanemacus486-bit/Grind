import { Button, Group } from '@mantine/core'
import { IconBooks, IconFolder } from '@tabler/icons-react'
import type { DeckOption } from '../hooks/useDecks'
import { BRAND_GRADIENT } from '../theme'

/**
 * deck 选择器（胶囊按钮行）。内置分级用 IconBooks、用户自建用 IconFolder。
 * 背词区与词库浏览共用。当 hideWhenSingle 且只有 ≤1 个 deck 时不渲染。
 */
export function DeckPills({
  decks,
  selectedId,
  onSelect,
  hideWhenSingle = false
}: {
  decks: DeckOption[]
  selectedId?: number
  onSelect: (id: number) => void
  hideWhenSingle?: boolean
}) {
  if (decks.length === 0 || (hideWhenSingle && decks.length <= 1)) return null

  return (
    <Group justify="center" gap={6} wrap="wrap">
      {decks.map((d) => {
        const active = selectedId === d.id
        return (
          <Button
            key={d.id}
            size="xs"
            radius="xl"
            variant={active ? 'gradient' : 'default'}
            gradient={active ? BRAND_GRADIENT : undefined}
            leftSection={
              d.level ? (
                <IconBooks size={14} stroke={1.7} />
              ) : (
                <IconFolder size={14} stroke={1.7} />
              )
            }
            onClick={() => onSelect(d.id)}
          >
            {d.name}
          </Button>
        )
      })}
    </Group>
  )
}
