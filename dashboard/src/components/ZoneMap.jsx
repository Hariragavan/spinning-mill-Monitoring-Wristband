import React from 'react';

const WORKER_NAMES = {
  worker_1: 'Alex P.',
  worker_2: 'Raj K.',
  worker_3: 'Maria S.',
};

const WORKER_COLORS = {
  worker_1: '#3b82f6', // blue
  worker_2: '#8b5cf6', // purple
  worker_3: '#e91e63', // pink
};

// Each zone has one machine
const ZONES = [
  { id: 'zone-a', label: 'Zone A', machine: 'M1', machineName: 'Ring Frame #1' },
  { id: 'zone-b', label: 'Zone B', machine: 'M2', machineName: 'Ring Frame #2' },
  { id: 'zone-c', label: 'Zone C', machine: 'M3', machineName: 'Ring Frame #3' },
  { id: 'zone-d', label: 'Zone D', machine: null, machineName: 'Maintenance Bay' },
];

const A_BEACONS = ['A1', 'A2', 'A3', 'A4'];
const B_BEACONS = ['B1', 'B2', 'B3', 'B4'];

const ZoneMap = ({ workers, onWorkerClick }) => {
  // Build a lookup: machine -> list of workers currently on that machine
  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const machine = data.live.current_machine;
    if (!workersByMachine[machine]) workersByMachine[machine] = [];
    workersByMachine[machine].push({ id, ...data.live });
  });

  const getBeaconPositionPct = (beaconLabel) => {
    const idx = parseInt(beaconLabel.charAt(1)) - 1; // 0-3
    return 12 + idx * 25; // 12%, 37%, 62%, 87%
  };

  const getWorkerStatusClass = (live) => {
    if (live.incident_type !== 'none') return 'alert';
    if (live.motion_state === 'stationary' && live.idle_duration_sec > 10) return 'idle';
    return 'active';
  };

  const getWorkerStatusText = (live) => {
    if (live.incident_type !== 'none') return live.incident_type.replace('_', ' ');
    if (live.motion_state === 'stationary' && live.idle_duration_sec > 10) return 'IDLE';
    return 'ACTIVE';
  };

  const getWorkerBeaconPct = (live) => {
    const beaconId = live.last_beacon_id;
    if (!beaconId) return 50;
    const zone = beaconId.split('-')[1]; // e.g. "A2"
    return getBeaconPositionPct(zone);
  };

  const isOnSideA = (live) => {
    const beaconId = live.last_beacon_id;
    if (!beaconId) return true;
    return beaconId.split('-')[1].startsWith('A');
  };

  return (
    <div className="card zone-map-card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Factory Floor — Live Tracking
      </div>
      <div className="zone-grid">
        {ZONES.map((zone) => {
          const machineWorkers = zone.machine ? (workersByMachine[zone.machine] || []) : [];
          return (
            <div key={zone.id} className="zone-cell">
              <div className="zone-label">{zone.label}</div>
              <div className="zone-machine-name">{zone.machineName}</div>

              {zone.machine ? (
                <div className="machine-track">
                  {/* Side A beacon row */}
                  <div className="beacon-row">
                    {A_BEACONS.map((b) => (
                      <React.Fragment key={b}>
                        <div
                          className={`beacon-dot ${machineWorkers.some(w => w.last_beacon_id === `${zone.machine}-${b}`) ? 'active' : ''}`}
                          style={{ left: `${getBeaconPositionPct(b)}%` }}
                        />
                        <span className="beacon-label" style={{ left: `${getBeaconPositionPct(b)}%` }}>
                          {b}
                        </span>
                      </React.Fragment>
                    ))}

                    {/* Worker pills on Side A */}
                    {machineWorkers.filter(w => isOnSideA(w)).map((w) => (
                      <div
                        key={w.id}
                        className="worker-pill"
                        style={{ left: `${getWorkerBeaconPct(w)}%`, cursor: 'pointer' }}
                        onClick={() => onWorkerClick && onWorkerClick(w.id)}
                      >
                        <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#64748b' }}>
                          {w.id.split('_')[1]}
                        </div>
                        <div className="worker-pill-info">
                          <span className="worker-pill-name">W{w.id.split('_')[1]}: {WORKER_NAMES[w.id] || 'Unknown'}</span>
                          <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>
                            {getWorkerStatusText(w)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Side B beacon row */}
                  <div className="beacon-row">
                    {B_BEACONS.map((b) => (
                      <React.Fragment key={b}>
                        <div
                          className={`beacon-dot ${machineWorkers.some(w => w.last_beacon_id === `${zone.machine}-${b}`) ? 'active' : ''}`}
                          style={{ left: `${getBeaconPositionPct(b)}%` }}
                        />
                        <span className="beacon-label" style={{ left: `${getBeaconPositionPct(b)}%` }}>
                          {b}
                        </span>
                      </React.Fragment>
                    ))}

                    {/* Worker pills on Side B */}
                    {machineWorkers.filter(w => !isOnSideA(w)).map((w) => (
                      <div
                        key={w.id}
                        className="worker-pill"
                        style={{ left: `${getWorkerBeaconPct(w)}%`, cursor: 'pointer' }}
                        onClick={() => onWorkerClick && onWorkerClick(w.id)}
                      >
                        <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#64748b' }}>
                          {w.id.split('_')[1]}
                        </div>
                        <div className="worker-pill-info">
                          <span className="worker-pill-name">W{w.id.split('_')[1]}: {WORKER_NAMES[w.id] || 'Unknown'}</span>
                          <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>
                            {getWorkerStatusText(w)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="machine-track" style={{ alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 6px' }}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                    <div>No active machine</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ZoneMap;
