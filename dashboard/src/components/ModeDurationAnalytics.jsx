import React, { useState } from 'react';

const MODES = [
  { key: 'rpm',      label: 'RPM',           color: '#2563eb', icon: '◎' },
  { key: 'maint',    label: 'Maintenance',   color: '#8b5cf6', icon: '⚙' },
  { key: 'doffing',  label: 'Doffing',       color: '#0891b2', icon: '⟳' },
  { key: 'cleaning', label: 'Cleaning',      color: '#d97706', icon: '✦' },
  { key: 'mechbrk',  label: 'Mech Break',    color: '#f97316', icon: '▲' },
  { key: 'elecbrk',  label: 'Elec Break',    color: '#ef4444', icon: '⚡' },
  { key: 'break',    label: 'Break',         color: '#059669', icon: '◗' },
  { key: 'meeting',  label: 'Meeting',       color: '#6366f1', icon: '⬡' },
];

const MAX_BAR = 60; // max minutes for bar scale

// Simulated mode duration data keyed by view (hourly/daily/weekly)
const DATA = {
  hourly: [
    { period: '05:30', rpm: 0,  maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '09:30', rpm: 0,  maint: 0,  doffing: 0,  cleaning: 5,  mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '10:30', rpm: 0,  maint: 0,  doffing: 0,  cleaning: 55, mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '15:30', rpm: 0,  maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 35, break: 0,  meeting: 0  },
    { period: '16:30', rpm: 0,  maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 25, elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '21:30', rpm: 52, maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '22:30', rpm: 60, maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
    { period: '23:30', rpm: 31, maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 0,  break: 31, meeting: 0  },
  ],
  daily: [
    { period: 'Mon',  rpm: 120, maint: 30, doffing: 15, cleaning: 60, mechbrk: 10, elecbrk: 20, break: 45, meeting: 15 },
    { period: 'Tue',  rpm: 180, maint: 10, doffing: 20, cleaning: 55, mechbrk: 25, elecbrk: 5,  break: 30, meeting: 0  },
    { period: 'Wed',  rpm: 90,  maint: 0,  doffing: 30, cleaning: 0,  mechbrk: 0,  elecbrk: 60, break: 20, meeting: 30 },
    { period: 'Thu',  rpm: 200, maint: 20, doffing: 10, cleaning: 20, mechbrk: 15, elecbrk: 0,  break: 50, meeting: 10 },
    { period: 'Fri',  rpm: 150, maint: 40, doffing: 5,  cleaning: 35, mechbrk: 5,  elecbrk: 10, break: 40, meeting: 20 },
    { period: 'Sat',  rpm: 60,  maint: 60, doffing: 45, cleaning: 10, mechbrk: 0,  elecbrk: 0,  break: 25, meeting: 5  },
    { period: 'Sun',  rpm: 0,   maint: 0,  doffing: 0,  cleaning: 0,  mechbrk: 0,  elecbrk: 0,  break: 0,  meeting: 0  },
  ],
  weekly: [
    { period: 'Wk 1', rpm: 480, maint: 90,  doffing: 60,  cleaning: 180, mechbrk: 40,  elecbrk: 60,  break: 210, meeting: 60 },
    { period: 'Wk 2', rpm: 540, maint: 120, doffing: 90,  cleaning: 120, mechbrk: 20,  elecbrk: 90,  break: 180, meeting: 30 },
    { period: 'Wk 3', rpm: 360, maint: 60,  doffing: 45,  cleaning: 240, mechbrk: 80,  elecbrk: 30,  break: 240, meeting: 90 },
    { period: 'Wk 4', rpm: 600, maint: 150, doffing: 120, cleaning: 90,  mechbrk: 60,  elecbrk: 45,  break: 200, meeting: 45 },
  ],
};

function getTotal(row) {
  return MODES.reduce((s, m) => s + (row[m.key] || 0), 0);
}

function formatMins(mins) {
  if (mins === 0) return <span className="mda-zero">—</span>;
  return <strong>{mins}m</strong>;
}

const MiniBar = ({ value, max, color }) => {
  if (value === 0) return null;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mda-bar-track">
      <div className="mda-bar-fill" style={{ width: `${pct}%`, background: color }}>
        <span className="mda-bar-nub" style={{ background: color }} />
      </div>
    </div>
  );
};

const ModeDurationAnalytics = () => {
  const [view, setView] = useState('hourly');

  const rows = DATA[view];
  const maxVal = view === 'hourly' ? 60 : view === 'daily' ? 200 : 600;

  return (
    <div className="mda-card">
      {/* Header */}
      <div className="mda-header">
        <div>
          <h3 className="mda-title">Mode Duration Analytics</h3>
          <p className="mda-subtitle">How many minutes the machine stayed in each mode</p>
        </div>
        <div className="mda-view-toggle">
          {['hourly', 'daily', 'weekly'].map((v) => (
            <button
              key={v}
              className={`mda-toggle-btn ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mda-table-wrap">
        <table className="mda-table">
          <thead>
            <tr>
              <th className="mda-th mda-th-period">Period</th>
              {MODES.map((m) => (
                <th key={m.key} className="mda-th">
                  <span className="mda-th-dot" style={{ background: m.color }} />
                  {m.label}
                </th>
              ))}
              <th className="mda-th mda-th-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const total = getTotal(row);
              return (
                <tr key={i} className="mda-row">
                  <td className="mda-td mda-td-period">{row.period}</td>
                  {MODES.map((m) => (
                    <td key={m.key} className="mda-td">
                      <div className="mda-cell">
                        <MiniBar value={row[m.key]} max={maxVal} color={m.color} />
                        <span className="mda-val" style={row[m.key] > 0 ? { color: m.color } : {}}>
                          {row[m.key] > 0 ? `${row[m.key]}m` : '—'}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="mda-td mda-td-total">
                    <span className="mda-total-val">{total > 0 ? `${total}m` : '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mda-legend">
        {MODES.map((m) => (
          <span key={m.key} className="mda-legend-item">
            <span className="mda-legend-dot" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ModeDurationAnalytics;
