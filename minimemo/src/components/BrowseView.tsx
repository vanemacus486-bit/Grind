import { useEffect, useMemo, useState } from 'react';
import { db, getWordsByDecks, renameDeck, deleteDeck } from '../db/dexie';
import type { Word, VocabLevel } from '../db/types';
import { BUILTIN_DECKS, BUILTIN_LEVELS } from '../db/types';
import { speak, isSpeechSupported } from '../utils/speak';

type DeckOption = { id: number; name: string; level?: VocabLevel };
type StatusFilter = 'all' | 'active' | 'struck' | 'mastered';

const STATUS_LABEL: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: '待背',
  struck: '已划',
  mastered: '已掌握',
};

const VISIBLE_LIMIT = 300;

export default function BrowseView() {
  const [allDecks, setAllDecks] = useState<DeckOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [minCollins, setMinCollins] = useState(0);
  const [oxfordOnly, setOxfordOnly] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');

  const speakable = isSpeechSupported();

  // 载入 deck 列表
  useEffect(() => {
    (async () => {
      const all = await db.decks.toArray();
      const builtin = BUILTIN_LEVELS
        .map((lv) => {
          const d = all.find((x) => x.name === BUILTIN_DECKS[lv]);
          return d ? { id: d.id, name: d.name, level: lv } : null;
        })
        .filter(Boolean) as DeckOption[];
      const builtinIds = new Set(builtin.map((d) => d.id));
      const user = all.filter((d) => !builtinIds.has(d.id)).map((d) => ({ id: d.id, name: d.name }));
      const opts = [...builtin, ...user];
      setAllDecks(opts);
      setSelectedId(opts[0]?.id);
    })();
  }, []);

  // 载入选中 deck 的词（内置 → 累进聚合）
  useEffect(() => {
    (async () => {
      if (selectedId === undefined) {
        setWords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const sel = allDecks.find((d) => d.id === selectedId);
      let ids: number[];
      if (sel?.level) {
        const idx = BUILTIN_LEVELS.indexOf(sel.level);
        ids = allDecks
          .filter((d) => d.level && BUILTIN_LEVELS.indexOf(d.level) <= idx)
          .map((d) => d.id);
      } else {
        ids = [selectedId];
      }
      setWords(await getWordsByDecks(ids));
      setLoading(false);
      setRenaming(false);
    })();
  }, [selectedId, allDecks]);

  const selectedDeck = allDecks.find((d) => d.id === selectedId);

  const counts = useMemo(() => {
    let a = 0, s = 0, m = 0;
    for (const w of words) {
      if (w.status === 'active') a++;
      else if (w.status === 'struck') s++;
      else m++;
    }
    return { a, s, m, total: words.length };
  }, [words]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return words.filter((w) => {
      if (status !== 'all' && w.status !== status) return false;
      if (minCollins > 0 && (w.collins ?? 0) < minCollins) return false;
      if (oxfordOnly && w.oxford !== 1) return false;
      if (qq && !(w.text.toLowerCase().includes(qq) || (w.meaning ?? '').toLowerCase().includes(qq)))
        return false;
      return true;
    });
  }, [words, q, status, minCollins, oxfordOnly]);

  const shown = filtered.slice(0, VISIBLE_LIMIT);

  const doRename = async () => {
    if (selectedId === undefined || !renameVal.trim()) return;
    await renameDeck(selectedId, renameVal.trim());
    setAllDecks((prev) => prev.map((d) => (d.id === selectedId ? { ...d, name: renameVal.trim() } : d)));
    setRenaming(false);
  };

  const doDelete = async () => {
    if (selectedId === undefined || !selectedDeck) return;
    if (!window.confirm(`确定删除词库「${selectedDeck.name}」及其所有单词？此操作不可撤销。`)) return;
    await deleteDeck(selectedId);
    const rest = allDecks.filter((d) => d.id !== selectedId);
    setAllDecks(rest);
    setSelectedId(rest[0]?.id);
  };

  return (
    <div className="browse-view">
      {/* deck 选择 */}
      <div className="deck-selector">
        {allDecks.map((d) => (
          <button
            key={d.id}
            className={`chip ${selectedId === d.id ? 'chip-active' : ''}`}
            onClick={() => setSelectedId(d.id)}
          >
            {d.level ? `📚 ${d.name}` : `📂 ${d.name}`}
          </button>
        ))}
      </div>

      {/* deck 管理（仅用户自建 deck 可改名/删除） */}
      {selectedDeck && !selectedDeck.level && (
        <div className="deck-manage">
          {renaming ? (
            <>
              <input
                className="browse-search"
                value={renameVal}
                autoFocus
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doRename()}
                placeholder="新名称"
              />
              <button className="btn btn-secondary btn-compact" onClick={doRename}>保存</button>
              <button className="btn btn-ghost btn-compact" onClick={() => setRenaming(false)}>取消</button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ghost btn-compact"
                onClick={() => { setRenameVal(selectedDeck.name); setRenaming(true); }}
              >
                ✏️ 重命名
              </button>
              <button className="btn btn-danger btn-compact" onClick={doDelete}>🗑 删除词库</button>
            </>
          )}
        </div>
      )}

      {/* 搜索 */}
      <input
        className="browse-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 搜索单词或释义"
      />

      {/* 筛选 */}
      <div className="browse-filters">
        <div className="filter-group">
          {(['all', 'active', 'struck', 'mastered'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              className={`chip chip-sm ${status === st ? 'chip-active' : ''}`}
              onClick={() => setStatus(st)}
            >
              {st === 'all' ? '全部' : STATUS_LABEL[st]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <label className="filter-label">
            柯林斯
            <select value={minCollins} onChange={(e) => setMinCollins(Number(e.target.value))}>
              <option value={0}>不限</option>
              <option value={5}>★★★★★</option>
              <option value={4}>★★★★+</option>
              <option value={3}>★★★+</option>
            </select>
          </label>
          <button
            className={`chip chip-sm ${oxfordOnly ? 'chip-active' : ''}`}
            onClick={() => setOxfordOnly((v) => !v)}
            title="牛津核心词"
          >
            牛津核心
          </button>
        </div>
      </div>

      {/* 统计 */}
      <div className="browse-stats">
        共 {counts.total} · 待背 {counts.a} · 已划 {counts.s} · 已掌握 {counts.m}
        {filtered.length !== counts.total && <> · 筛出 {filtered.length}</>}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="empty-state"><div className="emoji">⏳</div></div>
      ) : shown.length === 0 ? (
        <div className="empty-state"><div className="hint">没有符合条件的单词。</div></div>
      ) : (
        <div className="browse-list">
          {shown.map((w) => (
            <div key={w.id} className="browse-row">
              <span className={`status-dot status-${w.status}`} title={STATUS_LABEL[w.status as keyof typeof STATUS_LABEL]} />
              <span className="browse-word">{w.text}</span>
              {w.collins ? <span className="browse-collins">{'★'.repeat(w.collins)}</span> : null}
              <span className="browse-meaning">{w.meaning}</span>
              {speakable && (
                <button
                  className="speak-btn"
                  title="朗读"
                  aria-label={`朗读 ${w.text}`}
                  onClick={() => speak(w.text)}
                >
                  🔊
                </button>
              )}
            </div>
          ))}
          {filtered.length > VISIBLE_LIMIT && (
            <div className="browse-more">
              仅显示前 {VISIBLE_LIMIT} 个（共 {filtered.length}），请用搜索缩小范围。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
