import React from 'react';

const WORKER_NAMES = {
  worker_1: 'Worker 1',
  worker_2: 'Worker 2',
  worker_3: 'Worker 3',
};

const WORKER_COLORS = {
  worker_1: '#2563eb',
  worker_2: '#8b5cf6',
  worker_3: '#e91e63',
};

const A_STATIONS = ['A1', 'A2', 'A3', 'A4'];
const B_STATIONS = ['B1', 'B2', 'B3', 'B4'];

const BEACON_POSITIONS = {
  A1: 14, A2: 38, A3: 62, A4: 86,
  B1: 14, B2: 38, B3: 62, B4: 86
};

const ZONES = [
  { id: 'zone-a', label: 'ZONE A', machine: 'M1', machineName: 'Machine 1' },
  { id: 'zone-b', label: 'ZONE B', machine: 'M2', machineName: 'Machine 2' },
  { id: 'zone-c', label: 'ZONE C', machine: 'M3', machineName: 'Machine 3' },
  { id: 'zone-d', label: 'ZONE D', machine: null, machineName: 'Maintenance Bay' },
];

function isRecent(timestamp) {
  if (!timestamp) return false;
  return (Date.now() - timestamp) < 25000;
}

function isBeaconOnline(b) {
  if (!b || b.status !== 'online') return false;
  const timeUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  const timeSeen = b.last_seen ? new Date(b.last_seen).getTime() : 0;
  const time = Math.max(timeUpdated, timeSeen);
  if (!time) return false;
  return (Date.now() - time) < 25000;
}

function isOnSideA(w) {
  if (w.current_zone === 'Side A') return true;
  if (w.current_zone === 'Side B') return false;
  const b = w.last_beacon_id || '';
  if (b.includes('A') || b.startsWith('A')) return true;
  if (b.includes('B') || b.startsWith('B')) return false;
  return true;
}

function getWorkerPositionPct(w) {
  const b = w.last_beacon_id || 'A1';
  const match = b.match(/([AB][1-4])/i);
  const code = match ? match[1].toUpperCase() : 'A1';
  return BEACON_POSITIONS[code] ?? 14;
}

function getWorkerStatusClass(live) {
  if (live.assistance_request_flag) return 'alert';
  if (live.incident_type && live.incident_type !== 'none') return 'alert';
  if (live.motion_state === 'stationary' && live.idle_duration_sec >= 3) return 'idle';
  return 'active';
}

function getWorkerStatusText(live) {
  if (live.assistance_request_flag) return 'HELP!';
  if (live.incident_type && live.incident_type !== 'none') return live.incident_type.replace('_', ' ');
  if (live.motion_state === 'stationary' && live.idle_duration_sec >= 3) return `IDLE (${live.idle_duration_sec}s)`;
  return 'ACTIVE';
}

