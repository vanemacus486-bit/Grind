import type { ComponentType, ReactNode } from 'react'
import { Center, Loader, Stack, Text } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'

/** 统一的加载态：indigo 圆点 Loader 居中 */
export function LoadingState({ py = 80 }: { py?: number }) {
  return (
    <Center py={py}>
      <Loader color="indigo" type="dots" />
    </Center>
  )
}

/** 统一的空状态：图标 + 文案（+ 可选动作区） */
export function EmptyState({
  icon: Icon,
  label,
  iconColor = 'var(--mantine-color-indigo-5)',
  action,
  py = 60
}: {
  icon: ComponentType<IconProps>
  label: ReactNode
  iconColor?: string
  action?: ReactNode
  py?: number
}) {
  return (
    <Stack align="center" py={py} gap="md">
      <Icon size={48} stroke={1.5} color={iconColor} />
      <Text c="dimmed" ta="center" maw={420}>
        {label}
      </Text>
      {action}
    </Stack>
  )
}
