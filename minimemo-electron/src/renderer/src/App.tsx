import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
  AppShell,
  Burger,
  Center,
  Loader,
  Container,
  Title,
  Text,
  Stack,
  Group,
  Paper,
  ThemeIcon,
  rem
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { Notifications } from '@mantine/notifications'
import {
  IconBolt,
  IconBackpack,
  IconBook,
  IconBooks,
  IconWorld,
  type IconProps
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { initSettings, getSettings, saveSettings } from './db/dexie'
import { ensureBuiltinVocab } from './db/seed'
import type { VocabLevel } from './db/types'
import { BUILTIN_DECKS } from './db/types'
import { Brand, NavMenu } from './components/Sidebar'
import StudyView from './components/StudyView'
import ImportView from './components/ImportView'
import ReviewView from './components/ReviewView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'
import BrowseView from './components/BrowseView'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles.css'

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif'

const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'lg',
  fontFamily: FONT_STACK,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
  defaultGradient: { from: 'indigo', to: 'violet', deg: 135 },
  headings: {
    fontFamily: FONT_STACK,
    fontWeight: '700'
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
    sm: '0 2px 8px -2px rgba(15, 23, 42, 0.10)',
    md: '0 8px 24px -12px rgba(15, 23, 42, 0.18)',
    lg: '0 16px 40px -16px rgba(15, 23, 42, 0.22)'
  },
  components: {
    Container: { defaultProps: { px: 'md' } },
    Button: { defaultProps: { radius: 'md' } },
    Paper: { defaultProps: { radius: 'lg' } }
  }
})

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'minimemo-color-scheme'
})

/** 应用主框架：桌面为左侧固定侧栏，窗口收窄时折叠为汉堡抽屉 */
function Shell() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const nav = useNavigate()

  return (
    <AppShell
      header={{ height: 56, collapsed: !isMobile }}
      navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Brand onClick={() => nav('/')} />
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section visibleFrom="sm" mb="lg">
          <Brand onClick={() => nav('/')} />
        </AppShell.Section>
        <AppShell.Section grow>
          <NavMenu onNavigate={close} />
        </AppShell.Section>
        <AppShell.Section>
          <Text size="xs" c="dimmed" ta="center">
            把背词刷成划待办
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" px={0}>
          <Routes>
            <Route path="/import" element={<ImportView />} />
            <Route path="/review" element={<ReviewView />} />
            <Route path="/browse" element={<BrowseView />} />
            <Route path="/stats" element={<StatsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<StudyView />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

function AppContent() {
  const [ready, setReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    ;(async () => {
      try {
        await initSettings()

        // 检测/灌入内置词库
        const result = await ensureBuiltinVocab()
        if (result.imported) {
          setShowOnboarding(true)
        }
      } catch (err) {
        // 灌库失败也不应卡死启动：放行进入主界面
        console.error('[init] 启动初始化失败:', err)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const handleSelectStarter = async (level: VocabLevel) => {
    const settings = await getSettings()
    await saveSettings({ ...settings, startingDeck: level })
    setShowOnboarding(false)
    navigate('/')
  }

  if (!ready) {
    return (
      <Center mih="100vh">
        <Stack align="center" gap="sm">
          <Loader color="indigo" type="dots" />
          <Text size="sm" c="dimmed">
            正在准备词库…
          </Text>
        </Stack>
      </Center>
    )
  }

  // —— 首次启动：选起点 deck ——
  if (showOnboarding) {
    const levels: VocabLevel[] = ['gk', 'cet4', 'cet6', 'ielts']
    const descriptions: Record<VocabLevel, string> = {
      gk: '推荐 — 从高考词汇打地基',
      cet4: '已有高考基础，直接补四级',
      cet6: '四级无忧，挑战六级',
      ielts: '全量 7000+，冲刺雅思'
    }
    const icons: Record<VocabLevel, ComponentType<IconProps>> = {
      gk: IconBackpack,
      cet4: IconBook,
      cet6: IconBooks,
      ielts: IconWorld
    }
    return (
      <Container size="xs" py={rem(64)}>
        <Stack align="center" gap="lg">
          <ThemeIcon
            size={64}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
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
            {levels.map((lv) => {
              const Icon = icons[lv]
              return (
                <Paper
                  key={lv}
                  withBorder
                  p="lg"
                  className="grind-card-interactive"
                  onClick={() => handleSelectStarter(lv)}
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
                        {descriptions[lv]}
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

  return <Shell />
}

export default function App() {
  return (
    <MantineProvider
      theme={theme}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="light"
    >
      <Notifications position="top-center" />
      <HashRouter>
        <AppContent />
      </HashRouter>
    </MantineProvider>
  )
}
