import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDeckWithWords, logEvent } from '../db/dexie';
import { parseImportText, guessDeckName } from '../utils/import';

export default function ImportView() {
  const nav = useNavigate();
  const [raw, setRaw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = raw ? parseImportText(raw) : [];

  const handleImport = async () => {
    if (!parsed.length) return;
    setBusy(true);
    const deckName = name.trim() || guessDeckName(raw);
    await createDeckWithWords(deckName, parsed);
    await logEvent('open');
    setBusy(false);
    nav('/');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRaw(text);
      if (!name.trim()) setName(file.name.replace(/\.(txt|csv)$/i, ''));
    };
    reader.readAsText(file);
  };

  return (
    <div className="import-area">
      <div className="card" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="词库名称（可选）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            📂 文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          每行一个词；支持 词 <code>{'\t'}</code> 释义、<code>,</code> 分隔
        </p>
      </div>

      <textarea
        placeholder={`粘贴单词，例如：\nabandon 放弃\nbenevolent 仁慈的\ncatastrophe\n...`}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />

      {parsed.length > 0 && (
        <div className="card" style={{ flexShrink: 0 }}>
          <div className="card-header">识别到 {parsed.length} 个词</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {parsed.slice(0, 20).map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  background: 'var(--accent-light)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                {p.text}{p.meaning ? ` → ${p.meaning.slice(0, 12)}` : ''}
              </span>
            ))}
            {parsed.length > 20 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>}
          </div>
          <button className="btn btn-primary" onClick={handleImport} disabled={busy}>
            {busy ? '导入中…' : `导入 ${parsed.length} 个词 → 开背`}
          </button>
        </div>
      )}
    </div>
  );
}
