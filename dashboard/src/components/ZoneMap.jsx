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
  { id: 'zone-a', label: 'Zone A', machine: 'M1', machineName: 'Machine 1' },
  { id: 'zone-b', label: 'Zone B', machine: 'M2', machineName: 'Machine 2' },
  { id: 'zone-c', label: 'Zone C', machine: 'M3', machineName: 'Machine 3' },
  { id: 'zone-d', label: 'Zone D', machine: null, machineName: 'Maintenance Bay' },
];

const A_BEACONS = ['A1', 'A2', 'A3', 'A4'];
const B_BEACONS = ['B1', 'B2', 'B3', 'B4'];

const ZoneMap = ({ workers, onWorkerClick }) => {
  const [visitedBeacons, setVisitedBeacons] = React.useState({});

  React.useEffect(() => {
    setVisitedBeacons(prev => {
      const next = { ...prev };
      let updated = false;
      Object.values(workers).forEach(w => {
        if (w.live?.last_beacon_id && w.live?.current_machine) {
          const beaconKey = `${w.live.current_machine}-${w.live.last_beacon_id.split('-')[1]}`;
          if (!next[beaconKey] || (Date.now() - next[beaconKey]) > 3000) {
            next[beaconKey] = Date.now();
            updated = true;
          }
        }
      });
      return updated ? next : prev;
    });
  }, [workers]);

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

  const getBeaconDotClass = (zoneMachine, beaconCode, machineWorkers) => {
    const fullBeaconId = `${zoneMachine}-${beaconCode}`;
    const workerOnBeacon = machineWorkers.find(w => w.last_beacon_id === fullBeaconId);
    
    if (workerOnBeacon) {
      const status = getWorkerStatusClass(workerOnBeacon);
      if (status === 'alert' || status === 'idle') {
        return 'visited-active alert blink-red';
      }
      return 'visited-active';
    }

    const lastTime = visitedBeacons[fullBeaconId];
    if (lastTime && (Date.now() - lastTime) < 5000) {
      return 'visited-fade';
    }

    return '';
  };

  const getZoneStatusReason = (machineWorkers) => {
    if (!machineWorkers || machineWorkers.length === 0) {
      return { text: 'No Active Worker', type: 'empty' };
    }

    // 1. Check for active incidents (yarn break, elec break, spindle jam, machine break)
    const incidentWorker = machineWorkers.find(w => w.incident_type && w.incident_type !== 'none');
    if (incidentWorker) {
      const type = incidentWorker.incident_type;
      if (type === 'elec_break') return { text: '⚡ Elec Break (Machine Stopped)', type: 'alert' };
      if (type === 'yarn_break') return { text: '🧶 Yarn Break Detected', type: 'alert' };
      if (type === 'spindle_jam') return { text: '🔧 Spindle Jam Issue', type: 'alert' };
      if (type === 'machine_break') return { text: '⚠️ Machine Breakdown', type: 'alert' };
      return { text: `⚠️ ${type.replace('_', ' ')}`, type: 'alert' };
    }

    // 2. Check for break time (restroom, tea break, lunch)
    const breakWorker = machineWorkers.find(w => w.break_mode && w.break_mode !== 'none');
    if (breakWorker) {
      const b = breakWorker.break_mode;
      if (b === 'restroom') return { text: '🚻 Break Time (Restroom)', type: 'break' };
      if (b === 'tea_break') return { text: '☕ Tea Break', type: 'break' };
      if (b === 'lunch') return { text: '🍱 Lunch Break', type: 'break' };
      return { text: `☕ Break (${b})`, type: 'break' };
    }

    // 3. Check for idle / stopped worker
    const idleWorker = machineWorkers.find(w => w.motion_state === 'stationary' && w.idle_duration_sec > 10);
    if (idleWorker) {
      return { text: `⏸ Worker Idle (${idleWorker.idle_duration_sec}s)`, type: 'idle' };
    }

    return { text: '✓ Running Normally', type: 'normal' };
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
          const hasZoneAlert = machineWorkers.some(w => getWorkerStatusClass(w) !== 'active');
          const reason = getZoneStatusReason(machineWorkers);
          return (
            <div key={zone.id} className={`zone-cell ${hasZoneAlert ? 'zone-cell-alert-yellow' : ''}`}>
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{zone.machineName}</span>
                  <span className={`zone-tag ${hasZoneAlert ? 'zone-tag-alert-yellow' : ''}`}>{zone.label}</span>
                </div>
                {zone.machine && (
                  <div className={`zone-status-pill ${reason.type}`}>
                    {reason.text}
                  </div>
                )}
              </div>

              {zone.machine ? (
                <div className="machine-visual-container">
                  {/* Side A Beacon Row (Top) */}
                  <div className="beacon-side side-a">
                    {A_BEACONS.map((b) => (
                      <React.Fragment key={b}>
                        <div
                          className={`beacon-dot ${getBeaconDotClass(zone.machine, b, machineWorkers)}`}
                          style={{ left: `${getBeaconPositionPct(b)}%` }}
                        />
                        <span className="beacon-label beacon-label-top" style={{ left: `${getBeaconPositionPct(b)}%` }}>
                          {b}
                        </span>
                      </React.Fragment>
                    ))}

                    {/* Active Moving Point under worker pill on Side A */}
                    {machineWorkers.filter(w => isOnSideA(w)).map((w) => (
                      <div
                        key={`dot-${w.id}`}
                        className={`worker-track-dot ${getWorkerStatusClass(w) !== 'active' ? 'alert-dot' : 'active-dot'} ${w.motion_state === 'walking' ? 'moving' : ''}`}
                        style={{ left: `${getWorkerBeaconPct(w)}%` }}
                      />
                    ))}

                    {/* Worker pills on Side A */}
                    {machineWorkers.filter(w => isOnSideA(w)).map((w) => (
                      <div
                        key={w.id}
                        className={`worker-pill worker-pill-top ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
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

                  {/* Machine Line/Bar */}
                  <div className="machine-body-bar" />

                  {/* Side B Beacon Row (Bottom) */}
                  <div className="beacon-side side-b">
                    {B_BEACONS.map((b) => (
                      <React.Fragment key={b}>
                        <div
                          className={`beacon-dot ${getBeaconDotClass(zone.machine, b, machineWorkers)}`}
                          style={{ left: `${getBeaconPositionPct(b)}%` }}
                        />
                        <span className="beacon-label beacon-label-bottom" style={{ left: `${getBeaconPositionPct(b)}%` }}>
                          {b}
                        </span>
                      </React.Fragment>
                    ))}

                    {/* Active Moving Point under worker pill on Side B */}
                    {machineWorkers.filter(w => !isOnSideA(w)).map((w) => (
                      <div
                        key={`dot-${w.id}`}
                        className={`worker-track-dot ${getWorkerStatusClass(w) !== 'active' ? 'alert-dot' : 'active-dot'} ${w.motion_state === 'walking' ? 'moving' : ''}`}
                        style={{ left: `${getWorkerBeaconPct(w)}%` }}
                      />
                    ))}

                    {/* Worker pills on Side B */}
                    {machineWorkers.filter(w => !isOnSideA(w)).map((w) => (
                      <div
                        key={w.id}
                        className={`worker-pill worker-pill-bottom ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
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
