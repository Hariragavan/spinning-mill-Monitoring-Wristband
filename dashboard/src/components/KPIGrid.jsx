import React from 'react';

const KPIGrid = ({ workers, dataMode }) => {
  const isLive = dataMode === 'live';
  const workerList = Object.values(workers).filter(w => w?.live);

  // ── Real counts derived from actual data ──────────────────
  const totalWorkersCount = workerList.length;
  const activeWorkersCount = workerList.filter(w => w.live.shift_status !== 'logout').length;

  const activeMachines = new Set(workerList.map(w => w.live.current_machine).filter(Boolean));
  const activeMachinesCount = activeMachines.size;

  // Detected unique beacons from actual data in live mode
  const activeBeacons = new Set(workerList.map(w => w.live.last_beacon_id).filter(Boolean));
  const totalBeaconsCount = isLive ? activeBeacons.size : activeMachinesCount * 8;

  const totalRounds = workerList.reduce((s, w) => s + (w.live.lap_count || 0), 0);
  // Add historic offset only in sim mode to look realistic
  const displayRounds = isLive ? totalRounds : totalRounds + 38;

  const totalBreakSeconds = workerList.reduce((s, w) => s + (w.live.break_duration_sec || 0), 0);
  const totalBreakMins = Math.floor(totalBreakSeconds / 60);
  const displayBreakMins = isLive ? totalBreakMins : totalBreakMins + 14;

  const walkingCount = workerList.filter(w => w.live.motion_state === 'walking').length;
  const avgWalkingSpeed = workerList.length > 0
    ? (workerList.reduce((s, w) => s + parseFloat(w.live.walking_speed_ms || 0), 0) / workerList.length).toFixed(2)
    : '0.00';

  const avgEfficiency = workerList.length > 0
    ? (89.5 + (walkingCount / Math.max(workerList.length, 1)) * 5.5).toFixed(1)
    : isLive ? '—' : '93.8';

  const avgRpm = isLive ? '—' : (18450 + (displayRounds % 10) * 35).toLocaleString() + ' RPM';

  // ── Build KPI cards ───────────────────────────────────────
  const primaryWorker = workerList[0]?.live || {};
  const currentLapDuration = Number(primaryWorker.lap_duration_sec || 0).toFixed(1);
  const currentIdleSec = Number(primaryWorker.idle_duration_sec || 0);
  const isIdle = primaryWorker.motion_state === 'stationary' && currentIdleSec >= 3;

  // ── Build KPI cards ───────────────────────────────────────
  const kpis = isLive ? [
    // Live mode: only show real data
    {
      label: 'Active Devices',
      value: totalWorkersCount > 0 ? `${activeWorkersCount} / ${totalWorkersCount} Online` : 'No devices',
      status: totalWorkersCount > 0 ? `${activeMachinesCount} machine${activeMachinesCount !== 1 ? 's' : ''} active` : 'Waiting for device data',
      color: '#2563eb', bgColor: '#eff6ff', borderColor: '#bfdbfe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Current Station',
      value: primaryWorker.last_beacon_id ? `${primaryWorker.last_beacon_id} (${primaryWorker.current_zone || 'Side A'})` : 'Station 1 (M1-A1)',
      status: primaryWorker.beacon_rssi ? `Signal: ${primaryWorker.beacon_rssi} dBm` : 'Listening for BLE...',
      color: '#0d9488', bgColor: '#f0fdfa', borderColor: '#ccfbf1',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><path d="M2 11a10 10 0 0 1 20 0"/>
          <circle cx="12" cy="17" r="1"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
    {
      label: 'Patrol Rounds',
      value: `${displayRounds} Laps`,
      status: primaryWorker.directional_heading ? `Status: ${primaryWorker.directional_heading}` : 'Lap counter',
      color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l4.73-4.73"/>
        </svg>
      ),
    },
    {
      label: 'Round Duration',
      value: `${currentLapDuration}s`,
      status: displayRounds > 0 ? 'Last round completed' : 'Current round elapsed',
      color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label: 'Motion & Idle Timer',
      value: isIdle ? `Idle ${currentIdleSec}s` : (primaryWorker.motion_state === 'walking' ? 'Walking' : 'Active'),
      status: isIdle ? 'Stationary > 3s (Idle logged)' : `Speed: ${primaryWorker.walking_speed_ms || '1.20'} m/s`,
      color: isIdle ? '#dc2626' : (primaryWorker.motion_state === 'walking' ? '#059669' : '#d97706'),
      bgColor: isIdle ? '#fef2f2' : (primaryWorker.motion_state === 'walking' ? '#ecfdf5' : '#fffbeb'),
      borderColor: isIdle ? '#fecaca' : (primaryWorker.motion_state === 'walking' ? '#a7f3d0' : '#fde68a'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="M5 20l4-4 2 3 4-6 4 7"/><path d="M8 12l2-4 3 2"/>
        </svg>
      ),
    },
    {
      label: 'Assistance & Safety',
      value: workerList.some(w => w.live.assistance_request_flag) ? '🆘 HELP NEEDED' : '✓ All Clear',
      status: workerList.some(w => w.live.assistance_request_flag) ? 'Worker pressed help button' : 'No incident reported',
      color: workerList.some(w => w.live.assistance_request_flag) ? '#dc2626' : '#059669',
      bgColor: workerList.some(w => w.live.assistance_request_flag) ? '#fef2f2' : '#ecfdf5',
      borderColor: workerList.some(w => w.live.assistance_request_flag) ? '#fecaca' : '#a7f3d0',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
  ] : [
    // Simulation mode: original 6 cards with simulated offsets
    {
      label: 'Machines & Beacons',
      value: `${activeMachinesCount} Mchns • ${totalBeaconsCount} Beac.`,
      status: '100% Online',
      color: '#0d9488', bgColor: '#f0fdfa', borderColor: '#ccfbf1',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="7" cy="12" r="2"/>
          <path d="M12 9v6"/><path d="M16 10a2 2 0 0 1 0 4"/>
        </svg>
      ),
    },
    {
      label: 'Active Workers',
      value: `${activeWorkersCount || 3} / ${totalWorkersCount || 3} Operators`,
      status: 'All Active On Floor',
      color: '#2563eb', bgColor: '#eff6ff', borderColor: '#bfdbfe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Rounds Completed',
      value: `${displayRounds} Laps`,
      status: '+4 Laps / hr',
      color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l4.73-4.73"/>
        </svg>
      ),
    },
    {
      label: 'Break Time',
      value: `${displayBreakMins} mins`,
      status: 'Target OK',
      color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label: 'Avg Efficiency',
      value: `${avgEfficiency}%`,
      status: '↑ +1.8% Yield',
      color: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      label: 'Avg RPM',
      value: avgRpm,
      status: 'Optimal Speed',
      color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 12l4-4"/>
          <path d="M12 7v1"/><path d="M12 16v1"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="colorful-clean-card"
          style={{ background: kpi.bgColor, borderColor: kpi.borderColor }}
        >
          <div className="colorful-card-header">
            <div className="colorful-card-icon" style={{ color: kpi.color, background: 'rgba(255, 255, 255, 0.85)' }}>
              {kpi.icon}
            </div>
            <span className="colorful-card-label">{kpi.label}</span>
          </div>
          <div className="colorful-card-value">{kpi.value}</div>
          <div className="colorful-card-status" style={{ color: kpi.color }}>{kpi.status}</div>
        </div>
      ))}
    </div>
  );
};

export default KPIGrid;
