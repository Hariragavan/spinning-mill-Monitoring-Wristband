import React from 'react';

const WORKER_NAMES = {
  worker_1: 'Worker 1',
  worker_2: 'Worker 2',
  worker_3: 'Worker 3',
};

const WORKER_COLORS = {
  worker_1: '#3b82f6',
  worker_2: '#8b5cf6',
  worker_3: '#e91e63',
};

// Simulation: fixed 3-machine, 8-beacon layout
const SIM_ZONES = [
  { id: 'zone-a', label: 'Zone A', machine: 'M1', machineName: 'Machine 1' },
  { id: 'zone-b', label: 'Zone B', machine: 'M2', machineName: 'Machine 2' },
  { id: 'zone-c', label: 'Zone C', machine: 'M3', machineName: 'Machine 3' },
  { id: 'zone-d', label: 'Zone D', machine: null, machineName: 'Maintenance Bay' },
];
const A_BEACONS = ['A1', 'A2', 'A3', 'A4'];
const B_BEACONS = ['B1', 'B2', 'B3', 'B4'];

// ── Live mode: detect zones/beacons dynamically from real data ──
function detectLiveLayout(workers) {
  const machineSet = new Set();
  const beaconsByMachine = {};

  Object.values(workers).forEach(w => {
    if (!w?.live) return;
    const machine = w.live.current_machine;
    const beacon = w.live.last_beacon_id; // e.g. "M1-A2"
    if (machine) {
      machineSet.add(machine);
      if (!beaconsByMachine[machine]) beaconsByMachine[machine] = new Set();
      if (beacon) {
        const beaconCode = beacon.split('-')[1]; // "A2"
        beaconsByMachine[machine].add(beaconCode);
      }
    }
  });

  return { machines: [...machineSet].sort(), beaconsByMachine };
}

// Returns true if device data is recent (within 15s)
function isRecent(timestamp) {
  if (!timestamp) return false;
  return (Date.now() - timestamp) < 15000;
}

// ─── Worker position ───────────────────────────────────────────
function getWorkerStatusClass(live) {
  if (live.assistance_request_flag) return 'alert';
  if (live.incident_type && live.incident_type !== 'none') return 'alert';
  if (live.motion_state === 'stationary' && live.idle_duration_sec > 10) return 'idle';
  return 'active';
}

function getWorkerStatusText(live) {
  if (live.assistance_request_flag) return 'HELP!';
  if (live.incident_type && live.incident_type !== 'none') return live.incident_type.replace('_', ' ');
  if (live.motion_state === 'stationary' && live.idle_duration_sec > 10) return 'IDLE';
  return 'ACTIVE';
}

// ─── Sim mode: beacon position from A1-A4 / B1-B4 label ───────
function getSimBeaconPct(beaconLabel) {
  const idx = parseInt(beaconLabel.charAt(1)) - 1;
  return 12 + idx * 25;
}

function getSimWorkerBeaconPct(live) {
  const beaconId = live.last_beacon_id;
  if (!beaconId) return 50;
  return getSimBeaconPct(beaconId.split('-')[1]);
}

function isOnSideA(live) {
  const beaconId = live.last_beacon_id;
  if (!beaconId) return true;
  return beaconId.split('-')[1]?.startsWith('A');
}

// ─── Live mode: beacon position from index in detected beacons ─
function getLiveBeaconPct(beaconCode, allBeacons) {
  const idx = allBeacons.indexOf(beaconCode);
  if (idx === -1) return 50;
  const spacing = 100 / (allBeacons.length + 1);
  return spacing * (idx + 1);
}

