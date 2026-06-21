import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stack,
  Text,
  TextInput,
  Textarea,
  Button,
  Group,
  Paper,
  Badge,
  Code
} from '@mantine/core'
import { IconFolderOpen } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { createDeckWithWords, logEvent } from '../db/dexie'
import { parseImportText, guessDeckName } from '../utils/import'

export default function ImportView() {
  const nav = useNavigate()
  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = raw ? parseImportText(raw) : []

  const handleImport = async () => {
    if (!parsed.length) return
    setBusy(true)
    const deckName = name.trim() || guessDeckName(raw)
    await createDeckWithWords(deckName, parsed)
    await logEvent('open')
    notifications.show({
      title: '导入成功',
      message: `已导入 ${parsed.length} 个单词到「${deckName}」`,
      color: 'green'
    })
    setBusy(false)
    nav('/')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setRaw(text)
      if (!name.trim()) setName(file.name.replace(/\.(txt|csv)$/i, ''))
    }
    reader.readAsText(file)
  }

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Paper withBorder p="sm">
        <Group>
          <TextInput
            placeholder="词库名称（可选）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button
            variant="light"
            leftSection={<IconFolderOpen size={16} stroke={1.7} />}
            onClick={() => fileRef.current?.click()}
          >
            文件
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          每行一个词；支持 词 <Code>{'\t'}</Code> 释义、<Code>,</Code> 分隔
        </Text>
      </Paper>

      <Textarea
        placeholder={`粘贴单词，例如：\nabandon 放弃\nbenevolent 仁慈的\ncatastrophe\n...`}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        minRows={8}
        autosize
        styles={{ input: { fontFamily: 'monospace' } }}
      />

      {parsed.length > 0 && (
        <Paper withBorder p="sm">
          <Text size="sm" fw={500} mb="xs">
            识别到 {parsed.length} 个词
          </Text>
          <Group gap={4} mb="md">
            {parsed.slice(0, 20).map((p, i) => (
              <Badge key={i} variant="light" size="sm">
                {p.text}
                {p.meaning ? ` → ${p.meaning.slice(0, 12)}` : ''}
              </Badge>
            ))}
            {parsed.length > 20 && (
              <Text size="xs" c="dimmed">
                …还有 {parsed.length - 20} 个
              </Text>
            )}
          </Group>
          <Button
            onClick={handleImport}
            loading={busy}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
          >
            导入 {parsed.length} 个词 → 开背
          </Button>
        </Paper>
      )}
    </Stack>
  )
}
