export type WordStatus = 'active' | 'struck' | 'mastered'
export type EventType =
  | 'open'
  | 'strike'
  | 'unstrike'
  | 'verify_pass'
  | 'verify_fail'
export type VerifyDirection = 'word-to-meaning' | 'meaning-to-word'
export type Theme = 'light' | 'dark'
export type RecombineMode = 'auto' | 'manual'

export type VocabLevel = 'gk' | 'cet4' | 'cet6' | 'ielts'

export interface Word {
  id: number
  text: string
  meaning?: string
  reading?: string
  example?: string
  /** 英文释义（来自 ECDICT definition 字段） */
  en?: string
  /** 原始考试标签 ['gk','cet4',...] */
  tags?: string[]
  /** 归一化词频（越小越常见） */
  freq?: number
  /** 柯林斯星级 1-5 */
  collins?: number
  /** 牛津核心标志 */
  oxford?: number
  /** 词形变化 ['did','done','doing','does'] */
  forms?: string[]
  status: WordStatus
  createdAt: Date
  struckAt?: Date
  masteredAt?: Date
  /** 检测区累计答对次数 */
  correctCount?: number
  /** 检测区累计答错次数 */
  wrongCount?: number
  deckId: number
}

export interface Deck {
  id: number
  name: string
  createdAt: Date
}

export interface AppEvent {
  id: number
  ts: Date
  type: EventType
}

export interface AppSettings {
  id: number
  batchSize: number
  recombineMode: RecombineMode
  verifyDirection: VerifyDirection
  theme: Theme
  /** 已导入的内置词库版本（无则为未导入） */
  builtinVocabVersion?: number
  /** 用户起点 deck（默认 'gk'） */
  startingDeck?: VocabLevel
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  batchSize: 20,
  recombineMode: 'auto',
  verifyDirection: 'word-to-meaning',
  theme: 'light'
}

/** 内置分级词库版本号——每改动 seed 数据 +1 */
export const BUILTIN_VOCAB_VERSION = 2

/** 内置词库的 deck 命名常量 */
export const BUILTIN_DECKS: Record<VocabLevel, string> = {
  gk: '高考',
  cet4: '四级',
  cet6: '六级',
  ielts: '雅思'
}

export const BUILTIN_LEVELS: VocabLevel[] = ['gk', 'cet4', 'cet6', 'ielts']

/** Word seed 数据结构（构建期产出，运行时导入） */
export interface WordSeed {
  id: number
  word: string
  phonetic?: string
  cn: string
  en?: string
  level: VocabLevel
  tags: string[]
  freq: number
  collins?: number
  oxford?: number
  forms?: string[]
  order: number
}