// ─── Zone status banner ────────────────────────────────────────
function getZoneStatusReason(machineWorkers) {
  if (!machineWorkers || machineWorkers.length === 0) {
    return { text: 'No Active Worker', type: 'empty' };
  }
  const assistWorker = machineWorkers.find(w => w.assistance_request_flag);
  if (assistWorker) return { text: '🆘 Assistance Requested', type: 'alert' };

  const incidentWorker = machineWorkers.find(w => w.incident_type && w.incident_type !== 'none');
  if (incidentWorker) {
    const t = incidentWorker.incident_type;
    if (t === 'elec_break') return { text: '⚡ Elec Break (Machine Stopped)', type: 'alert' };
    if (t === 'yarn_break') return { text: '🧶 Yarn Break Detected', type: 'alert' };
    if (t === 'spindle_jam') return { text: '🔧 Spindle Jam Issue', type: 'alert' };
    if (t === 'machine_break') return { text: '⚠️ Machine Breakdown', type: 'alert' };
    return { text: `⚠️ ${t.replace('_', ' ')}`, type: 'alert' };
  }
  const idleWorker = machineWorkers.find(w => w.motion_state === 'stationary' && w.idle_duration_sec > 10);
  if (idleWorker) return { text: `⏸ Worker Idle (${idleWorker.idle_duration_sec}s)`, type: 'idle' };
  return { text: '✓ Running Normally', type: 'normal' };
}


