import { useEffect, useState } from 'react';
import { db } from '../db/dexie';
import type { Word, AppEvent } from '../db/types';

interface Stats {
  totalStruck: number;
  totalMastered: number;
  totalActive: number;
  todayMastered: number;
  daysActive: number;
  currentStreak: number;
  hourHistogram: number[];
  eventsByDay: Record<string, number>;
}

function buildStats(words: Word[], events: AppEvent[]): Stats {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const totalStruck = words.filter((w) => w.status === 'struck').length;
  const totalMastered = words.filter((w) => w.status === 'mastered').length;
  const totalActive = words.filter((w) => w.status === 'active').length;

  const todayMastered = words.filter(
    (w) => w.status === 'mastered' && w.masteredAt?.toISOString().slice(0, 10) === today
  ).length;

  // Event-based stats
  const eventsByDay: Record<string, number> = {};
  for (const e of events) {
    const day = e.ts.toISOString().slice(0, 10);
    eventsByDay[day] = (eventsByDay[day] ?? 0) + 1;
  }

  const activeDays = Object.keys(eventsByDay).length;

  // Current streak
  let streak = 0;
  const d = new Date(now);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (eventsByDay[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Hour histogram (24h)
  const hourHistogram = new Array(24).fill(0);
  for (const e of events) {
    const h = e.ts.getHours();
    hourHistogram[h]++;
  }

  return {
    totalStruck,
    totalMastered,
    totalActive,
    todayMastered,
    daysActive: activeDays,
    currentStreak: streak,
    hourHistogram,
    eventsByDay,
  };
}

function renderHeatmap(eventsByDay: Record<string, number>) {
  const cells: React.ReactNode[] = [];
  const now = new Date();
  // Show last 12 weeks (84 days)
  for (let i = 83; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = eventsByDay[key] ?? 0;
    let level = 0;
    if (count > 0) level = 1;
    if (count > 3) level = 2;
    if (count > 10) level = 3;
    if (count > 25) level = 4;
    cells.push(<div key={key} className={`heatmap-cell level-${level}`} title={`${key}: ${count}`} />);
  }
  return cells;
}

function bestHour(hours: number[]): string {
  let max = 0;
  let best = -1;
  for (let i = 0; i < hours.length; i++) {
    if (hours[i] > max) {
      max = hours[i];
      best = i;
    }
  }
  if (best < 0) return '';
  return `${best.toString().padStart(2, '0')}:00`;
}

export default function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [words, events] = await Promise.all([
        db.words.toArray(),
        db.events.toArray(),
      ]);
      setStats(buildStats(words, events));
    })();
  }, []);

  if (!stats) {
    return <div className="stats-view"><div className="empty-state"><div className="emoji">⏳</div></div></div>;
  }

  const total = stats.totalActive + stats.totalStruck + stats.totalMastered;
  const hour = bestHour(stats.hourHistogram);
  const maxHourCount = Math.max(...stats.hourHistogram, 1);

  return (
    <div className="stats-view">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.currentStreak}</div>
          <div className="stat-label">连续天数</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.daysActive}</div>
          <div className="stat-label">累计活跃</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalStruck + stats.totalMastered}</div>
          <div className="stat-label">累计划掉</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.todayMastered}</div>
          <div className="stat-label">今日掌握</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalMastered}</div>
          <div className="stat-label">累计掌握</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{total}</div>
          <div className="stat-label">总词条</div>
        </div>
      </div>

      <div className="stats-section">
        <h3>活跃热力图</h3>
        <div className="heatmap">{renderHeatmap(stats.eventsByDay)}</div>
      </div>

      {stats.hourHistogram.some((h) => h > 0) && (
        <div className="stats-section">
          <h3>时间习惯 {hour && `— 你常在 ${hour} 左右背`}</h3>
          <div className="hour-bars">
            {stats.hourHistogram.map((h, i) => (
              <div
                key={i}
                className="hour-bar"
                style={{ height: `${(h / maxHourCount) * 100}%` }}
                title={`${i.toString().padStart(2, '0')}:00 — ${h} 次`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
