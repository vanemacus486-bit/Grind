import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getActiveWords, getActiveWordsByDecks, getSettings, logEvent } from '../db/dexie';
import type { Word, VocabLevel } from '../db/types';
import { BUILTIN_DECKS, BUILTIN_LEVELS } from '../db/types';
import { speak, isSpeechSupported } from '../utils/speak';

function chunkWords(words: Word[], batchSize: number): Word[][] {
  const chunks: Word[][] = [];
  for (let i = 0; i < words.length; i += batchSize) {
    chunks.push(words.slice(i, i + batchSize));
  }
  return chunks;
}

type DeckOption = { id: number; name: string; level?: VocabLevel };

export default function StudyView() {
  const nav = useNavigate();
  const [tables, setTables] = useState<Word[][]>([]);
  const [tableIndex, setTableIndex] = useState(0);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());
  const [hasActive, setHasActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // —— 内置 deck 切换 ——
  const [allDecks, setAllDecks] = useState<DeckOption[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | undefined>(undefined);
  const [deckNames, setDeckNames] = useState<string>('');

  // 加载内置 deck 列表
  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      let initDeckId: number | undefined;

      if (settings.startingDeck) {
        const level = settings.startingDeck;
        const deck = await db.decks.where('name').equals(BUILTIN_DECKS[level]).first();
        if (deck) initDeckId = deck.id;
      }

      const all = await db.decks.toArray();
      const builtinByLevel = BUILTIN_LEVELS
        .map((lv) => {
          const d = all.find((dk) => dk.name === BUILTIN_DECKS[lv]);
          return d ? { id: d.id, name: d.name, level: lv } : null;
        })
        .filter(Boolean) as DeckOption[];
      const builtinIds = new Set(builtinByLevel.map((d) => d.id));
      const userDecks: DeckOption[] = all
        .filter((d) => !builtinIds.has(d.id))
        .map((d) => ({ id: d.id, name: d.name }));

      const allDeckOptions = [...builtinByLevel, ...userDecks];
      setAllDecks(allDeckOptions);

      if (initDeckId && allDeckOptions.some((d) => d.id === initDeckId)) {
        setSelectedDeckId(initDeckId);
      } else if (allDeckOptions.length > 0) {
        setSelectedDeckId(allDeckOptions[0].id);
      } else {
        setSelectedDeckId(undefined);
      }
    })();
  }, []);

  /**
   * 取当前选择对应的 active 词。
   * 内置分级 deck → 累进：聚合所有 ≤ 当前等级的内置 deck（选「雅思」= 全部）。
   * 用户自建 deck → 单 deck。
   */
  const fetchActives = useCallback(async (): Promise<Word[]> => {
    if (selectedDeckId === undefined) return getActiveWords();
    const sel = allDecks.find((d) => d.id === selectedDeckId);
    if (sel?.level) {
      const selIdx = BUILTIN_LEVELS.indexOf(sel.level);
      const cumulativeIds = allDecks
        .filter((d) => d.level && BUILTIN_LEVELS.indexOf(d.level) <= selIdx)
        .map((d) => d.id);
      return getActiveWordsByDecks(cumulativeIds);
    }
    return getActiveWords(selectedDeckId);
  }, [selectedDeckId, allDecks]);

  const reassemble = useCallback(async () => {
    const settings = await getSettings();
    const actives = await fetchActives();
    setHasActive(actives.length > 0);
    const ch = chunkWords(actives, settings.batchSize);
    setTables(ch);
    setTableIndex((prev) => Math.min(prev, Math.max(0, ch.length - 1)));
    setExitingIds(new Set());

    const deck = allDecks.find((d) => d.id === selectedDeckId);
    setDeckNames(deck ? deck.name : '全部');
    setLoading(false);
  }, [fetchActives, selectedDeckId, allDecks]);

  useEffect(() => {
    if (allDecks.length === 0) return;
    void (async () => {
      await reassemble();
    })();
  }, [reassemble, allDecks]);

  const handleDeckChange = (deckId: number) => {
    setSelectedDeckId(deckId);
    setLoading(true);
  };

  const strikeWord = async (word: Word) => {
    if (exitingIds.has(word.id)) return;

    setExitingIds((prev) => new Set(prev).add(word.id));
    await logEvent('strike');

    setTimeout(async () => {
      await db.words.update(word.id, { status: 'struck', struckAt: new Date() });
      const allActive = await fetchActives();
      setHasActive(allActive.length > 0);

      const settings = await getSettings();
      if (settings.recombineMode === 'auto' && allActive.length > 0) {
        const newTables = chunkWords(allActive, settings.batchSize);
        if (newTables.length < tables.length) {
          setTables(newTables);
          setTableIndex((prev) => Math.min(prev, Math.max(0, newTables.length - 1)));
          setExitingIds(new Set());
          return;
        }
      }

      setTables((prev) => {
        const updated = prev.map((tbl) => tbl.filter((w) => w.id !== word.id));
        return updated.filter((tbl) => tbl.length > 0);
      });
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }, 300);
  };

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    speak(text);
  };

  const renderDeckSelector = () => {
    if (allDecks.length === 0) return null;
    return (
      <div className="deck-selector">
        {allDecks.map((d) => (
          <button
            key={d.id}
            className={`chip ${selectedDeckId === d.id ? 'chip-active' : ''}`}
            onClick={() => handleDeckChange(d.id)}
          >
            {d.level ? `📚 ${d.name}` : `📂 ${d.name}`}
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="empty-state"><div className="emoji">⏳</div></div>;
  }

  if (!hasActive) {
    return (
      <div className="study-view">
        {renderDeckSelector()}
        <div className="empty-state">
          <div className="emoji">🎉</div>
          <div className="hint">选中的词库没有待背的词了。</div>
          <button className="btn btn-primary" onClick={() => nav('/import')}>
            导入更多单词
          </button>
          <button className="btn btn-ghost" onClick={reassemble} style={{ marginTop: 8 }}>
            🔄 重组
          </button>
        </div>
      </div>
    );
  }

  const currentTable = tables[tableIndex] ?? [];
  const allWords = tables.flat();
  const speakable = isSpeechSupported();

  return (
    <div className="study-view">
      {renderDeckSelector()}

      {/* Table indicator */}
      <div className="table-label">
        {deckNames} · 第 {tableIndex + 1} / {tables.length} 表 · 共 {allWords.length} 词
      </div>

      {/* Word list */}
      <div className="word-list">
        {currentTable.map((word) => (
          <div
            key={word.id}
            className={`word-card ${exitingIds.has(word.id) ? 'exiting' : ''}`}
            onClick={() => strikeWord(word)}
          >
            <span className="word-text">{word.text}</span>
            {word.meaning && <span className="word-meaning">{word.meaning}</span>}
            {speakable && (
              <button
                className="speak-btn"
                title="朗读"
                aria-label={`朗读 ${word.text}`}
                onClick={(e) => handleSpeak(e, word.text)}
              >
                🔊
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="study-actions">
        {tableIndex > 0 && (
          <button className="btn btn-ghost" onClick={() => setTableIndex((i) => i - 1)}>
            ← 上一表
          </button>
        )}
        {tableIndex < tables.length - 1 && (
          <button className="btn btn-ghost" onClick={() => setTableIndex((i) => i + 1)}>
            下一表 →
          </button>
        )}
        <button className="btn btn-ghost" onClick={reassemble}>
          🔄 重组剩余
        </button>
      </div>

      {/* Bottom bar for review entry */}
      <div className="study-bottom-bar">
        <button className="btn btn-secondary" onClick={() => nav('/review')}>
          📝 检验模式
        </button>
      </div>
    </div>
  );
}
