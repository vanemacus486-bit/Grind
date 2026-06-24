import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stack,
  Text,
  Button,
  Group,
  Paper,
  Badge,
  ActionIcon
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconVolume, IconCircleCheck, IconArrowLeft } from '@tabler/icons-react'
import { db, getStruckWords, getSettings, logEvent } from '../db/dexie'
import type { Word, VerifyDirection } from '../db/types'
import { speak, isSpeechSupported } from '../utils/speak'
import { primaryMeaning } from '../utils/meaning'
import { BRAND_GRADIENT } from '../theme'
import { LoadingState } from './common/States'

type Choice = { text: string; correct: boolean }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ReviewView() {
  const nav = useNavigate()
  const [words, setWords] = useState<Word[]>([])
  const [pool, setPool] = useState<string[]>([]) // 干扰项来源（去重）：词→义时为释义，义→词时为单词
  const [direction, setDirection] = useState<VerifyDirection>('word-to-meaning')
  const [index, setIndex] = useState(0)
  const [choices, setChoices] = useState<Choice[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  const current = words[index]
  const toWord = direction === 'meaning-to-word'
  const speakable = isSpeechSupported()

  // 载入待检测的词（背诵区划掉 = struck）+ 检验方向 + 干扰项池
  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      setDirection(settings.verifyDirection)
      const struck = await getStruckWords()
      setWords(struck)
      const all = await db.words.toArray()
      const items =
        settings.verifyDirection === 'meaning-to-word'
          ? all.map((w) => w.text)
          : all.map((w) => primaryMeaning(w.meaning))
      setPool(Array.from(new Set(items.filter(Boolean))))
      setLoading(false)
    })()
  }, [])

  // 当前词变化时，生成 4 个选项（1 正确 + 至多 3 干扰，打乱）
  useEffect(() => {
    if (!current) return
    const correct = toWord ? current.text : primaryMeaning(current.meaning)
    const distractors = shuffle(pool.filter((m) => m !== correct)).slice(0, 3)
    const opts: Choice[] = [
      { text: correct, correct: true },
      ...distractors.map((d) => ({ text: d, correct: false }))
    ]
    setChoices(shuffle(opts))
    setPicked(null)
  }, [current, pool, toWord])

  const answer = async (choice: Choice): Promise<void> => {
    if (!current || picked) return
    setPicked(choice.text)
    if (choice.correct) {
      await db.words.update(current.id, {
        status: 'mastered',
        masteredAt: new Date(),
        correctCount: (current.correctCount ?? 0) + 1
      })
      await logEvent('verify_pass')
    } else {
      await db.words.update(current.id, {
        status: 'active',
        struckAt: undefined,
        wrongCount: (current.wrongCount ?? 0) + 1
      })
      await logEvent('verify_fail')
    }
    // 短暂展示对错后进入下一题
    setTimeout(() => {
      const remaining = words.filter((w) => w.id !== current.id)
      if (remaining.length === 0) {
        setDone(true)
      } else {
        setWords(remaining)
        setIndex(0)
      }
    }, 900)
  }

  // 键盘快捷键：1/2/3/4 选答案
  useHotkeys([
    ['1', () => !picked && choices[0] && answer(choices[0])],
    ['2', () => !picked && choices[1] && answer(choices[1])],
    ['3', () => !picked && choices[2] && answer(choices[2])],
    ['4', () => !picked && choices[3] && answer(choices[3])]
  ])

  if (loading) {
    return <LoadingState />
  }

  if (done || words.length === 0) {
    return (
      <Stack align="center" py={80} gap="md">
        <IconCircleCheck size={56} stroke={1.5} color="var(--mantine-color-teal-6)" />
        <Text c="dimmed" ta="center">
          {done
            ? '检测完毕！答对的已掌握，答错的回去再背。'
            : '暂无待检测的词。去背诵区划掉记住的词，它们会来这里检测。'}
        </Text>
        <Button
          variant="gradient"
          gradient={BRAND_GRADIENT}
          radius="xl"
          onClick={() => nav('/')}
        >
          回去继续背
        </Button>
      </Stack>
    )
  }

  const promptText = toWord ? primaryMeaning(current.meaning) : current.text

  return (
    <Stack align="center" gap="lg" py="lg">
      <Badge size="lg" radius="sm" variant="light" color="indigo">
        剩余 {words.length} 个 · {toWord ? '选出对应单词' : '选出正确释义'}
      </Badge>

      <Paper
        withBorder
        shadow="md"
        p="xl"
        className="grind-flashcard"
        style={{
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background:
            'linear-gradient(160deg, var(--mantine-color-indigo-light), var(--mantine-color-body) 70%)'
        }}
      >
        <Group gap="xs">
          <Text fw={700} ta="center" style={{ fontSize: 30 }}>
            {promptText}
          </Text>
          {!toWord && speakable && (
            <ActionIcon
              variant="subtle"
              color="indigo"
              size="lg"
              radius="xl"
              aria-label="朗读"
              onClick={() => speak(current.text)}
            >
              <IconVolume size={20} stroke={1.7} />
            </ActionIcon>
          )}
        </Group>
        {!toWord && current.reading && (
          <Text size="sm" c="dimmed" mt={4}>
            {current.reading}
          </Text>
        )}
      </Paper>

      <Stack gap="sm" w="100%" maw={460}>
        {choices.map((c, i) => {
          let color: string | undefined
          let variant: 'light' | 'filled' | 'default' = 'default'
          if (picked) {
            if (c.correct) {
              color = 'teal'
              variant = 'filled'
            } else if (c.text === picked) {
              color = 'red'
              variant = 'light'
            }
          }
          return (
            <Button
              key={c.text}
              fullWidth
              size="md"
              radius="md"
              variant={variant}
              color={color}
              justify="flex-start"
              leftSection={
                <Text span c="dimmed" fz="xs" fw={700} w={16}>
                  {i + 1}
                </Text>
              }
              disabled={!!picked && !c.correct && c.text !== picked}
              onClick={() => answer(c)}
            >
              {c.text}
            </Button>
          )
        })}
      </Stack>

      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} stroke={1.7} />}
        onClick={() => nav('/')}
      >
        退出检测
      </Button>
    </Stack>
  )
}
