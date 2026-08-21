import React from 'react';

const insights = [
  {
    category: 'Electrical Break',
    simpleText: 'Elec Break: Machine 1 sensor tripped due to power surge.',
    time: '10 min ago',
    progress: 85,
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    category: 'Mechanical Break',
    simpleText: 'Mech Break: Machine 3 spindle drive belt replacement.',
    time: '25 min ago',
    progress: 65,
    color: '#f97316',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    category: 'Machine Cleaning',
    simpleText: 'Cleaning: Machine 2 suction unit & roller fluff removal.',
    time: '40 min ago',
    progress: 45,
    color: '#06b6d4',
    bgColor: '#ecfeff',
    borderColor: '#cff4fc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M3 21h18"/><path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M12 3v12"/>
      </svg>
    ),
  },
  {
    category: 'Shift Meeting',
    title: 'Supervisor Briefing',
    simpleText: 'Meeting: Shift patrol targets & safety alignment.',
    time: '1 hr ago',
    progress: 25,
    color: '#6366f1',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

const KeyInsights = () => {
  return (
    <div className="card chart-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Key Insights & Logs
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
          Live Log Status
        </span>
      </div>

      <div className="clean-insights-container">
        {insights.map((item, i) => (
          <div key={i} className="clean-insight-block">
            <div className="clean-insight-top">
              <span 
                className="clean-insight-badge"
                style={{ 
                  color: item.color, 
                  background: item.bgColor,
                  borderColor: item.borderColor
                }}
              >
                {item.icon}
                {item.category}
              </span>
              <span className="clean-insight-time">{item.time}</span>
            </div>

            <div className="clean-insight-text">{item.simpleText}</div>

            {/* Horizontal progress bar with circular end node (matching diagram) */}
            <div className="insight-bar-track">
              <div 
                className="insight-bar-fill" 
                style={{ width: `${item.progress}%`, background: item.color }}
              >
                <span className="insight-bar-dot" style={{ background: item.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyInsights;
