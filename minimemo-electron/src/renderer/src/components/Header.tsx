import { Group, Text, Button, ThemeIcon, rem } from '@mantine/core'
import { useLocation, useNavigate } from 'react-router-dom'

const TABS: {
  path: string
  label: string
  icon: string
  match: (p: string) => boolean
}[] = [
  { path: '/', label: '背', icon: '📖', match: (p) => p === '/' || p === '/review' },
  { path: '/browse', label: '词库', icon: '📚', match: (p) => p.startsWith('/browse') },
  { path: '/import', label: '导入', icon: '📥', match: (p) => p === '/import' },
  { path: '/stats', label: '统计', icon: '📊', match: (p) => p === '/stats' },
  { path: '/settings', label: '设置', icon: '⚙️', match: (p) => p === '/settings' }
]

export default function Header() {
  const loc = useLocation()
  const nav = useNavigate()

  const isActive = (t: (typeof TABS)[number]) => t.match(loc.pathname)

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      className="grind-header"
      mb="lg"
      py="xs"
    >
      <Group
        gap={8}
        wrap="nowrap"
        style={{ cursor: 'pointer' }}
        onClick={() => nav('/')}
      >
        <ThemeIcon
          size={30}
          radius="md"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
          style={{ fontSize: rem(16) }}
        >
          ⚡
        </ThemeIcon>
        <Text
          fw={800}
          size="xl"
          variant="gradient"
          gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
          style={{ letterSpacing: rem(-0.5) }}
        >
          Grind
        </Text>
      </Group>

      <Group gap={4} wrap="nowrap">
        {TABS.map((t) => {
          const active = isActive(t)
          return (
            <Button
              key={t.path}
              variant={active ? 'light' : 'subtle'}
              color={active ? 'indigo' : 'gray'}
              size="sm"
              radius="xl"
              px="sm"
              onClick={() => nav(t.path)}
            >
              <span style={{ marginRight: 4 }}>{t.icon}</span>
              {t.label}
            </Button>
          )
        })}
      </Group>
    </Group>
  )
}