// ═══════════════════════════════════════════════════════════
// LIVE MODE MAP  — renders only detected machines/beacons
// ═══════════════════════════════════════════════════════════
const LiveZoneMap = ({ workers, onWorkerClick }) => {
  const { machines, beaconsByMachine } = detectLiveLayout(workers);

  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const m = data.live.current_machine;
    if (!workersByMachine[m]) workersByMachine[m] = [];
    workersByMachine[m].push({ id, ...data.live });
  });

  if (machines.length === 0) {
    return (
      <div className="card zone-map-card">
        <div className="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><circle cx="12" cy="17" r="1"/></svg>
          Factory Floor — Live Tracking
        </div>
        <div className="live-waiting">
          <div className="live-waiting-pulse" />
          <div className="live-waiting-text">Waiting for device data…</div>
          <div className="live-waiting-sub">Make sure the ESP32 gateway is powered on and connected to the same network.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card zone-map-card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><path d="M2 11a10 10 0 0 1 20 0"/><circle cx="12" cy="17" r="1"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        Factory Floor — Live Tracking
        <span className="live-badge-small">LIVE</span>
      </div>
      <div className="zone-grid" style={{ gridTemplateColumns: `repeat(${Math.min(machines.length, 3)}, 1fr)` }}>
        {machines.map(machine => {
          const machineWorkers = workersByMachine[machine] || [];
          const beacons = [...(beaconsByMachine[machine] || [])].sort();
          const reason = getZoneStatusReason(machineWorkers);
          const hasAlert = reason.type === 'alert' || reason.type === 'idle';

          return (
            <div key={machine} className={`zone-cell ${hasAlert ? 'zone-cell-alert-yellow' : ''}`}>
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{machine}</span>
                  <span className={`zone-tag ${hasAlert ? 'zone-tag-alert-yellow' : ''}`}>Active</span>
                </div>
                <div className={`zone-status-pill ${reason.type}`}>{reason.text}</div>
              </div>

              {/* Machine visual */}
              <div className="machine-visual-container">
                {/* Beacon dots row */}
                <div className="beacon-side side-a" style={{ position: 'relative', height: '60px' }}>
                  {beacons.map((b, bIdx) => {
                    const pct = getLiveBeaconPct(b, beacons);
                    const fullId = `${machine}-${b}`;
                    const workerHere = machineWorkers.find(w => w.last_beacon_id === fullId);
                    const dotClass = workerHere ? 'visited-active' : '';
                    return (
                      <React.Fragment key={b}>
                        <div
                          className={`beacon-dot ${dotClass}`}
                          style={{ left: `${pct}%`, position: 'absolute', top: '32px' }}
                        />
                        <span
                          className="beacon-label beacon-label-top"
                          style={{ left: `${pct}%`, position: 'absolute', top: '10px' }}
                        >
                          {b}
                        </span>
                      </React.Fragment>
                    );
                  })}

                  {/* Worker pills */}
                  {machineWorkers.map(w => {
                    const beaconCode = w.last_beacon_id?.split('-')[1];
                    const pct = beaconCode ? getLiveBeaconPct(beaconCode, beacons) : 50;
                    const recent = isRecent(w.timestamp);
                    const statusClass = getWorkerStatusClass(w);
                    return (
                      <div
                        key={w.id}
                        className={`worker-pill worker-pill-top ${statusClass !== 'active' ? 'pill-alert-blink' : ''} ${!recent ? 'worker-pill-stale' : ''}`}
                        style={{ left: `${pct}%`, cursor: 'pointer' }}
                        onClick={() => onWorkerClick && onWorkerClick(w.id)}
                      >
                        <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#64748b' }}>
                          {(w.id || 'W').slice(-1)}
                        </div>
                        <div className="worker-pill-info">
                          <span className="worker-pill-name">{WORKER_NAMES[w.id] || w.device_id}</span>
                          <span className={`worker-pill-status ${statusClass}`}>
                            {!recent ? 'STALE' : getWorkerStatusText(w)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="machine-body-bar" />
              </div>

              {/* Worker data rows */}
              {machineWorkers.length > 0 && (
                <div className="live-worker-data-rows">
                  {machineWorkers.map(w => (
                    <div key={w.id} className="live-worker-data-row">
                      <span className="live-wd-label">Speed</span>
                      <span className="live-wd-value">{w.walking_speed_ms} m/s</span>
                      <span className="live-wd-label">Heading</span>
                      <span className="live-wd-value">{w.directional_heading}</span>
                      <span className="live-wd-label">Laps</span>
                      <span className="live-wd-value">{w.lap_count}</span>
                      <span className="live-wd-label">Idle</span>
                      <span className="live-wd-value">{w.idle_duration_sec}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════
// SIMULATION MODE MAP  — original static 8-beacon layout
// ═══════════════════════════════════════════════════════════
const SimZoneMap = ({ workers, onWorkerClick }) => {
  const [visitedBeacons, setVisitedBeacons] = React.useState({});

  React.useEffect(() => {
    const now = Date.now();
    setVisitedBeacons(prev => {
      const next = { ...prev };
      let updated = false;
      Object.values(workers).forEach(w => {
        if (w.live?.last_beacon_id && w.live?.current_machine) {
          const key = `${w.live.current_machine}-${w.live.last_beacon_id.split('-')[1]}`;
          if (!next[key] || (now - next[key]) > 3000) { next[key] = now; updated = true; }
        }
      });
      return updated ? next : prev;
    });
  }, [workers]);

  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const machine = data.live.current_machine;
    if (!workersByMachine[machine]) workersByMachine[machine] = [];
    workersByMachine[machine].push({ id, ...data.live });
  });

  const getBeaconDotClass = (zoneMachine, beaconCode, machineWorkers) => {
    const fullId = `${zoneMachine}-${beaconCode}`;
    const workerHere = machineWorkers.find(w => w.last_beacon_id === fullId);
    if (workerHere) {
      const st = getWorkerStatusClass(workerHere);
      return st !== 'active' ? 'visited-active alert blink-red' : 'visited-active';
    }
    const lastTime = visitedBeacons[fullId];
    if (lastTime && (Date.now() - lastTime) < 5000) return 'visited-fade';
    return '';
  };

  return (
    <div className="card zone-map-card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Factory Floor — Live Tracking
      </div>
      <div className="zone-grid">
        {SIM_ZONES.map(zone => {
          const machineWorkers = zone.machine ? (workersByMachine[zone.machine] || []) : [];
          const reason = getZoneStatusReason(machineWorkers);
          const hasAlert = reason.type === 'alert' || reason.type === 'idle';

          return (
            <div key={zone.id} className={`zone-cell ${hasAlert ? 'zone-cell-alert-yellow' : ''}`}>
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{zone.machineName}</span>
                  <span className={`zone-tag ${hasAlert ? 'zone-tag-alert-yellow' : ''}`}>{zone.label}</span>
                </div>
                {zone.machine && (
                  <div className={`zone-status-pill ${reason.type}`}>{reason.text}</div>
                )}
              </div>

              {zone.machine ? (
                <div className="machine-visual-container">
                  {/* Side A */}
                  <div className="beacon-side side-a">
                    {A_BEACONS.map(b => (
                      <React.Fragment key={b}>
                        <div className={`beacon-dot ${getBeaconDotClass(zone.machine, b, machineWorkers)}`} style={{ left: `${getSimBeaconPct(b)}%` }} />
                        <span className="beacon-label beacon-label-top" style={{ left: `${getSimBeaconPct(b)}%` }}>{b}</span>
                      </React.Fragment>
                    ))}
                    {machineWorkers.filter(w => isOnSideA(w)).map(w => (
                      <React.Fragment key={w.id}>
                        <div className={`worker-track-dot ${getWorkerStatusClass(w) !== 'active' ? 'alert-dot' : 'active-dot'} ${w.motion_state === 'walking' ? 'moving' : ''}`} style={{ left: `${getSimWorkerBeaconPct(w)}%` }} />
                        <div
                          className={`worker-pill worker-pill-top ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
                          style={{ left: `${getSimWorkerBeaconPct(w)}%`, cursor: 'pointer' }}
                          onClick={() => onWorkerClick && onWorkerClick(w.id)}
                        >
                          <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#64748b' }}>{w.id.split('_')[1]}</div>
                          <div className="worker-pill-info">
                            <span className="worker-pill-name">W{w.id.split('_')[1]}: {WORKER_NAMES[w.id] || 'Unknown'}</span>
                            <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>{getWorkerStatusText(w)}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="machine-body-bar" />

                  {/* Side B */}
                  <div className="beacon-side side-b">
                    {B_BEACONS.map(b => (
                      <React.Fragment key={b}>
                        <div className={`beacon-dot ${getBeaconDotClass(zone.machine, b, machineWorkers)}`} style={{ left: `${getSimBeaconPct(b)}%` }} />
                        <span className="beacon-label beacon-label-bottom" style={{ left: `${getSimBeaconPct(b)}%` }}>{b}</span>
                      </React.Fragment>
                    ))}
                    {machineWorkers.filter(w => !isOnSideA(w)).map(w => (
                      <React.Fragment key={w.id}>
                        <div className={`worker-track-dot ${getWorkerStatusClass(w) !== 'active' ? 'alert-dot' : 'active-dot'} ${w.motion_state === 'walking' ? 'moving' : ''}`} style={{ left: `${getSimWorkerBeaconPct(w)}%` }} />
                        <div
                          className={`worker-pill worker-pill-bottom ${getWorkerStatusClass(w) !== 'active' ? 'pill-alert-blink' : ''}`}
                          style={{ left: `${getSimWorkerBeaconPct(w)}%`, cursor: 'pointer' }}
                          onClick={() => onWorkerClick && onWorkerClick(w.id)}
                        >
                          <div className="worker-pill-avatar" style={{ background: WORKER_COLORS[w.id] || '#64748b' }}>{w.id.split('_')[1]}</div>
                          <div className="worker-pill-info">
                            <span className="worker-pill-name">W{w.id.split('_')[1]}: {WORKER_NAMES[w.id] || 'Unknown'}</span>
                            <span className={`worker-pill-status ${getWorkerStatusClass(w)}`}>{getWorkerStatusText(w)}</span>
                          </div>
                        </div>
                      </React.Fragment>
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


// ═══════════════════════════════════════════════════════════
// MAIN EXPORT: Picks Live or Sim map based on dataMode prop
// ═══════════════════════════════════════════════════════════
const ZoneMap = ({ workers, onWorkerClick, dataMode }) => {
  if (dataMode === 'live') {
    return <LiveZoneMap workers={workers} onWorkerClick={onWorkerClick} />;
  }
  return <SimZoneMap workers={workers} onWorkerClick={onWorkerClick} />;
};

export default ZoneMap;
