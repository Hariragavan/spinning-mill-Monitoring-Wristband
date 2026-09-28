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

const A_STATIONS = ['A1', 'A2', 'A3', 'A4'];
const B_STATIONS = ['B4', 'B3', 'B2', 'B1'];

// Simulation: fixed 3-machine, 8-beacon layout
const SIM_ZONES = [
  { id: 'zone-a', label: 'Zone A', machine: 'M1', machineName: 'Machine 1' },
  { id: 'zone-b', label: 'Zone B', machine: 'M2', machineName: 'Machine 2' },
  { id: 'zone-c', label: 'Zone C', machine: 'M3', machineName: 'Machine 3' },
  { id: 'zone-d', label: 'Zone D', machine: null, machineName: 'Maintenance Bay' },
];

function isRecent(timestamp) {
  if (!timestamp) return false;
  return (Date.now() - timestamp) < 15000;
}

function isBeaconOnline(b) {
  if (!b || b.status !== 'online') return false;
  const timeUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  const timeSeen = b.last_seen ? new Date(b.last_seen).getTime() : 0;
  const time = Math.max(timeUpdated, timeSeen);
  if (!time) return false;
  return (Date.now() - time) < 20000;
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

// ═══════════════════════════════════════════════════════════
// LIVE MODE MAP — Only shows machines with active beacons/workers
// ═══════════════════════════════════════════════════════════
const LiveZoneMap = ({ workers, beacons = [], onWorkerClick }) => {
  // 1. Identify which beacons are currently online in the mill
  const onlineBeacons = beacons.filter(isBeaconOnline);
  const onlineMachineIds = new Set(onlineBeacons.map(b => b.machine_id).filter(Boolean));

  // 2. Identify active workers (transmitting within last 10s)
  const activeWorkers = Object.entries(workers)
    .filter(([, d]) => d?.live && isRecent(d.live.timestamp))
    .map(([id, d]) => ({ id, ...d.live }));
  const workerMachineIds = new Set(activeWorkers.map(w => w.current_machine).filter(Boolean));

  // 3. Only show machines that have at least one online beacon OR active worker
  const activeMachines = [...new Set([...onlineMachineIds, ...workerMachineIds])].sort();

  // If no beacons or workers are active on the floor, show clean waiting state
  if (activeMachines.length === 0) {
    return (
      <div className="card zone-map-card">
        <div className="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><circle cx="12" cy="17" r="1"/></svg>
          Factory Floor — Live Tracking
          <span className="live-badge-small">LIVE</span>
        </div>
        <div className="live-waiting" style={{ padding: '42px 20px', textAlign: 'center' }}>
          <div className="live-waiting-pulse" />
          <h3 style={{ margin: '14px 0 6px', color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
            No Active Machine Beacons Detected
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '460px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            Machine layouts activate automatically as soon as an ESP32 station (e.g. <strong>M1-A1</strong> or <strong>M1-B4</strong>) is powered on.
          </p>
          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', color: '#64748b' }}>
            <span className="live-dot" style={{ background: '#94a3b8' }} />
            <span>Awaiting heartbeat from factory floor stations</span>
          </div>
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

      <div className="zone-grid" style={{ gridTemplateColumns: `repeat(${Math.min(activeMachines.length, 3)}, 1fr)` }}>
        {activeMachines.map(machine => {
          const machineWorkers = activeWorkers.filter(w => w.current_machine === machine);
          const machineOnlineBeacons = onlineBeacons.filter(b => b.machine_id === machine);
          const activeBeaconCount = machineOnlineBeacons.length;

          const renderStation = (code, side) => {
            const fullId = `${machine}-${code}`;
            const isOnline = machineOnlineBeacons.some(b => b.beacon_id === fullId);
            const workerHere = machineWorkers.find(w => w.last_beacon_id === fullId);

            let dotClass = 'dot-inactive';
            let labelClass = 'label-inactive';

            if (workerHere) {
              dotClass = 'dot-reached'; // Vibrant Green when touched/present
              labelClass = 'label-reached';
            } else if (isOnline) {
              dotClass = 'dot-online';  // Dark Grey when active and on
              labelClass = 'label-online';
            }

            return (
              <div key={code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px', position: 'relative' }}>
                {side === 'A' && (
                  <span className={`beacon-label ${labelClass}`} style={{ marginBottom: '6px', userSelect: 'none' }}>
                    {code}
                  </span>
                )}

                <div
                  className={`beacon-dot ${dotClass}`}
                  title={`${fullId}: ${workerHere ? 'Worker Present (10cm)' : (isOnline ? 'Online / Active' : 'Offline / Inactive')}`}
                  style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}
                />

                {side === 'B' && (
                  <span className={`beacon-label ${labelClass}`} style={{ marginTop: '6px', userSelect: 'none' }}>
                    {code}
                  </span>
                )}
              </div>
            );
          };

          return (
            <div key={machine} className="zone-cell">
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{machine}</span>
                  <span className="zone-tag">
                    {activeBeaconCount > 0 ? `${activeBeaconCount} Beacon${activeBeaconCount > 1 ? 's' : ''} Online` : 'Worker Active'}
                  </span>
                </div>
                <div className="zone-status-pill normal">
                  {machineWorkers.length > 0 ? (machineWorkers[0].motion_state === 'walking' ? 'Patrol Active' : `Idle (${machineWorkers[0].idle_duration_sec}s)`) : '✓ Online'}
                </div>
              </div>

              {/* Machine Visual Floor */}
              <div className="machine-visual-container" style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '10px 0' }}>
                {/* Side A Stations (A1, A2, A3, A4) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                  {A_STATIONS.map(code => renderStation(code, 'A'))}
                </div>

                {/* Machine Chassis / Spindle Frame Body */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  background: '#334155',
                  borderRadius: '6px',
                  height: '26px',
                  color: '#f8fafc',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                  margin: '10px 0',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  <span>{machine} — Ring Spinning Unit</span>
                  <span style={{ color: '#94a3b8', fontSize: '9.5px' }}>480 Spindles • 52m</span>
                </div>

                {/* Side B Stations (B4, B3, B2, B1) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                  {B_STATIONS.map(code => renderStation(code, 'B'))}
                </div>
              </div>

              {/* Worker Telemetry Data Rows */}
              {machineWorkers.length > 0 ? (
                <div className="live-worker-data-rows" style={{ marginTop: '8px' }}>
                  {machineWorkers.map(w => (
                    <div key={w.id} className="live-worker-data-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', textAlign: 'center', padding: '6px 4px', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Speed</div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{w.walking_speed_ms || '0.00'} m/s</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Heading</div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{w.directional_heading || 'Stationary'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Completed</div>
                        <div style={{ fontWeight: 700, color: '#2563eb' }}>{w.lap_count || 0} Laps</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Lap Duration</div>
                        <div style={{ fontWeight: 600, color: '#0284c7' }}>{w.lap_duration_sec || 0}s</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Idle Time</div>
                        <div style={{ fontWeight: 700, color: w.idle_duration_sec >= 3 ? '#dc2626' : '#16a34a' }}>
                          {w.idle_duration_sec || 0}s
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', padding: '6px 0' }}>
                  No operator currently stationed
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
// SIMULATION MODE MAP (Kept intact for simulation testing)
// ═══════════════════════════════════════════════════════════
const SimZoneMap = ({ workers, onWorkerClick }) => {
  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const machine = data.live.current_machine;
    if (!workersByMachine[machine]) workersByMachine[machine] = [];
    workersByMachine[machine].push({ id, ...data.live });
  });

  return (
    <div className="card zone-map-card">
      <div className="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Factory Floor — Simulation Mode
      </div>
      <div className="zone-grid">
        {SIM_ZONES.map(zone => {
          const machineWorkers = zone.machine ? (workersByMachine[zone.machine] || []) : [];
          return (
            <div key={zone.id} className="zone-cell">
              <div className="zone-cell-header">
                <div className="zone-title-group">
                  <span className="zone-machine-title">{zone.machineName}</span>
                  <span className="zone-tag">{zone.label}</span>
                </div>
              </div>
              <div className="machine-visual-container">
                <div className="machine-body-bar" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT EXPORT
// ═══════════════════════════════════════════════════════════
const ZoneMap = ({ workers, beacons = [], onWorkerClick, dataMode }) => {
  if (dataMode === 'live') {
    return <LiveZoneMap workers={workers} beacons={beacons} onWorkerClick={onWorkerClick} />;
  }
  return <SimZoneMap workers={workers} onWorkerClick={onWorkerClick} />;
};

export default ZoneMap;
