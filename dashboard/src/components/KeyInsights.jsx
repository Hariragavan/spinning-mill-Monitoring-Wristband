import React from 'react';

const insights = [
  {
    icon: '↑',
    iconClass: 'green',
    text: 'Production output increased by 4.2% compared to yesterday\u2019s shift average.',
    time: '12 min ago',
  },
  {
    icon: '⚠',
    iconClass: 'amber',
    text: 'Machine M2 spindle #14 flagged for setup check — vibration above threshold.',
    time: '28 min ago',
  },
  {
    icon: '🔧',
    iconClass: 'blue',
    text: 'Scheduled maintenance for Ring Frame #3 completes at 3:00 PM today.',
    time: '45 min ago',
  },
  {
    icon: '↓',
    iconClass: 'red',
    text: 'Worker idle time on Zone B exceeded 5 min threshold twice this shift.',
    time: '1 hr ago',
  },
  {
    icon: '✓',
    iconClass: 'green',
    text: 'Quality audit passed — yarn tension within spec across all active frames.',
    time: '2 hr ago',
  },
];

const KeyInsights = () => {
  return (
    <div className="card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Key Insights & Downtime Report
      </div>
      <ul className="insights-list">
        {insights.map((item, i) => (
          <li key={i} className="insight-item">
            <div className={`insight-icon ${item.iconClass}`}>
              {item.icon}
            </div>
            <div>
              <div className="insight-text">{item.text}</div>
              <div className="insight-time">{item.time}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default KeyInsights;
