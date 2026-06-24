import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import {
  MantineProvider,
  AppShell,
  Burger,
  Center,
  Loader,
  Container,
  Text,
  Stack,
  Group
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { Notifications } from '@mantine/notifications'
import { initSettings, getSettings, saveSettings } from './db/dexie'
import { ensureBuiltinVocab } from './db/seed'
import type { VocabLevel } from './db/types'
import { theme, colorSchemeManager } from './theme'
import { Brand, NavMenu } from './components/Sidebar'
import Onboarding from './components/Onboarding'
import StudyView from './components/StudyView'
import ImportView from './components/ImportView'
import ReviewView from './components/ReviewView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'
import BrowseView from './components/BrowseView'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles.css'

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

  if (showOnboarding) {
    return <Onboarding onSelect={handleSelectStarter} />
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
