import React from 'react';
import SummaryCard from '../components/SummaryCard';

const MACHINE_DATA = [
  { id: 'M1', name: 'Machine 1', type: 'Ring Spinning', length: '52m', spindles: 480, beacons: 8, zone: 'Zone A' },
  { id: 'M2', name: 'Machine 2', type: 'Ring Spinning', length: '52m', spindles: 480, beacons: 8, zone: 'Zone B' },
  { id: 'M3', name: 'Machine 3', type: 'Ring Spinning', length: '52m', spindles: 480, beacons: 8, zone: 'Zone C' },
  { id: 'M4', name: 'Winding Unit #1', type: 'Auto Winding', length: '38m', spindles: 120, beacons: 6, zone: 'Zone D' },
  { id: 'M5', name: 'Draw Frame #1', type: 'Draw Frame',    length: '24m', spindles: 0,   beacons: 4, zone: 'Zone D' },
];

const MachinesPage = ({ workers }) => {
  // Derive which workers are on which machine
  const workersByMachine = {};
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const m = data.live.current_machine;
    if (!workersByMachine[m]) workersByMachine[m] = [];
    workersByMachine[m].push(id);
  });

  const getStatus = (machineId) => {
    if (workersByMachine[machineId]?.length > 0) return 'running';
    if (machineId === 'M4') return 'idle';
    if (machineId === 'M5') return 'maintenance';
    return 'idle';
  };

  const statusConfig = {
    running:     { label: 'Running',     cls: 'status-good' },
    idle:        { label: 'Idle',        cls: 'status-idle' },
    maintenance: { label: 'Maintenance', cls: 'status-alert' },
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Machines</h2>
        <p className="page-subtitle">Overview of all spinning mill machines and their current status</p>
      </div>

      {/* Summary cards */}
      <div className="summary-row">
        <SummaryCard label="Total Machines" value={MACHINE_DATA.length} status="Configured" icon="factory" tone="blue" />
        <SummaryCard label="Running" value={MACHINE_DATA.filter((_, i) => getStatus(MACHINE_DATA[i].id) === 'running').length} status="Online now" icon="activity" tone="green" />
        <SummaryCard label="Idle" value={MACHINE_DATA.filter((_, i) => getStatus(MACHINE_DATA[i].id) === 'idle').length} status="Needs monitoring" icon="clock" tone="amber" />
        <SummaryCard label="Maintenance" value={MACHINE_DATA.filter((_, i) => getStatus(MACHINE_DATA[i].id) === 'maintenance').length} status="Review required" icon="settings" tone="red" />
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
              <th>Beacons</th>
              <th>Zone</th>
              <th>Assigned Worker</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MACHINE_DATA.map((m) => {
              const status = getStatus(m.id);
              const cfg = statusConfig[status];
              const assignedWorkers = workersByMachine[m.id] || [];
              return (
                <tr key={m.id}>
                  <td>
                    <div className="cell-primary">{m.name}</div>
                    <div className="cell-secondary">{m.id}</div>
                  </td>
                  <td>{m.type}</td>
                  <td>{m.length}</td>
                  <td>{m.spindles || '\u2014'}</td>
                  <td>{m.beacons}</td>
                  <td>{m.zone}</td>
                  <td>
                    {assignedWorkers.length > 0
                      ? assignedWorkers.map(w => `W${w.split('_')[1]}`).join(', ')
                      : <span className="text-muted">\u2014</span>}
                  </td>
                  <td><span className={`status-badge ${cfg.cls}`}>{cfg.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Beacon Map per Machine */}
      <div className="page-header" style={{ marginTop: 8 }}>
        <h3>Beacon Configuration</h3>
      </div>
      <div className="beacon-config-grid">
        {MACHINE_DATA.slice(0, 3).map((m) => (
          <div key={m.id} className="card">
            <div className="card-title">{m.name} — Beacons</div>
            <div className="beacon-list">
              {['A1','A2','A3','A4','B1','B2','B3','B4'].map(b => {
                const fullId = `${m.id}-${b}`;
                const isActive = Object.values(workers).some(w => w?.live?.last_beacon_id === fullId);
                return (
                  <div key={b} className={`beacon-chip ${isActive ? 'beacon-active' : ''}`}>
                    {fullId}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MachinesPage;
