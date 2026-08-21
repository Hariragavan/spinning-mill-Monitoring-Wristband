import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, ChevronRight, AlertTriangle, UserRound } from 'lucide-react';

const WORKER_PROFILES = {
  worker_1: { name: 'Alex Patel',  role: 'Senior Operator', shift: 'Morning (6AM\u20132PM)',  avatar: 'AP' },
  worker_2: { name: 'Raj Kumar',   role: 'Operator',        shift: 'Morning (6AM\u20132PM)',  avatar: 'RK' },
  worker_3: { name: 'Maria Singh', role: 'Operator',        shift: 'Morning (6AM\u20132PM)',  avatar: 'MS' },
  worker_4: { name: 'Priya Devi',  role: 'Junior Operator', shift: 'Afternoon (2PM\u201310PM)', avatar: 'PD' },
  worker_5: { name: 'Arun Yadav',  role: 'Senior Operator', shift: 'Afternoon (2PM\u201310PM)', avatar: 'AY' },
  worker_6: { name: 'Sita Ram',    role: 'Operator',        shift: 'Night (10PM\u20136AM)',   avatar: 'SR' },
};

const COLORS = ['#3b82f6', '#8b5cf6', '#e91e63', '#14b8a6', '#f59e0b', '#6366f1'];
const OFFLINE_AFTER_MS = 15000;

const getStatus = (live) => {
  if (!live) return { key: 'off-shift', label: 'Off Shift', cls: 'status-muted', priority: 1 };
  if (live.timestamp && Date.now() - live.timestamp > OFFLINE_AFTER_MS) return { key: 'offline', label: 'Offline', cls: 'status-alert', priority: 0 };
  if (live.incident_type && live.incident_type !== 'none') return { key: 'incident', label: live.incident_type.replace('_', ' '), cls: 'status-alert', priority: 0 };
  if (live.wristband_battery_pct < 20) return { key: 'low-battery', label: 'Low Battery', cls: 'status-alert', priority: 0 };
  if (live.break_mode && live.break_mode !== 'none') return { key: 'break', label: 'On Break', cls: 'status-idle', priority: 1 };
  if (live.motion_state === 'stationary') return { key: 'idle', label: 'Idle', cls: 'status-idle', priority: 1 };
  return { key: 'active', label: 'Active', cls: 'status-good', priority: 2 };
};

