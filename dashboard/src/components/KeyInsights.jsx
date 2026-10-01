import React from 'react';

const KeyInsights = ({ workers = {}, telemetryLogs = [] }) => {
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const primaryWorker = workerList[0]?.live;

  // Build real dynamic insights from actual telemetry
  const insights = [];

  if (telemetryLogs.length > 0) {
    telemetryLogs.slice(0, 4).forEach((log, idx) => {
      const timeAgo = Math.max(1, Math.round((Date.now() - new Date(log.created_at).getTime()) / 60000));
      const stationName = log.station_id || log.target_beacon || 'station';
      if (log.event === 'TOUCH' || log.event === 'HALF_ROUND_COMPLETED') {
        insights.push({
          category: log.event === 'HALF_ROUND_COMPLETED' ? 'Midpoint Check' : 'Checkpoint Touch',
          simpleText: `${log.event === 'HALF_ROUND_COMPLETED' ? 'Midpoint reached' : 'Verified 10cm touch'} at ${stationName} by ${log.target_device || 'operator'}.`,
          time: `${timeAgo} min ago`,
          progress: 90 - idx * 15,
          color: '#0d9488',
          bgColor: '#f0fdfa',
          borderColor: '#ccfbf1',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><path d="M2 11a10 10 0 0 1 20 0"/><circle cx="12" cy="17" r="1"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          ),
        });
      } else if (log.event === 'ROUND_COMPLETED' || log.event === 'LAP_STARTED') {
        const isStart = log.event === 'LAP_STARTED';
        insights.push({
          category: isStart ? 'Patrol Started' : 'Patrol Complete',
          simpleText: isStart
            ? `Patrol inspection round initiated at ${stationName}.`
            : `Full inspection round completed across Machine 1 stations (${log.lap_duration_sec || 0}s).`,
          time: `${timeAgo} min ago`,
          progress: isStart ? 40 : 100,
          color: isStart ? '#2563eb' : '#10b981',
          bgColor: isStart ? '#eff6ff' : '#ecfdf5',
          borderColor: isStart ? '#bfdbfe' : '#a7f3d0',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          ),
        });
      } else if (log.event === 'EMERGENCY_ASSIST') {
        insights.push({
          category: 'Assistance Alert',
          simpleText: `Worker assistance button pressed at ${stationName}.`,
          time: `${timeAgo} min ago`,
          progress: 100,
          color: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          ),
        });
      }
    });
  }

  // If we don't have 4 logs, supplement with live worker status
  if (primaryWorker && insights.length < 4) {
    if (primaryWorker.motion_state === 'walking') {
      insights.push({
        category: 'Active Patrol',
        simpleText: `Operator actively patrolling ${primaryWorker.current_machine || 'M1'} (${primaryWorker.directional_heading || 'Forward'}).`,
        time: 'Live now',
        progress: 85,
        color: '#2563eb',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        ),
      });
    } else {
      insights.push({
        category: 'Stationary Check',
        simpleText: `Operator paused at ${primaryWorker.last_beacon_id} (${primaryWorker.idle_duration_sec || 0}s).`,
        time: 'Live now',
        progress: 60,
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      });
    }

    insights.push({
      category: 'Telemetry Sync',
      simpleText: `Direct BLE-to-Supabase synchronization active for ${primaryWorker.device_id}.`,
      time: 'Live now',
      progress: 95,
      color: '#0d9488',
      bgColor: '#f0fdfa',
      borderColor: '#ccfbf1',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="7" cy="12" r="2"/><path d="M12 9v6"/>
        </svg>
      ),
    });
  }

  // Fallback if floor is completely idle
  if (insights.length === 0) {
    insights.push({
      category: 'System Ready',
      simpleText: 'Awaiting beacon heartbeats and operator patrol telemetry from floor.',
      time: 'Online',
      progress: 50,
      color: '#64748b',
      bgColor: '#f8fafc',
      borderColor: '#e2e8f0',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      ),
    });
  }

  return (
    <div className="card chart-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Key Telemetry Insights
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
          Live Log Feed
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

            <div className="insight-bar-track">
              <div 
                className="insight-bar-fill" 
                style={{ 
                  width: `${item.progress}%`,
                  background: item.color
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyInsights;
