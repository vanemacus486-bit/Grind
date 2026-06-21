import { useEffect, useState } from 'react';
import { getSettings, saveSettings, db } from '../db/dexie';
import type { AppSettings, VerifyDirection, RecombineMode, Theme, VocabLevel } from '../db/types';

export default function SettingsView() {
  const [s, setS] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!s) return;
    const next = { ...s, [key]: value };
    setS(next);
    await saveSettings(next);
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value as string);
    }
  };

  const handleExport = async () => {
    const [words, decks, events] = await Promise.all([
      db.words.toArray(),
      db.decks.toArray(),
      db.events.toArray(),
    ]);
    const blob = new Blob(
      [JSON.stringify({ words, decks, events, settings: s }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimemo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.words) await db.words.clear();
      for (const w of data.words || []) {
        w.createdAt = new Date(w.createdAt);
        if (w.struckAt) w.struckAt = new Date(w.struckAt);
        if (w.masteredAt) w.masteredAt = new Date(w.masteredAt);
        await db.words.add(w);
      }
      if (data.decks) await db.decks.clear();
      for (const d of data.decks || []) {
        d.createdAt = new Date(d.createdAt);
        await db.decks.add(d);
      }
      if (data.events) await db.events.clear();
      for (const e of data.events || []) {
        e.ts = new Date(e.ts);
        await db.events.add(e);
      }
      if (data.settings) await saveSettings(data.settings);
      alert('备份已恢复！');
      window.location.reload();
    };
    input.click();
  };

  if (!s) return <div className="settings-view"><div className="empty-state"><div className="emoji">⏳</div></div></div>;

  return (
    <div className="settings-view">
      <div className="card">
        <div className="card-header">背诵设置</div>

        <div className="setting-row">
          <div>
            <div className="setting-label">每表词数</div>
            <div className="setting-desc">5–50，默认 20</div>
          </div>
          <input
            type="number"
            min={5}
            max={50}
            value={s.batchSize}
            onChange={(e) => update('batchSize', Math.min(50, Math.max(5, Number(e.target.value))))}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">重组模式</div>
            <div className="setting-desc">自动：表过半完成即重组；手动：点按钮才重组</div>
          </div>
          <select
            value={s.recombineMode}
            onChange={(e) => update('recombineMode', e.target.value as RecombineMode)}
          >
            <option value="auto">自动</option>
            <option value="manual">手动</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">检验方向</div>
            <div className="setting-desc">看词→回忆释义 / 看释义→回忆词</div>
          </div>
          <select
            value={s.verifyDirection}
            onChange={(e) => update('verifyDirection', e.target.value as VerifyDirection)}
          >
            <option value="word-to-meaning">词→义</option>
            <option value="meaning-to-word">义→词</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">深色模式</div>
          </div>
          <div
            className={`toggle ${s.theme === 'dark' ? 'on' : ''}`}
            onClick={() => update('theme', s.theme === 'dark' ? 'light' : 'dark' as Theme)}
          />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-label">起点词库</div>
            <div className="setting-desc">内置分级词库的默认入口</div>
          </div>
          <select
            value={s.startingDeck ?? 'gk'}
            onChange={(e) => update('startingDeck', e.target.value as VocabLevel)}
          >
            <option value="gk">高考</option>
            <option value="cet4">四级</option>
            <option value="cet6">六级</option>
            <option value="ielts">雅思</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">数据</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExport}>
            📤 导出备份
          </button>
          <button className="btn btn-secondary" onClick={handleImportBackup}>
            📥 导入备份
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          所有数据存储在本地浏览器。导出 JSON 以备份或迁移。
        </p>
      </div>
    </div>
  );
}
