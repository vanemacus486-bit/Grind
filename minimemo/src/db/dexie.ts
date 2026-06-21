import Dexie, { type EntityTable } from 'dexie';
import { type Word, type Deck, type AppEvent, type AppSettings, DEFAULT_SETTINGS } from './types';

export class MiniMemoDB extends Dexie {
  words!: EntityTable<Word, 'id'>;
  decks!: EntityTable<Deck, 'id'>;
  events!: EntityTable<AppEvent, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('minimemo');

    // v1: 初始
    this.version(1).stores({
      words: '++id, status, deckId, createdAt',
      decks: '++id, createdAt',
      events: '++id, ts',
      settings: 'id',
    });

    // v2: 添加 [text+deckId] 复合索引（seed 导入去重用）
    this.version(2).stores({
      words: '++id, status, deckId, createdAt, [text+deckId]',
      decks: '++id, createdAt',
      events: '++id, ts',
      settings: 'id',
    });
  }
}

export const db = new MiniMemoDB();

/** Ensure singleton settings row exists */
export async function initSettings(): Promise<AppSettings> {
  const s = await db.settings.get(1);
  if (s) return s satisfies AppSettings;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

/** Create a new deck + words from imported lines */
export async function createDeckWithWords(
  name: string,
  parsed: { text: string; meaning?: string }[]
): Promise<Deck> {
  const now = new Date();
  const deckId = await db.decks.add({ name, createdAt: now });
  for (const p of parsed) {
    await db.words.add({
      text: p.text,
      meaning: p.meaning,
      status: 'active' as const,
      createdAt: now,
      deckId,
    });
  }
  const deck = await db.decks.get(deckId);
  return deck!;
}

export async function getActiveWords(deckId?: number): Promise<Word[]> {
  let coll = db.words.where('status').equals('active');
  if (deckId !== undefined) {
    coll = coll.and((w) => w.deckId === deckId);
  }
  return coll.toArray();
}

/**
 * 跨多个 deck 取 active 词（累进分级用）：选「雅思」时聚合
 * 高考/四级/六级/雅思 全部内置 deck 的词，并按词频从易到难排序。
 */
export async function getActiveWordsByDecks(deckIds: number[]): Promise<Word[]> {
  if (deckIds.length === 0) return [];
  const set = new Set(deckIds);
  const words = await db.words
    .where('status')
    .equals('active')
    .and((w) => set.has(w.deckId))
    .toArray();
  // 词频越小越常见 → 从易到难；无 freq 的排末尾
  words.sort((a, b) => (a.freq ?? 999999) - (b.freq ?? 999999));
  return words;
}

/** 取若干 deck 下的全部词（不限状态，浏览/筛选用），按词频排序 */
export async function getWordsByDecks(deckIds: number[]): Promise<Word[]> {
  if (deckIds.length === 0) return [];
  const words = await db.words.where('deckId').anyOf(deckIds).toArray();
  words.sort((a, b) => (a.freq ?? 999999) - (b.freq ?? 999999));
  return words;
}

/** 重命名 deck */
export async function renameDeck(id: number, name: string): Promise<void> {
  await db.decks.update(id, { name });
}

/** 删除 deck 及其全部单词 */
export async function deleteDeck(id: number): Promise<void> {
  await db.words.where('deckId').equals(id).delete();
  await db.decks.delete(id);
}

export async function getStruckWords(deckId?: number): Promise<Word[]> {
  let coll = db.words.where('status').equals('struck');
  if (deckId !== undefined) {
    coll = coll.and((w) => w.deckId === deckId);
  }
  return coll.toArray();
}

export async function logEvent(type: AppEvent['type']): Promise<void> {
  await db.events.add({ ts: new Date(), type });
}

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(1)) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await db.settings.put(s);
}
