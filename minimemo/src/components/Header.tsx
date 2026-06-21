import { useLocation, useNavigate } from 'react-router-dom';

const TABS: { path: string; label: string; match: (p: string) => boolean }[] = [
  { path: '/', label: '背', match: (p) => p === '/' || p === '/review' },
  { path: '/browse', label: '词库', match: (p) => p.startsWith('/browse') },
  { path: '/import', label: '导入', match: (p) => p === '/import' },
  { path: '/stats', label: '统计', match: (p) => p === '/stats' },
  { path: '/settings', label: '设置', match: (p) => p === '/settings' },
];

export default function Header() {
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <header className="app-header">
      <h1>✏️ 极简背词</h1>
      <nav>
        {TABS.map((t) => (
          <button
            key={t.path}
            className={`nav-btn ${t.match(loc.pathname) ? 'active' : ''}`}
            onClick={() => nav(t.path)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
