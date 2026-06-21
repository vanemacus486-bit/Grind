/**
 * db/seed.ts — 内置分级词库首次启动灌库逻辑（Electron 版）
 *
 * 流程：
 *   1. 检测 settings.builtinVocabVersion
 *   2. 未灌或版本落后 → 获取 seed JSON → 创建 4 个内置 deck → 逐词插入
 *   3. 幂等：已灌不重复灌；版本升级做增量追加
 */

import { db } from './dexie'
import {
  BUILTIN_VOCAB_VERSION,
  BUILTIN_DECKS,
  BUILTIN_LEVELS,
  type Word,
  type WordSeed
} from './types'

// 用相对路径：打包后渲染进程以 file:// 加载，绝对路径 '/xxx' 会指向文件系统根目录而 fetch 失败
const SEED_URL = './builtin-vocab.json'

/**
 * 获取内置词库 seed 数据
 */
async function fetchSeed(): Promise<WordSeed[]> {
  const res = await fetch(SEED_URL)
  if (!res.ok) throw new Error(`Failed to fetch seed: ${res.status}`)
  return res.json()
}

/**
 * 获取或创建内置 deck，返回 deckId
 * 确保 4 个内置 deck 存在且命名正确
 */
async function ensureBuiltinDecks(): Promise<Record<string, number>> {
  const result: Record<string, number> = {}

  for (const level of BUILTIN_LEVELS) {
    const name = BUILTIN_DECKS[level]
    // 查找已有同名 deck
    const deck = await db.decks.where('name').equals(name).first()
    if (deck) {
      result[level] = deck.id
    } else {
      const id = await db.decks.add({ name, createdAt: new Date() })
      result[level] = id
    }
  }

  return result
}

/**
 * 灌入库核心：将 seed 数据写入 Dexie
 * - 已存在的词（按 text + deckId 匹配）跳过
 * - 返回新插入的词数
 *
 * 性能：预取各 deck 已有词构建去重集合，再用 bulkAdd 单事务批量写入，
 * 避免逐词「查询 + 插入」产生上万次独立事务（8000+ 词首启会卡几十秒）。
 */
async function importSeed(
  seed: WordSeed[],
  deckMap: Record<string, number>
): Promise<number> {
  // 预取每个内置 deck 已存在的「word::deckId」键，做去重（首启时为空集）
  const seen = new Set<string>()
  for (const deckId of Object.values(deckMap)) {
    const existing = await db.words.where('deckId').equals(deckId).toArray()
    for (const w of existing) seen.add(`${w.text}::${deckId}`)
  }

  const now = new Date()
  const toAdd: Omit<Word, 'id'>[] = []

  for (const entry of seed) {
    const deckId = deckMap[entry.level]
    if (deckId === undefined) continue

    const key = `${entry.word}::${deckId}`
    if (seen.has(key)) continue
    seen.add(key)

    toAdd.push({
      text: entry.word,
      meaning: entry.cn,
      reading: entry.phonetic,
      en: entry.en,
      tags: entry.tags,
      freq: entry.freq,
      collins: entry.collins,
      oxford: entry.oxford,
      forms: entry.forms,
      status: 'active',
      createdAt: now,
      deckId
    })
  }

  if (toAdd.length > 0) {
    // 单次批量写入（Dexie 内部单事务），比逐条 add 快两个数量级
    await db.words.bulkAdd(toAdd as Word[])
  }

  return toAdd.length
}

/**
 * 升级清洗：删除内置 deck 中已不在新词库里的词
 * （去掉旧版本里的专有名词等噪音），保留仍存在词的背诵进度。
 * 返回删除数。
 */
async function pruneStaleBuiltinWords(
  seed: WordSeed[],
  deckMap: Record<string, number>
): Promise<number> {
  const valid = new Set(seed.map((s) => s.word))
  const builtinDeckIds = Object.values(deckMap)
  if (builtinDeckIds.length === 0) return 0

  const toDelete: number[] = []
  await db.words
    .where('deckId')
    .anyOf(builtinDeckIds)
    .each((w) => {
      if (!valid.has(w.text)) toDelete.push(w.id)
    })
  if (toDelete.length > 0) await db.words.bulkDelete(toDelete)
  return toDelete.length
}

/**
 * 检测并执行灌库（幂等）
 *
 * 返回值：
 *   { imported: boolean, count: number }
 *   - imported: true=本次执行了灌入
 *   - count: 灌入的词数（增量灌入时为新增数）
 */
export async function ensureBuiltinVocab(): Promise<{
  imported: boolean
  count: number
}> {
  const settings = await db.settings.get(1)
  const currentVersion = settings?.builtinVocabVersion ?? 0

  if (currentVersion >= BUILTIN_VOCAB_VERSION) {
    // 已是最新版本，无需灌入
    return { imported: false, count: 0 }
  }

  // 获取 seed
  const seed = await fetchSeed()

  // 确保内置 deck 存在
  const deckMap = await ensureBuiltinDecks()

  // 已灌过旧版本 → 先剔除新库里没有的旧词（清洗噪音），保留进度
  if (currentVersion > 0) {
    const removed = await pruneStaleBuiltinWords(seed, deckMap)
    if (removed > 0) console.log(`[seed] 清洗旧词库噪音: 删除 ${removed} 词`)
  }

  // 灌入
  const count = await importSeed(seed, deckMap)

  // 记录版本
  const newSettings = {
    ...(settings ?? {
      id: 1,
      batchSize: 20,
      recombineMode: 'auto' as const,
      verifyDirection: 'word-to-meaning' as const,
      theme: 'light' as const
    }),
    builtinVocabVersion: BUILTIN_VOCAB_VERSION
  }
  await db.settings.put(newSettings)

  console.log(`[seed] 内置词库 v${BUILTIN_VOCAB_VERSION} 灌入完成: ${count} 词`)
  return { imported: true, count }
}
