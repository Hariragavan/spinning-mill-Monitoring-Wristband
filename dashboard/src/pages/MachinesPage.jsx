import React from 'react';
import SummaryCard from '../components/SummaryCard';

const MILL_MACHINES = [
  { id: 'M1', name: 'Machine 1', type: 'Ring Spinning Frame', length: '52m', spindles: 480, zone: 'Zone A' },
  { id: 'M2', name: 'Machine 2', type: 'Ring Spinning Frame', length: '52m', spindles: 480, zone: 'Zone B' },
  { id: 'M3', name: 'Machine 3', type: 'Ring Spinning Frame', length: '52m', spindles: 480, zone: 'Zone C' },
];

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

const MachinesPage = ({ workers = {}, beacons = [] }) => {
  // Derive which workers are on which machine from real live data
  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const m = data.live.current_machine;
    if (m) {
      if (!workersByMachine[m]) workersByMachine[m] = [];
      workersByMachine[m].push({ id, ...data.live });
    }
  });

  const getMachineStatus = (machineId) => {
    const assigned = workersByMachine[machineId] || [];
    if (assigned.length > 0) {
      const isWalking = assigned.some(w => w.motion_state === 'walking');
      return isWalking ? 'running' : 'idle';
    }
    // Check if machine has any online beacons
    const hasOnlineBeacon = beacons.some(b => {
      const m = b.machine_id || (b.beacon_id ? b.beacon_id.split('-')[0] : '');
      return m === machineId && isBeaconOnline(b);
    });
    return hasOnlineBeacon ? 'standby' : 'offline';
  };

  const statusConfig = {
    running:  { label: 'Running', cls: 'status-good' },
    idle:     { label: 'Idle',    cls: 'status-idle' },
    standby:  { label: 'Standby', cls: 'status-info' },
    offline:  { label: 'Offline', cls: 'status-muted' },
  };

  const runningCount = MILL_MACHINES.filter(m => getMachineStatus(m.id) === 'running').length;
  const idleCount = MILL_MACHINES.filter(m => getMachineStatus(m.id) === 'idle').length;
  const standbyCount = MILL_MACHINES.filter(m => getMachineStatus(m.id) === 'standby').length;
  const offlineCount = MILL_MACHINES.filter(m => getMachineStatus(m.id) === 'offline').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Machines</h2>
        <p className="page-subtitle">Real-time status of spinning mill frames and beacon coverage</p>
      </div>

      {/* Summary cards */}
      <div className="summary-row">
        <SummaryCard label="Configured Frames" value={MILL_MACHINES.length} status="Ring spinning mill" icon="factory" tone="blue" />
        <SummaryCard label="Running" value={runningCount} status="Active patrol on floor" icon="activity" tone="green" />
        <SummaryCard label="Idle / Standby" value={idleCount + standbyCount} status="Monitored by beacons" icon="clock" tone="amber" />
        <SummaryCard label="Offline Frames" value={offlineCount} status={offlineCount === 0 ? 'All frames reachable' : 'Awaiting heartbeat'} icon="radio" tone={offlineCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Machine Table */}
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Machine</th>
              <th>Type</th>
              <th>Length</th>
              <th>Spindles</th>
              <th>Configured Beacons</th>
              <th>Zone</th>
              <th>Assigned Operator</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MILL_MACHINES.map((m) => {
              const status = getMachineStatus(m.id);
              const cfg = statusConfig[status];
              const assignedWorkers = workersByMachine[m.id] || [];
              const machineBeacons = beacons.filter(b => (b.machine_id === m.id) || (b.beacon_id && b.beacon_id.startsWith(m.id)));
              const beaconDisplayCount = machineBeacons.length > 0 ? machineBeacons.length : 8;

              return (
                <tr key={m.id}>
                  <td>
                    <div className="cell-primary">{m.name}</div>
                    <div className="cell-secondary">{m.id}</div>
                  </td>
                  <td>{m.type}</td>
                  <td>{m.length}</td>
                  <td>{m.spindles}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong>{beaconDisplayCount}</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        ({machineBeacons.filter(isBeaconOnline).length} online)
                      </span>
                    </div>
                  </td>
                  <td>{m.zone}</td>
                  <td>
                    {assignedWorkers.length > 0
                      ? assignedWorkers.map(w => `W${w.id.split('_')[1] || w.id}`).join(', ')
                      : <span className="text-muted">—</span>}
                  </td>
                  <td><span className={`status-badge ${cfg.cls}`}>{cfg.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Beacon Map per Machine */}
      <div className="page-header" style={{ marginTop: 12 }}>
        <h3>Beacon Station Configuration</h3>
        <p className="page-subtitle">Hardware checkpoints and physical checkpoint telemetry per spinning frame</p>
      </div>
      <div className="beacon-config-grid">
        {MILL_MACHINES.map((m) => {
          const machineBeacons = beacons.filter(b => (b.machine_id === m.id) || (b.beacon_id && b.beacon_id.startsWith(m.id)));
          const defaultStations = ['A1','A2','A3','A4','B1','B2','B3','B4'];

          return (
            <div key={m.id} className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{m.name} ({m.id})</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{m.zone}</span>
              </div>
              <div className="beacon-list">
                {defaultStations.map(station => {
                  const fullId = `${m.id}-${station}`;
                  const beaconRecord = machineBeacons.find(b => b.beacon_id === fullId);
                  const isOnline = beaconRecord ? isBeaconOnline(beaconRecord) : false;
                  const isTouched = Object.values(workers).some(w => {
                    const lastB = (w?.live?.last_beacon_id || '').toUpperCase();
                    return lastB === fullId || lastB === station;
                  });

                  let chipClass = 'beacon-chip';
                  if (isTouched) chipClass += ' beacon-active';
                  else if (isOnline) chipClass += ' beacon-online';

                  return (
                    <div
                      key={station}
                      className={chipClass}
                      title={`${fullId}: ${isTouched ? 'Worker Touch Detected' : (isOnline ? 'Online' : 'Offline')}`}
                    >
                      {station}
                      {isTouched && <span style={{ marginLeft: 4 }}>●</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MachinesPage;
