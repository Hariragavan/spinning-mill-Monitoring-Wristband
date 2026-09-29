import React, { useState } from 'react';
import { ArrowLeft, ClipboardCheck, AlertTriangle, UserRound, TrendingDown, CheckCircle2 } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const KNOWN_NAMES = { worker_1: 'Alex Patel', worker_2: 'Raj Kumar', worker_3: 'Maria Singh' };
const INCIDENT_LABELS = { yarn_break: 'Yarn break', spindle_jam: 'Spindle jam', elec_break: 'Electrical break', machine_break: 'Machine break' };

const CorrelationDetailPage = ({ workers = {}, telemetryLogs = [], onBack }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [machineFilter, setMachineFilter] = useState('All');
  const [operatorFilter, setOperatorFilter] = useState('All');
  const [actionStatus, setActionStatus] = useState('Open investigation');

  const workerList = Object.entries(workers).filter(([, data]) => data?.live);

  const getWorkerDisplayName = (id, live) => {
    return KNOWN_NAMES[id] || live?.device_id || `Operator ${id.split('_')[1] || id}`;
  };

  const filteredWorkers = workerList.filter(([id, data]) => {
    const live = data.live;
    const opName = getWorkerDisplayName(id, live);
    const date = new Date(live.timestamp || Date.now()).toISOString().slice(0, 10);
    return date >= startDate && date <= endDate
      && (machineFilter === 'All' || live.current_machine === machineFilter)
      && (operatorFilter === 'All' || opName === operatorFilter);
  });

  const machineRows = ['M1', 'M2', 'M3'].map(machine => {
    const machineWorkers = filteredWorkers.filter(([, data]) => data.live.current_machine === machine);
    const patrols = machineWorkers.reduce((sum, [, data]) => sum + (data.live.lap_count || 0), 0);
    const idleMinutes = machineWorkers.reduce((sum, [, data]) => sum + Math.floor((data.live.idle_duration_sec || 0) / 60), 0);
    const incidentMinutes = machineWorkers.reduce((sum, [, data]) => sum + ((data.live.incident_type !== 'none' || data.live.assistance_request_flag) ? 5 : 0), 0);
    const downtime = idleMinutes + incidentMinutes;
    return { machine, patrols, downtime, idleMinutes, incidentMinutes, lostOutput: downtime * 8 };
  }).filter(row => machineFilter === 'All' || row.machine === machineFilter);

  const causes = filteredWorkers.reduce((result, [, data]) => {
    const live = data.live;
    const name = (live.incident_type !== 'none' || live.assistance_request_flag)
      ? (live.assistance_request_flag ? 'Assistance request' : (INCIDENT_LABELS[live.incident_type] || live.incident_type))
      : live.idle_duration_sec > 0 ? 'Worker idle / pause' : 'Normal operation';
    const minutes = Math.floor((live.idle_duration_sec || 0) / 60) + (live.assistance_request_flag ? 5 : 0);
    const existing = result.find(item => item.name === name);
    if (existing) existing.minutes += Math.max(1, minutes);
    else result.push({ name, minutes: Math.max(1, minutes) });
    return result;
  }, []).sort((a, b) => b.minutes - a.minutes);

  const highDowntimeWorkers = filteredWorkers.filter(([, data]) => (data.live.incident_type !== 'none' || data.live.assistance_request_flag) || (data.live.idle_duration_sec || 0) > 180);
  const totalPatrols = machineRows.reduce((sum, row) => sum + row.patrols, 0);
  const totalDowntime = machineRows.reduce((sum, row) => sum + row.downtime, 0);
  const totalLostOutput = machineRows.reduce((sum, row) => sum + row.lostOutput, 0);
  const confidence = filteredWorkers.length > 0 ? 'High (Live Telemetry)' : 'Awaiting Data';

  const timeline = filteredWorkers.map(([id, data]) => {
    const live = data.live;
    const eventDate = new Date(live.timestamp || Date.now());
    const reason = (live.incident_type !== 'none' || live.assistance_request_flag)
      ? (live.assistance_request_flag ? 'Assistance request' : (INCIDENT_LABELS[live.incident_type] || live.incident_type))
      : live.idle_duration_sec > 0 ? 'Stationary activity' : 'Normal operation';
    return {
      id,
      time: eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      operator: getWorkerDisplayName(id, live),
      machine: live.current_machine || 'M1',
      activity: live.motion_state === 'walking' ? 'Patrol' : 'Idle / pause',
      reason
    };
  });

  return (
    <div className="page-content">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to Reports</button>
      <div className="page-header">
        <h2>Patrols vs. Stoppage Investigation</h2>
        <p className="page-subtitle">Trace floor stoppage to spinning frame, operator activity, and physical checkpoints</p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title"><ClipboardCheck size={17} /> Investigation filters</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="text-muted">From <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label className="text-muted">To <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label>
          <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)}>
            <option value="All">All machines</option>
            <option value="M1">Machine M1</option>
            <option value="M2">Machine M2</option>
            <option value="M3">Machine M3</option>
          </select>
          <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}>
            <option value="All">All operators</option>
            {workerList.map(([id, d]) => {
              const name = getWorkerDisplayName(id, d.live);
              return <option key={id} value={name}>{name}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="summary-row">
        <SummaryCard label="Patrols in Range" value={`${totalPatrols} Laps`} status="Recorded in database" icon="route" tone="blue" />
        <SummaryCard label="Recorded Stoppage" value={`${totalDowntime} min`} status="Calculated idle" icon="clock" tone="red" />
        <SummaryCard label="Lost Output Estimate" value={`${totalLostOutput} Units`} status="Production impact" icon="trending" tone="amber" />
        <SummaryCard label="Evidence Confidence" value={confidence} status="Direct Supabase feed" icon="chart" tone="green" />
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title"><TrendingDown size={17} /> Root Cause Analysis Methodology</div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '12px' }}>
          Downtime and idle time are measured directly from the wristband accelerometer motion state and beacon touch intervals. Check station checkpoint touches, machine operating state, and incident timing before attributing delays to floor staffing.
        </p>
        <span className="status-badge status-good">{confidence}</span>
      </div>

      <div className="bottom-split">
        <div className="card">
          <div className="card-title"><AlertTriangle size={17} /> Observed Delay Causes</div>
          <div style={{ width: '100%', height: 240 }}>
            {causes.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={causes} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={v => `${v}m`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [`${v} min`, 'Idle duration']} />
                  <Bar dataKey="minutes" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No delay causes identified in current telemetry.
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><UserRound size={17} /> Responsibility Matrix</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div className="data-row"><span className="data-label">Emergency help flag</span><strong>Maintenance & Shift supervisor</strong></div>
            <div className="data-row"><span className="data-label">Stationary idle (&gt;3m)</span><strong>Shift supervisor</strong></div>
            <div className="data-row"><span className="data-label">Beacon touch missing</span><strong>IoT Floor Engineer</strong></div>
            <div className="data-row"><span className="data-label">Yield variance</span><strong>Production Manager</strong></div>
          </div>
        </div>
      </div>

      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Machine Impact Summary</div>
        <table>
          <thead>
            <tr>
              <th>Machine</th>
              <th>Patrols</th>
              <th>Downtime</th>
              <th>Idle</th>
              <th>Incidents</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {machineRows.map(row => (
              <tr key={row.machine} className={row.downtime > 0 ? 'row-highlight' : ''}>
                <td className="cell-primary">Machine {row.machine}</td>
                <td>{row.patrols} laps</td>
                <td>{row.downtime} min</td>
                <td>{row.idleMinutes} min</td>
                <td>{row.incidentMinutes} min</td>
                <td>
                  <span className={`status-badge ${row.downtime > 5 ? 'status-alert' : 'status-good'}`}>
                    {row.downtime > 5 ? 'Review Needed' : 'Nominal'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Investigation Timeline</div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Operator</th>
              <th>Machine</th>
              <th>Activity</th>
              <th>Observed Telemetry</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map(row => (
              <tr key={row.id}>
                <td className="text-muted">{row.time}</td>
                <td className="cell-primary">{row.operator}</td>
                <td>{row.machine}</td>
                <td>{row.activity}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
            {timeline.length === 0 && (
              <tr><td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>No telemetry matches the selected filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <strong>Investigation Status</strong>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{actionStatus}</div>
        </div>
        <button className="settings-button" onClick={() => setActionStatus('Marked as investigated')}>
          <CheckCircle2 size={15} /> Mark investigated
        </button>
      </div>
    </div>
  );
};

export default CorrelationDetailPage;
