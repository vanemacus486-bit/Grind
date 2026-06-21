import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { initSettings, getSettings, saveSettings } from './db/dexie';
import { ensureBuiltinVocab } from './db/seed';
import type { VocabLevel } from './db/types';
import { BUILTIN_DECKS } from './db/types';
import Header from './components/Header';
import StudyView from './components/StudyView';
import ImportView from './components/ImportView';
import ReviewView from './components/ReviewView';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import BrowseView from './components/BrowseView';

const STARTERS: { level: VocabLevel; desc: string }[] = [
  { level: 'gk', desc: '推荐 — 从高考词汇打地基' },
  { level: 'cet4', desc: '已有高考基础，直接补四级' },
  { level: 'cet6', desc: '四级无忧，挑战六级' },
  { level: 'ielts', desc: '全量 7000+，冲刺雅思' },
];

function AppContent() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const s = await initSettings();
      document.documentElement.setAttribute('data-theme', s.theme);

      const result = await ensureBuiltinVocab();
      if (result.imported) {
        setShowOnboarding(true);
      }

      setReady(true);
    })();
  }, []);

  const handleSelectStarter = async (level: VocabLevel) => {
    const settings = await getSettings();
    await saveSettings({ ...settings, startingDeck: level });
    setShowOnboarding(false);
    navigate('/');
  };

  if (!ready) {
    return (
      <div className="app-container loading-screen">
        <p className="loading-text">加载中…</p>
      </div>
    );
  }

  // —— 首次启动：选起点 deck ——
  if (showOnboarding) {
    return (
      <div className="app-container onboarding">
        <h2 className="onboarding-title">👋 欢迎！</h2>
        <p className="onboarding-sub">
          内置了从高考到雅思的分级词库（累进式，越往上越全）。请选择你的起点：
        </p>
        <div className="onboarding-list">
          {STARTERS.map(({ level, desc }) => (
            <button key={level} className="starter-btn" onClick={() => handleSelectStarter(level)}>
              {BUILTIN_DECKS[level]}
              <span className="starter-desc">{desc}</span>
            </button>
          ))}
        </div>
        <p className="onboarding-note">之后可在设置中随时切换</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Routes>
        <Route path="/import" element={<><Header /><ImportView /></>} />
        <Route path="/review" element={<><Header /><ReviewView /></>} />
        <Route path="/browse" element={<><Header /><BrowseView /></>} />
        <Route path="/stats" element={<><Header /><StatsView /></>} />
        <Route path="/settings" element={<><Header /><SettingsView /></>} />
        <Route path="*" element={<><Header /><StudyView /></>} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
