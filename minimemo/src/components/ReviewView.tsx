import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getStruckWords, getSettings, logEvent } from '../db/dexie';
import type { Word } from '../db/types';
import { speak, isSpeechSupported } from '../utils/speak';

export default function ReviewView() {
  const nav = useNavigate();
  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState<'word-to-meaning' | 'meaning-to-word'>('word-to-meaning');

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setDir(s.verifyDirection);
      const struck = await getStruckWords();
      setWords(struck);
      setLoading(false);
    })();
  }, []);

  const current = words[index];

  const handleFlip = () => setFlipped((f) => !f);

  const finish = async (pass: boolean) => {
    if (!current) return;
    if (pass) {
      await db.words.update(current.id, { status: 'mastered', masteredAt: new Date() });
      await logEvent('verify_pass');
    } else {
      await db.words.update(current.id, { status: 'active', struckAt: undefined });
      await logEvent('verify_fail');
    }

    const remaining = words.filter((w) => w.id !== current.id);
    if (remaining.length === 0) {
      setDone(true);
    } else {
      setWords(remaining);
      setIndex((i) => Math.min(i, remaining.length - 1));
      setFlipped(false);
    }
  };

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (current) speak(current.text);
  };

  if (loading) {
    return <div className="review-view"><div className="emoji" style={{ fontSize: 48 }}>⏳</div></div>;
  }

  if (done || words.length === 0) {
    return (
      <div className="review-view">
        <div className="empty-state">
          <div className="emoji">✅</div>
          <div className="hint">检验完毕！已掌握的已存档，没通过的回去了。</div>
          <button className="btn btn-primary" onClick={() => nav('/')}>
            回去继续背
          </button>
        </div>
      </div>
    );
  }

  const showFront = dir === 'word-to-meaning';
  const frontText = showFront ? current.text : current.meaning ?? '(无释义)';
  const backText = showFront ? (current.meaning ?? '(无释义)') : current.text;
  const speakable = isSpeechSupported();

  return (
    <div className="review-view">
      <div className="review-count">
        剩余 {words.length} 个 · {dir === 'word-to-meaning' ? '看词回忆义' : '看义回忆词'}
      </div>

      <div className="review-card" onClick={handleFlip}>
        {!flipped ? (
          <div className="front">
            <div className="word-main">{frontText}</div>
            {speakable && (showFront) && (
              <button className="speak-btn speak-btn-lg" title="朗读" aria-label="朗读" onClick={handleSpeak}>
                🔊
              </button>
            )}
            <div className="tap-hint">点击翻转</div>
          </div>
        ) : (
          <div className="back">
            <div className="word-main">{backText}</div>
            {speakable && (
              <button className="speak-btn speak-btn-lg" title="朗读" aria-label="朗读" onClick={handleSpeak}>
                🔊
              </button>
            )}
            {current.reading && <div className="word-detail">{current.reading}</div>}
            {current.forms && current.forms.length > 0 && (
              <div className="word-forms">{current.forms.join(' · ')}</div>
            )}
            {current.en && (
              <details className="review-en-toggle" onClick={(e) => e.stopPropagation()}>
                <summary>📖 英文释义</summary>
                <div className="word-detail en-text">{current.en}</div>
              </details>
            )}
            {current.example && <div className="word-detail">例：{current.example}</div>}
            <div className="tap-hint">再点翻回</div>
          </div>
        )}
      </div>

      {flipped && (
        <div className="review-actions">
          <button className="btn btn-danger" onClick={() => finish(false)}>
            ✗ 不认识
          </button>
          <button className="btn btn-pass" onClick={() => finish(true)}>
            ✓ 认识
          </button>
        </div>
      )}

      <button className="btn btn-ghost" onClick={() => nav('/')}>
        ← 退出检验
      </button>
    </div>
  );
}
