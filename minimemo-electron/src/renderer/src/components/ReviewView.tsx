import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stack,
  Text,
  Button,
  Group,
  Paper,
  Transition,
  Badge,
  Center,
  Loader,
  ActionIcon
} from '@mantine/core'
import {
  IconVolume,
  IconBook,
  IconCheck,
  IconX,
  IconCircleCheck,
  IconArrowLeft
} from '@tabler/icons-react'
import { db, getStruckWords, getSettings, logEvent } from '../db/dexie'
import type { Word } from '../db/types'
import { speak, isSpeechSupported } from '../utils/speak'

export default function ReviewView() {
  const nav = useNavigate()
  const [words, setWords] = useState<Word[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dir, setDir] = useState<'word-to-meaning' | 'meaning-to-word'>(
    'word-to-meaning'
  )

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setDir(s.verifyDirection)
      const struck = await getStruckWords()
      setWords(struck)
      setLoading(false)
    })()
  }, [])

  const current = words[index]

  const finish = async (pass: boolean) => {
    if (!current) return
    if (pass) {
      await db.words.update(current.id, {
        status: 'mastered',
        masteredAt: new Date()
      })
      await logEvent('verify_pass')
    } else {
      await db.words.update(current.id, {
        status: 'active',
        struckAt: undefined
      })
      await logEvent('verify_fail')
    }

    const remaining = words.filter((w) => w.id !== current.id)
    if (remaining.length === 0) {
      setDone(true)
    } else {
      setWords(remaining)
      setFlipped(false)
    }
  }

  if (loading) {
    return (
      <Center py={80}>
        <Loader color="indigo" type="dots" />
      </Center>
    )
  }

  if (done || words.length === 0) {
    return (
      <Stack align="center" py={80} gap="md">
        <IconCircleCheck size={56} stroke={1.5} color="var(--mantine-color-teal-6)" />
        <Text c="dimmed" ta="center">
          检验完毕！已掌握的已存档，没通过的回去了。
        </Text>
        <Button
          variant="gradient"
          gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
          radius="xl"
          onClick={() => nav('/')}
        >
          回去继续背
        </Button>
      </Stack>
    )
  }

  const showFront = dir === 'word-to-meaning'
  const frontText = showFront ? current.text : current.meaning ?? '(无释义)'
  const backText = showFront ? current.meaning ?? '(无释义)' : current.text
  const speakable = isSpeechSupported()

  const cardBase = {
    width: '100%',
    maxWidth: 460,
    minHeight: 260,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center'
  }

  return (
    <Stack align="center" gap="lg" py="lg">
      <Badge
        size="lg"
        radius="sm"
        variant="light"
        color="indigo"
      >
        剩余 {words.length} 个 ·{' '}
        {dir === 'word-to-meaning' ? '看词回忆义' : '看义回忆词'}
      </Badge>

      <Transition mounted={!flipped} transition="fade" duration={200}>
        {(styles) =>
          !flipped ? (
            <Paper
              withBorder
              shadow="md"
              p="xl"
              className="grind-flashcard"
              style={{
                ...styles,
                ...cardBase,
                cursor: 'pointer',
                background:
                  'linear-gradient(160deg, var(--mantine-color-indigo-0), var(--mantine-color-body) 70%)'
              }}
              onClick={() => setFlipped(true)}
            >
              <Text size="xl" fw={700} ta="center" style={{ fontSize: 30 }}>
                {frontText}
              </Text>
              {speakable && showFront && (
                <ActionIcon
                  variant="light"
                  color="indigo"
                  size="lg"
                  radius="xl"
                  mt="md"
                  aria-label="朗读"
                  onClick={(e) => {
                    e.stopPropagation()
                    speak(current.text)
                  }}
                >
                  <IconVolume size={20} stroke={1.7} />
                </ActionIcon>
              )}
              <Text size="xs" c="dimmed" mt="xl">
                点击翻转
              </Text>
            </Paper>
          ) : (
            <Paper
              withBorder
              shadow="md"
              p="xl"
              className="grind-flashcard"
              style={{ ...cardBase }}
            >
              <Text size="xl" fw={700} ta="center" style={{ fontSize: 26 }}>
                {backText}
              </Text>
              {speakable && (
                <ActionIcon
                  variant="light"
                  color="indigo"
                  size="lg"
                  radius="xl"
                  mt="sm"
                  aria-label="朗读"
                  onClick={(e) => {
                    e.stopPropagation()
                    speak(current.text)
                  }}
                >
                  <IconVolume size={20} stroke={1.7} />
                </ActionIcon>
              )}
              {current.reading && (
                <Text size="sm" c="dimmed" mt="xs">
                  {current.reading}
                </Text>
              )}
              {current.forms && current.forms.length > 0 && (
                <Text size="sm" c="dimmed" mt={4} fs="italic" ta="center">
                  {current.forms.join(' · ')}
                </Text>
              )}
              {current.en && (
                <details style={{ marginTop: 8, maxWidth: '100%' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      color: 'var(--mantine-color-dimmed)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      justifyContent: 'center'
                    }}
                  >
                    <IconBook size={14} stroke={1.7} />
                    英文释义
                  </summary>
                  <Text
                    size="sm"
                    c="dimmed"
                    mt={4}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {current.en}
                  </Text>
                </details>
              )}
              {current.example && (
                <Text size="sm" c="dimmed" mt="xs" ta="center">
                  例：{current.example}
                </Text>
              )}
              <Group mt="xl" gap="sm">
                <Button
                  variant="light"
                  color="red"
                  radius="xl"
                  leftSection={<IconX size={18} stroke={2} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    finish(false)
                  }}
                >
                  不认识
                </Button>
                <Button
                  variant="filled"
                  color="teal"
                  radius="xl"
                  leftSection={<IconCheck size={18} stroke={2} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    finish(true)
                  }}
                >
                  认识
                </Button>
              </Group>
            </Paper>
          )
        }
      </Transition>

      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} stroke={1.7} />}
        onClick={() => nav('/')}
      >
        退出检验
      </Button>
    </Stack>
  )
}