const ZoneMap = ({ workers = {}, beacons = [], onWorkerClick }) => {
  const onlineBeacons = beacons.filter(isBeaconOnline);
  const onlineBeaconSet = new Set(onlineBeacons.map(b => b.beacon_id));

  // Extract real workers list from props
  const allWorkers = Object.entries(workers)
    .filter(([, d]) => d?.live)
    .map(([id, d]) => ({ id, ...d.live }));

  return (
    <div className="card zone-map-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        <span style={{ fontWeight: 800, letterSpacing: '0.04em' }}>FACTORY FLOOR — LIVE TRACKING</span>
      </div>

      <div className="zone-grid">
        {ZONES.map(zone => {
          // Special Maintenance Bay card
          if (!zone.machine) {
            return (
              <div key={zone.id} className="zone-cell">
                <div className="zone-cell-header">
                  <div className="zone-title-group">
                    <span className="zone-machine-title">{zone.machineName}</span>
                    <span className="zone-tag">{zone.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '120px', color: '#94a3b8' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>No active machine</span>
                </div>
              </div>
            );
          }

          // Machine cards (Machine 1, Machine 2, Machine 3)
          const machineWorkers = allWorkers.filter(w => w.current_machine === zone.machine && isRecent(w.timestamp));
          const hasActiveWorker = machineWorkers.length > 0;
          const primaryWorker = machineWorkers[0];

          let statusBadge;
          if (hasActiveWorker) {
            if (primaryWorker.motion_state === 'walking') {
              statusBadge = <div className="zone-status-pill normal">✓ Running Normally</div>;
            } else {
              statusBadge = <div className="zone-status-pill idle">IDLE ({primaryWorker.idle_duration_sec || 0}s)</div>;
            }
          } else {
            statusBadge = <div className="zone-status-pill empty">No Active Worker</div>;
          }

          return (
            <div key={zone.id} className="zone-cell">
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{zone.machineName}</span>
                  <span className="zone-tag">{zone.label}</span>
                </div>
                {statusBadge}
              </div>

              <div className="machine-visual-container">
                {/* Side A Stations (Top: A1, A2, A3, A4) */}
                <div className="beacon-side side-a">
                  {A_STATIONS.map(b => {
                    const fullId = `${zone.machine}-${b}`;
                    const isOnline = onlineBeaconSet.has(fullId);
                    const isTouched = machineWorkers.some(w => {
                      const curBeacon = (w.last_beacon_id || '').toUpperCase();
                      return curBeacon === fullId || curBeacon === b;
                    });

                    let dotClass = 'beacon-dot';
                    if (isTouched) dotClass += ' active dot-reached';
                    else if (isOnline) dotClass += ' dot-online';
                    else dotClass += ' dot-inactive';

                    return (
                      <React.Fragment key={b}>
                        <span className="beacon-label beacon-label-top" style={{ left: `${BEACON_POSITIONS[b]}%` }}>
                          {b}
                        </span>
                        <div
                          className={dotClass}
                          style={{ left: `${BEACON_POSITIONS[b]}%` }}
                          title={`${fullId}: ${isTouched ? 'Worker Present' : (isOnline ? 'Online' : 'Offline')}`}
                        />
                      </React.Fragment>
                    );
                  })}

                  {/* Worker Pills on Side A */}
                  {machineWorkers.filter(w => isOnSideA(w)).map(w => {
                    const num = w.id ? w.id.split('_')[1] || '1' : '1';
                    return (
                      <div
                        key={w.id}
                        className={`worker-pill worker-pill-top ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
                        style={{ left: `${getWorkerPositionPct(w)}%`, cursor: 'pointer' }}
                        onClick={() => onWorkerClick && onWorkerClick(w.id)}
                      >
                        <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#2563eb' }}>
                          {num}
                        </div>
                        <div className="worker-pill-info">
                          <span className="worker-pill-name">W{num}: {WORKER_NAMES[w.id] || `Worker ${num}`}</span>
                          <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>
                            {getWorkerStatusText(w)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Machine Chassis Bar */}
                <div className="machine-body-bar" />

                {/* Side B Stations (Bottom: B1, B2, B3, B4 directly aligned under A1, A2, A3, A4) */}
                <div className="beacon-side side-b">
                  {B_STATIONS.map(b => {
                    const fullId = `${zone.machine}-${b}`;
                    const isOnline = onlineBeaconSet.has(fullId);
                    const isTouched = machineWorkers.some(w => {
                      const curBeacon = (w.last_beacon_id || '').toUpperCase();
                      return curBeacon === fullId || curBeacon === b;
                    });

                    let dotClass = 'beacon-dot';
                    if (isTouched) dotClass += ' active dot-reached';
                    else if (isOnline) dotClass += ' dot-online';
                    else dotClass += ' dot-inactive';

                    return (
                      <React.Fragment key={b}>
                        <div
                          className={dotClass}
                          style={{ left: `${BEACON_POSITIONS[b]}%` }}
                          title={`${fullId}: ${isTouched ? 'Worker Present' : (isOnline ? 'Online' : 'Offline')}`}
                        />
                        <span className="beacon-label beacon-label-bottom" style={{ left: `${BEACON_POSITIONS[b]}%` }}>
                          {b}
                        </span>
                      </React.Fragment>
                    );
                  })}

                  {/* Worker Pills on Side B */}
                  {machineWorkers.filter(w => !isOnSideA(w)).map(w => {
                    const num = w.id ? w.id.split('_')[1] || '1' : '1';
                    return (
                      <div
                        key={w.id}
                        className={`worker-pill worker-pill-bottom ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
                        style={{ left: `${getWorkerPositionPct(w)}%`, cursor: 'pointer' }}
                        onClick={() => onWorkerClick && onWorkerClick(w.id)}
                      >
                        <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#2563eb' }}>
                          {num}
                        </div>
                        <div className="worker-pill-info">
                          <span className="worker-pill-name">W{num}: {WORKER_NAMES[w.id] || `Worker ${num}`}</span>
                          <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>
                            {getWorkerStatusText(w)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ZoneMap;
