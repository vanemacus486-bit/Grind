import { useEffect, useState } from 'react'
import {
  Stack,
  Text,
  Paper,
  Group,
  Button,
  NumberInput,
  Select,
  Switch,
  Loader,
  Code
} from '@mantine/core'
import { IconDownload, IconUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { getSettings, saveSettings, db } from '../db/dexie'
import type { AppSettings, VerifyDirection, RecombineMode } from '../db/types'

export default function SettingsView() {
  const [s, setS] = useState<AppSettings | null>(null)

  useEffect(() => {
    getSettings().then(setS)
  }, [])

  const update = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    if (!s) return
    const next = { ...s, [key]: value }
    setS(next)
    await saveSettings(next)
  }

  const handleExport = async () => {
    const [words, decks, events] = await Promise.all([
      db.words.toArray(),
      db.decks.toArray(),
      db.events.toArray()
    ])
    const blob = new Blob(
      [JSON.stringify({ words, decks, events, settings: s }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grind-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notifications.show({ title: '导出成功', message: '备份已下载', color: 'blue' })
  }

  const handleImportBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.words) await db.words.clear()
      for (const w of data.words || []) {
        w.createdAt = new Date(w.createdAt)
        if (w.struckAt) w.struckAt = new Date(w.struckAt)
        if (w.masteredAt) w.masteredAt = new Date(w.masteredAt)
        await db.words.add(w)
      }
      if (data.decks) await db.decks.clear()
      for (const d of data.decks || []) {
        d.createdAt = new Date(d.createdAt)
        await db.decks.add(d)
      }
      if (data.events) await db.events.clear()
      for (const e of data.events || []) {
        e.ts = new Date(e.ts)
        await db.events.add(e)
      }
      if (data.settings) await saveSettings(data.settings)
      notifications.show({
        title: '恢复成功',
        message: '数据已恢复，请重启应用',
        color: 'green'
      })
    }
    input.click()
  }

  if (!s) {
    return (
      <Stack align="center" py={80}>
        <Loader color="indigo" type="dots" />
      </Stack>
    )
  }

  return (
    <Stack gap="md" maw={640} mx="auto" w="100%">
      <Paper withBorder p="md">
        <Text size="sm" fw={500} tt="uppercase" c="dimmed" mb="md">
          背诵设置
        </Text>

        <Group justify="space-between" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <div>
            <Text size="sm">每表词数</Text>
            <Text size="xs" c="dimmed">
              5–50，默认 20
            </Text>
          </div>
          <NumberInput
            value={s.batchSize}
            onChange={(v) => update('batchSize', Math.min(50, Math.max(5, Number(v))))}
            min={5}
            max={50}
            w={80}
            size="sm"
          />
        </Group>

        <Group justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <div>
            <Text size="sm">重组模式</Text>
            <Text size="xs" c="dimmed">
              自动：表减少即合并；手动：点按钮才重组
            </Text>
          </div>
          <Select
            value={s.recombineMode}
            onChange={(v) => update('recombineMode', (v ?? 'auto') as RecombineMode)}
            data={[
              { value: 'auto', label: '自动' },
              { value: 'manual', label: '手动' }
            ]}
            w={100}
            size="sm"
          />
        </Group>

        <Group justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <div>
            <Text size="sm">检验方向</Text>
            <Text size="xs" c="dimmed">
              看词→回忆释义 / 看释义→回忆词
            </Text>
          </div>
          <Select
            value={s.verifyDirection}
            onChange={(v) =>
              update('verifyDirection', (v ?? 'word-to-meaning') as VerifyDirection)
            }
            data={[
              { value: 'word-to-meaning', label: '词→义' },
              { value: 'meaning-to-word', label: '义→词' }
            ]}
            w={100}
            size="sm"
          />
        </Group>

        <Group justify="space-between" pt="sm">
          <div>
            <Text size="sm">深色模式</Text>
          </div>
          <Switch
            checked={s.theme === 'dark'}
            onChange={(e) =>
              update('theme', e.currentTarget.checked ? 'dark' : 'light')
            }
          />
        </Group>

        <Group justify="space-between" pt="sm">
          <div>
            <Text size="sm">起点词库</Text>
            <Text size="xs" c="dimmed">
              内置分级词库的默认入口
            </Text>
          </div>
          <Select
            value={s.startingDeck ?? 'gk'}
            onChange={(v) => v && update('startingDeck', v as any)}
            data={[
              { value: 'gk', label: '高考' },
              { value: 'cet4', label: '四级' },
              { value: 'cet6', label: '六级' },
              { value: 'ielts', label: '雅思' }
            ]}
            w={120}
            size="sm"
            allowDeselect={false}
          />
        </Group>
      </Paper>

      <Paper withBorder p="md">
        <Text size="sm" fw={500} tt="uppercase" c="dimmed" mb="md">
          数据
        </Text>
        <Group>
          <Button
            variant="light"
            leftSection={<IconDownload size={16} stroke={1.7} />}
            onClick={handleExport}
          >
            导出备份
          </Button>
          <Button
            variant="light"
            leftSection={<IconUpload size={16} stroke={1.7} />}
            onClick={handleImportBackup}
          >
            导入备份
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt="sm">
          所有数据存储在本地 IndexedDB。导出 <Code>JSON</Code> 以备份或迁移。
        </Text>
      </Paper>
    </Stack>
  )
}
