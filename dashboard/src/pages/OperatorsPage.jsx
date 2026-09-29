import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, ChevronRight, AlertTriangle, UserRound } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';

const KNOWN_PROFILES = {
  worker_1: { name: 'Alex Patel',  role: 'Senior Operator', shift: 'Morning (6AM–2PM)',  avatar: 'AP' },
  worker_2: { name: 'Raj Kumar',   role: 'Operator',        shift: 'Morning (6AM–2PM)',  avatar: 'RK' },
  worker_3: { name: 'Maria Singh', role: 'Operator',        shift: 'Morning (6AM–2PM)',  avatar: 'MS' },
};

const COLORS = ['#3b82f6', '#8b5cf6', '#e91e63', '#14b8a6', '#f59e0b', '#6366f1'];
const OFFLINE_AFTER_MS = 25000;

const getStatus = (live) => {
  if (!live) return { key: 'off-shift', label: 'Off Shift', cls: 'status-muted', priority: 1 };
  if (live.timestamp && Date.now() - live.timestamp > OFFLINE_AFTER_MS) return { key: 'offline', label: 'Offline', cls: 'status-alert', priority: 0 };
  if (live.incident_type && live.incident_type !== 'none') return { key: 'incident', label: live.incident_type.replace('_', ' '), cls: 'status-alert', priority: 0 };
  if (live.wristband_battery_pct < 20) return { key: 'low-battery', label: 'Low Battery', cls: 'status-alert', priority: 0 };
  if (live.break_mode && live.break_mode !== 'none') return { key: 'break', label: 'On Break', cls: 'status-idle', priority: 1 };
  if (live.motion_state === 'stationary' && (live.idle_duration_sec >= 3)) return { key: 'idle', label: `Idle (${live.idle_duration_sec}s)`, cls: 'status-idle', priority: 1 };
  return { key: 'active', label: 'Active', cls: 'status-good', priority: 2 };
};

const OperatorsPage = ({ workers = {}, onWorkerClick }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attention');

  // ONLY include actual workers present in the database (workers prop)
  const actualWorkerIds = Object.keys(workers);

  const mergedList = actualWorkerIds.map((id, idx) => {
    const live = workers[id]?.live || null;
    const profile = KNOWN_PROFILES[id] || {
      name: live?.device_id || `Operator ${id.split('_')[1] || id}`,
      role: 'Spinning Frame Operator',
      shift: 'Morning (6AM–2PM)',
      avatar: `O${id.split('_')[1] || '1'}`
    };
    return {
      id,
      ...profile,
      live,
      status: getStatus(live),
      color: COLORS[idx % COLORS.length]
    };
  });

  const machines = [...new Set(mergedList.map(w => w.live?.current_machine).filter(Boolean))].sort();

  const filteredList = mergedList.filter(worker => {
    const searchable = `${worker.name} ${worker.id} ${worker.role} ${worker.live?.device_id || ''}`.toLowerCase();
    return searchable.includes(query.toLowerCase())
      && (statusFilter === 'all' || worker.status.key === statusFilter)
      && (machineFilter === 'all' || worker.live?.current_machine === machineFilter);
  }).sort((a, b) => {
    if (sortBy === 'attention') return a.status.priority - b.status.priority || a.name.localeCompare(b.name);
    if (sortBy === 'battery') return (a.live?.wristband_battery_pct ?? -1) - (b.live?.wristband_battery_pct ?? -1);
    if (sortBy === 'rounds') return (b.live?.lap_count ?? -1) - (a.live?.lap_count ?? -1);
    if (sortBy === 'idle') return (b.live?.idle_duration_sec ?? -1) - (a.live?.idle_duration_sec ?? -1);
    return a.name.localeCompare(b.name);
  });

  const activeCount = mergedList.filter(w => w.status.key === 'active').length;
  const liveCount = mergedList.filter(w => w.live && w.status.key !== 'offline').length;
  const attentionCount = mergedList.filter(w => ['incident', 'offline', 'low-battery'].includes(w.status.key)).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Operators</h2>
        <p className="page-subtitle">Live operator tracking, patrol status, and hardware health</p>
      </div>

      <div className="summary-row">
        <SummaryCard label="Registered Operators" value={mergedList.length} status="Database records" icon="user" tone="blue" />
        <SummaryCard label="Live Wristbands" value={liveCount} status="Connected to floor" icon="radio" tone="green" />
        <SummaryCard label="Currently Patrolling" value={activeCount} status="Active on patrol" icon="activity" tone="green" />
        <SummaryCard label="Needs Attention" value={attentionCount} status={attentionCount > 0 ? 'Review required' : 'All operators normal'} icon="alerts" tone={attentionCount > 0 ? 'red' : 'green'} />
      </div>

      <div className="operator-toolbar">
        <label className="operator-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search operators, devices..."
            aria-label="Search operators"
          />
        </label>
        <label className="operator-select">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="break">On break</option>
            <option value="incident">Incident</option>
            <option value="low-battery">Low battery</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        {machines.length > 0 && (
          <label className="operator-select">
            <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)} aria-label="Filter by machine">
              <option value="all">All machines</option>
              {machines.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}
        <label className="operator-select operator-sort">
          <ArrowUpDown size={15} aria-hidden="true" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort operators">
            <option value="attention">Sort: Attention</option>
            <option value="name">Sort: Name</option>
            <option value="battery">Sort: Battery</option>
            <option value="rounds">Sort: Rounds</option>
            <option value="idle">Sort: Idle time</option>
          </select>
        </label>
      </div>

      <div className="card table-card">
        <div className="operator-table-scroll">
          <table className="operator-table">
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
                const activity = w.live?.motion_state === 'walking'
                  ? `${w.live.walking_speed_ms || '1.20'} m/s`
                  : w.live ? `${w.live.idle_duration_sec || 0}s idle` : '—';
                return (
                  <tr
                    key={w.id}
                    className={`interactive-row ${w.status.priority === 0 ? 'row-highlight' : ''}`}
                    onClick={() => w.live && onWorkerClick(w.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="table-avatar" style={{ background: w.color }}>{w.avatar}</div>
                        <div>
                          <div className="cell-primary">{w.name}</div>
                          <div className="cell-secondary">{w.live?.device_id || w.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-primary">{w.role}</div>
                      <div className="cell-secondary">{w.shift}</div>
                    </td>
                    <td>
                      {w.live ? (
                        <>
                          <div className="cell-primary">{w.live.current_machine || 'M1'}</div>
                          <div className="cell-secondary">{w.live.last_beacon_id} - {w.live.current_zone}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      {w.live ? (
                        <>
                          <div className="cell-primary" style={{ textTransform: 'capitalize' }}>
                            {w.live.motion_state || 'Stationary'}
                          </div>
                          <div className="cell-secondary">{activity}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td>{w.live ? `${w.live.lap_count || 0} laps` : '—'}</td>
                    <td>
                      {w.live ? (
                        <div className="battery-indicator">
                          <div
                            className="battery-bar"
                            style={{
                              width: `${w.live.wristband_battery_pct}%`,
                              background: w.live.wristband_battery_pct < 20 ? 'var(--red)' : 'var(--green)'
                            }}
                          />
                          <span>{w.live.wristband_battery_pct}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${w.status.cls}`}>
                        {w.status.key === 'incident' && <AlertTriangle size={12} />}
                        {w.status.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={e => { e.stopPropagation(); if (w.live) onWorkerClick(w.id); }}
                        aria-label={`View ${w.name}`}
                        title="View operator details"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredList.length === 0 && (
          <div className="operator-empty">
            <UserRound size={22} />
            <span>No operators match these filters.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorsPage;