const OperatorsPage = ({ workers, onWorkerClick }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attention');
  const allWorkerIds = [...new Set([...Object.keys(WORKER_PROFILES), ...Object.keys(workers)])];
  const allWorkers = Object.fromEntries(allWorkerIds.map(id => [id, WORKER_PROFILES[id] || { name: `Worker ${id.split('_')[1] || id}`, role: 'Unassigned', shift: 'Unknown', avatar: '?' }]));
  const mergedList = Object.entries(allWorkers).map(([id, profile], idx) => {
    const live = workers[id]?.live || null;
    return { id, ...profile, live, status: getStatus(live), color: COLORS[idx % COLORS.length] };
  });
  const machines = [...new Set(mergedList.map(worker => worker.live?.current_machine).filter(Boolean))].sort();
  const filteredList = mergedList.filter(worker => {
    const searchable = `${worker.name} ${worker.id} ${worker.role}`.toLowerCase();
    return searchable.includes(query.toLowerCase()) && (statusFilter === 'all' || worker.status.key === statusFilter) && (machineFilter === 'all' || worker.live?.current_machine === machineFilter);
  }).sort((a, b) => {
    if (sortBy === 'attention') return a.status.priority - b.status.priority || a.name.localeCompare(b.name);
    if (sortBy === 'battery') return (a.live?.wristband_battery_pct ?? -1) - (b.live?.wristband_battery_pct ?? -1);
    if (sortBy === 'rounds') return (b.live?.lap_count ?? -1) - (a.live?.lap_count ?? -1);
    if (sortBy === 'idle') return (b.live?.idle_duration_sec ?? -1) - (a.live?.idle_duration_sec ?? -1);
    return a.name.localeCompare(b.name);
  });
  const activeCount = mergedList.filter(worker => worker.status.key === 'active').length;
  const liveCount = mergedList.filter(worker => worker.live && worker.status.key !== 'offline').length;
  const attentionCount = mergedList.filter(worker => ['incident', 'offline', 'low-battery'].includes(worker.status.key)).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Operators</h2>
        <p className="page-subtitle">Live operator visibility, patrol activity, and device health</p>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-value">{mergedList.length}</div>
          <div className="summary-label">Registered Operators</div>
        </div>
        <div className="summary-card">
          <div className="summary-value green">{liveCount}</div>
          <div className="summary-label">Live Wristbands</div>
        </div>
        <div className="summary-card">
          <div className="summary-value green">{activeCount}</div>
          <div className="summary-label">Currently Active</div>
        </div>
        <div className="summary-card">
          <div className="summary-value red">{attentionCount}</div>
          <div className="summary-label">Needs Attention</div>
        </div>
      </div>

      <div className="operator-toolbar">
        <label className="operator-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search operators" aria-label="Search operators" /></label>
        <label className="operator-select"><SlidersHorizontal size={15} aria-hidden="true" /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="idle">Idle</option><option value="break">On break</option><option value="incident">Incident</option><option value="low-battery">Low battery</option><option value="offline">Offline</option><option value="off-shift">Off shift</option></select></label>
        <label className="operator-select"><select value={machineFilter} onChange={event => setMachineFilter(event.target.value)} aria-label="Filter by machine"><option value="all">All machines</option>{machines.map(machine => <option key={machine} value={machine}>{machine}</option>)}</select></label>
        <label className="operator-select operator-sort"><ArrowUpDown size={15} aria-hidden="true" /><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort operators"><option value="attention">Sort: attention</option><option value="name">Sort: name</option><option value="battery">Sort: battery</option><option value="rounds">Sort: rounds</option><option value="idle">Sort: idle time</option></select></label>
      </div>

      <div className="card table-card">
        <div className="operator-table-scroll"><table className="operator-table">
          <thead>
            <tr>
              <th>Operator</th>
              <th>Role / Shift</th>
              <th>Location</th>
              <th>Activity</th>
              <th>Rounds</th>
              <th>Battery</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredList.map((w) => {
              const activity = w.live?.motion_state === 'walking' ? `${w.live.steps_per_min_cadence || 0} spm` : w.live ? `${Math.floor((w.live.idle_duration_sec || 0) / 60)}m idle` : '-';
              return (
                <tr key={w.id} className={`interactive-row ${w.status.priority === 0 ? 'row-highlight' : ''}`} onClick={() => w.live && onWorkerClick(w.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="table-avatar" style={{ background: w.color }}>{w.avatar}</div>
                      <div>
                        <div className="cell-primary">{w.name}</div>
                        <div className="cell-secondary">{w.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><div className="cell-primary">{w.role}</div><div className="cell-secondary">{w.shift}</div></td>
                  <td>{w.live ? <><div className="cell-primary">{w.live.current_machine}</div><div className="cell-secondary">{w.live.last_beacon_id} - {w.live.current_zone}</div></> : '-'}</td>
                  <td>{w.live ? <><div className="cell-primary">{activity}</div><div className="cell-secondary">{w.live.total_steps.toLocaleString()} steps</div></> : '-'}</td>
                  <td>{w.live ? w.live.lap_count : '\u2014'}</td>
                  <td>
                    {w.live ? (
                      <div className="battery-indicator">
                        <div className="battery-bar" style={{ width: `${w.live.wristband_battery_pct}%`, background: w.live.wristband_battery_pct < 20 ? 'var(--red)' : 'var(--green)' }} />
                        <span>{w.live.wristband_battery_pct}%</span>
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td><span className={`status-badge ${w.status.cls}`}>{w.status.key === 'incident' && <AlertTriangle size={12} />}{w.status.label}</span></td>
                  <td><button className="icon-button" onClick={event => { event.stopPropagation(); if (w.live) onWorkerClick(w.id); }} aria-label={`View ${w.name}`} title="View operator details"><ChevronRight size={17} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {filteredList.length === 0 && <div className="operator-empty"><UserRound size={22} /><span>No operators match these filters.</span></div>}
      </div>
    </div>
  );
};

export default OperatorsPage;
