import React from 'react';

const KPIGrid = ({ workers }) => {
  // Derive some KPIs from live worker data
  const workerList = Object.values(workers).filter(w => w?.live);
  const totalRounds = workerList.reduce((s, w) => s + (w.live.lap_count || 0), 0);
  const activeCount = workerList.filter(w => w.live.motion_state === 'walking').length;
  const alertCount = workerList.filter(w => w.live.incident_type !== 'none').length;
  const idleCount = workerList.filter(w => w.live.motion_state === 'stationary' && w.live.idle_duration_sec > 60).length;

  const kpis = [
    {
      label: 'Total Production',
      value: (9410 + totalRounds * 12).toLocaleString(),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      ),
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
    },
    {
      label: 'Overall Efficiency',
      value: '92.5%',
      trend: { direction: 'up', text: '+2.1%' },
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      iconBg: '#ecfdf5',
      iconColor: '#10b981',
    },
    {
      label: 'Downtime',
      value: '1.4%',
      trend: { direction: 'down', text: '-0.3%' },
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      iconBg: '#fef2f2',
      iconColor: '#ef4444',
    },
    {
      label: 'Active Machines',
      value: `${activeCount > 0 ? 22 : 20}/24`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/>
        </svg>
      ),
      iconBg: '#f5f3ff',
      iconColor: '#8b5cf6',
    },
    {
      label: 'Alerts',
      value: String(alertCount + idleCount + 3),
      isAlert: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      iconBg: '#fffbeb',
      iconColor: '#f59e0b',
    },
    {
      label: 'Pending Tasks',
      value: '18',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      ),
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
    },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, i) => (
        <div key={i} className={`kpi-card ${kpi.isAlert ? 'alert-card' : ''}`}>
          <div
            className="kpi-icon"
            style={{ background: kpi.iconBg, color: kpi.iconColor }}
          >
            {kpi.icon}
          </div>
          <div className="kpi-label">{kpi.label}</div>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpi.value}</span>
            {kpi.trend && (
              <span className={`kpi-trend ${kpi.trend.direction}`}>
                {kpi.trend.direction === 'up' ? '↑' : '↓'} {kpi.trend.text}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIGrid;
