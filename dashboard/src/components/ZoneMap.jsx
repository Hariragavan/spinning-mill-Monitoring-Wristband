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
];

function isRecent(timestamp) {
  if (!timestamp) return false;
  return (Date.now() - timestamp) < 25000;
}

function isBeaconOnline(b) {
  if (!b) return false;
  if (b.status === 'online') {
    const timeUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    const timeSeen = b.last_seen ? new Date(b.last_seen).getTime() : 0;
    const time = Math.max(timeUpdated, timeSeen);
    if (!time) return true;
    return (Date.now() - time) < 60000;
  }
  return false;
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

  // Filter machines: show machine layout ONLY when any beacon is active for that machine (or worker active on it)
  const activeZones = ZONES.filter(zone => {
    const hasOnlineBeacon = onlineBeacons.some(b => {
      const mId = b.machine_id || (b.beacon_id ? b.beacon_id.split('-')[0] : '');
      return mId === zone.machine;
    });
    const hasActiveWorker = allWorkers.some(w => {
      const mId = w.current_machine || (w.last_beacon_id ? w.last_beacon_id.split('-')[0] : '');
      return mId === zone.machine && isRecent(w.timestamp);
    });
    return hasOnlineBeacon || hasActiveWorker;
  });

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

      <div className="zone-grid" style={{ gridTemplateColumns: activeZones.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))' }}>
        {activeZones.length === 0 ? (
          <div className="zone-cell empty-floor-standby" style={{ gridColumn: '1 / -1', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', background: '#fafbfc' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><path d="M2 11a10 10 0 0 1 20 0"/><circle cx="12" cy="17" r="1"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: 6 }}>
              Awaiting Active Beacon Telemetry
            </div>
            <div style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: '480px', lineHeight: 1.5 }}>
              The machine layout will display automatically when any beacon for that machine (e.g. M1-A1, M1-B4) or an assigned operator is detected active.
            </div>
          </div>
        ) : (
          activeZones.map(zone => {
            const machineWorkers = allWorkers.filter(w => {
              const mId = w.current_machine || (w.last_beacon_id ? w.last_beacon_id.split('-')[0] : '');
              return mId === zone.machine && isRecent(w.timestamp);
            });
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
              statusBadge = <div className="zone-status-pill standby">Beacon Active • Standby</div>;
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
        }))}
      </div>
    </div>
  );
};

export default ZoneMap;
