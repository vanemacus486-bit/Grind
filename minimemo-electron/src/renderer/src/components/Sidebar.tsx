import { Group, Text, ThemeIcon, NavLink, Stack, rem } from '@mantine/core'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  IconBolt,
  IconBook2,
  IconBooks,
  IconFileImport,
  IconChartBar,
  IconSettings,
  type IconProps
} from '@tabler/icons-react'
import type { ComponentType } from 'react'

const NAV_ITEMS: {
  path: string
  label: string
  icon: ComponentType<IconProps>
  match: (p: string) => boolean
}[] = [
  { path: '/', label: '背单词', icon: IconBook2, match: (p) => p === '/' || p === '/review' },
  { path: '/browse', label: '词库', icon: IconBooks, match: (p) => p.startsWith('/browse') },
  { path: '/import', label: '导入', icon: IconFileImport, match: (p) => p === '/import' },
  { path: '/stats', label: '统计', icon: IconChartBar, match: (p) => p === '/stats' },
  { path: '/settings', label: '设置', icon: IconSettings, match: (p) => p === '/settings' }
]

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Group
      gap={10}
      wrap="nowrap"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <ThemeIcon
        size={34}
        radius="md"
        variant="gradient"
        gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
      >
        <IconBolt size={20} stroke={2} />
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
  )
}

/** 侧边垂直导航（桌面侧栏 / 移动抽屉共用） */
export function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation()
  const nav = useNavigate()

  return (
    <Stack gap={4}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = item.match(loc.pathname)
        return (
          <NavLink
            key={item.path}
            active={active}
            label={item.label}
            variant="light"
            color="indigo"
            leftSection={<Icon size={20} stroke={1.7} />}
            onClick={() => {
              nav(item.path)
              onNavigate?.()
            }}
            styles={{ root: { borderRadius: 'var(--mantine-radius-md)' }, label: { fontWeight: 600 } }}
          />
        )
      })}
    </Stack>
  )
}
