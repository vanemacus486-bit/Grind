import { Button, Group, Menu, Text } from '@mantine/core'
import { IconBooks, IconChevronDown, IconFolder } from '@tabler/icons-react'
import type { DeckOption } from '../hooks/useDecks'

function deckIcon(level?: string) {
  return level ? (
    <IconBooks size={16} stroke={1.7} />
  ) : (
    <IconFolder size={16} stroke={1.7} />
  )
}

/**
 * 紧凑词库选择器：平时只占一个「雅思 ▾」按钮，点开才列出全部。
 * 把背词页顶部从四连按钮压成一行，让注意力留给单词。
 */
export function DeckMenu({
  decks,
  selectedId,
  onSelect
}: {
  decks: DeckOption[]
  selectedId?: number
  onSelect: (id: number) => void
}) {
  if (decks.length === 0) return null
  const sel = decks.find((d) => d.id === selectedId) ?? decks[0]

  // 只有一个词库时无需下拉，直接显示名字
  if (decks.length === 1) {
    return (
      <Group gap={6} wrap="nowrap">
        {deckIcon(sel.level)}
        <Text fw={700}>{sel.name}</Text>
      </Group>
    )
  }

  return (
    <Menu shadow="md" radius="md" position="bottom-start" width={180}>
      <Menu.Target>
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={deckIcon(sel.level)}
          rightSection={<IconChevronDown size={16} stroke={1.7} />}
          styles={{ label: { fontWeight: 700, fontSize: 'var(--mantine-font-size-md)' } }}
        >
          {sel.name}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {decks.map((d) => (
          <Menu.Item
            key={d.id}
            leftSection={deckIcon(d.level)}
            onClick={() => onSelect(d.id)}
            bg={d.id === selectedId ? 'var(--mantine-color-indigo-light)' : undefined}
          >
            {d.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
