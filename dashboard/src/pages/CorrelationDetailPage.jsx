import React, { useState } from 'react';
import { ArrowLeft, ClipboardCheck, AlertTriangle, UserRound, TrendingDown, CheckCircle2 } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NAMES = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };
const INCIDENT_LABELS = { yarn_break: 'Yarn break', spindle_jam: 'Spindle jam', elec_break: 'Electrical break', machine_break: 'Machine break' };

const CorrelationDetailPage = ({ workers, onBack }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [machineFilter, setMachineFilter] = useState('All');
  const [operatorFilter, setOperatorFilter] = useState('All');
  const [actionStatus, setActionStatus] = useState('Open investigation');
  const workerList = Object.entries(workers).filter(([, data]) => data?.live);
  const filteredWorkers = workerList.filter(([id, data]) => {
    const live = data.live;
    const date = new Date(live.timestamp || 0).toISOString().slice(0, 10);
    return date >= startDate && date <= endDate
      && (machineFilter === 'All' || live.current_machine === machineFilter)
      && (operatorFilter === 'All' || NAMES[id] === operatorFilter);
  });
  const machineRows = ['M1', 'M2', 'M3'].map(machine => {
    const machineWorkers = filteredWorkers.filter(([, data]) => data.live.current_machine === machine);
    const patrols = machineWorkers.reduce((sum, [, data]) => sum + (data.live.lap_count || 0), 0);
    const idleMinutes = machineWorkers.reduce((sum, [, data]) => sum + Math.floor((data.live.idle_duration_sec || 0) / 60), 0);
    const incidentMinutes = machineWorkers.reduce((sum, [, data]) => sum + (data.live.incident_type !== 'none' ? 5 : 0), 0);
    const downtime = idleMinutes + incidentMinutes;
    return { machine, patrols, downtime, idleMinutes, incidentMinutes, lostOutput: downtime * 8 };
  }).filter(row => machineFilter === 'All' || row.machine === machineFilter);
  const causes = filteredWorkers.reduce((result, [, data]) => {
    const live = data.live;
    const name = live.incident_type !== 'none' ? INCIDENT_LABELS[live.incident_type] || live.incident_type : live.idle_duration_sec > 0 ? 'Worker idle / break' : 'No current downtime signal';
    const minutes = Math.floor((live.idle_duration_sec || 0) / 60) + (live.incident_type !== 'none' ? 5 : 0);
    const existing = result.find(item => item.name === name);
    if (existing) existing.minutes += minutes;
    else result.push({ name, minutes });
    return result;
  }, []).sort((a, b) => b.minutes - a.minutes);
  const highDowntimeWorkers = filteredWorkers.filter(([, data]) => data.live.incident_type !== 'none' || (data.live.idle_duration_sec || 0) > 15);
  const totalPatrols = machineRows.reduce((sum, row) => sum + row.patrols, 0);
  const totalDowntime = machineRows.reduce((sum, row) => sum + row.downtime, 0);
  const totalLostOutput = machineRows.reduce((sum, row) => sum + row.lostOutput, 0);
  const confidence = filteredWorkers.length >= 3 ? 'Moderate' : 'Low';
  const timeline = filteredWorkers.map(([id, data]) => {
    const live = data.live;
    const eventDate = new Date(live.timestamp || 0);
    const reason = live.incident_type !== 'none' ? INCIDENT_LABELS[live.incident_type] || live.incident_type : live.idle_duration_sec > 0 ? 'Stationary activity' : 'Normal operation';
    return { id, time: eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), operator: NAMES[id] || id, machine: live.current_machine, activity: live.motion_state === 'walking' ? 'Patrol' : 'Idle / incident', reason };
  });

  return (
    <div className="page-content">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to Reports</button>
      <div className="page-header"><h2>Patrols vs. Breakdowns Investigation</h2><p className="page-subtitle">Trace low correlation to a machine, activity, cause, and responsible reviewer.</p></div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title"><ClipboardCheck size={17} /> Investigation filters</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="text-muted">From <input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} /></label>
          <label className="text-muted">To <input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} /></label>
          <select value={machineFilter} onChange={event => setMachineFilter(event.target.value)}><option value="All">All machines</option><option value="M1">Machine M1</option><option value="M2">Machine M2</option><option value="M3">Machine M3</option></select>
          <select value={operatorFilter} onChange={event => setOperatorFilter(event.target.value)}><option value="All">All operators</option>{Object.values(NAMES).map(name => <option key={name}>{name}</option>)}</select>
        </div>
      </div>
      <div className="summary-row">
        <SummaryCard label="Patrols in Range" value={totalPatrols} status="Filtered telemetry" icon="route" tone="blue" />
        <SummaryCard label="Estimated Downtime" value={`${totalDowntime} min`} status="Current estimate" icon="clock" tone="red" />
        <SummaryCard label="Estimated Lost Units" value={totalLostOutput} status="Production impact" icon="trending" tone="amber" />
        <SummaryCard label="Evidence Confidence" value={confidence} status="Current telemetry only" icon="chart" tone="green" />
      </div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title"><TrendingDown size={17} /> What does a low correlation mean?</div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '12px' }}>A low relationship means patrol count alone does not explain downtime. Check the cause, machine state, beacon coverage, and incident timing before blaming worker activity. Lost units are an estimate of 8 units per downtime minute because the current payload has no production counter.</p>
        <span className="status-badge status-idle">{confidence} confidence: current telemetry only</span>
      </div>
      <div className="bottom-split">
        <div className="card"><div className="card-title"><AlertTriangle size={17} /> Root causes to investigate</div><div style={{ width: '100%', height: 260 }}><ResponsiveContainer><BarChart data={causes} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" tickFormatter={value => `${value}m`} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip formatter={value => [`${value} min`, 'Estimated downtime']} /><Bar dataKey="minutes" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-title"><UserRound size={17} /> Who should review it?</div><div style={{ display: 'grid', gap: '10px' }}><div className="data-row"><span className="data-label">Machine incident</span><strong>Maintenance supervisor</strong></div><div className="data-row"><span className="data-label">Idle or extended break</span><strong>Shift supervisor</strong></div><div className="data-row"><span className="data-label">Missed beacon / signal</span><strong>IoT support</strong></div><div className="data-row"><span className="data-label">Production loss</span><strong>Production manager</strong></div></div></div>
      </div>
      <div className="card table-card"><div className="card-title" style={{ padding: '18px 18px 0' }}>Machine impact</div><table><thead><tr><th>Machine</th><th>Patrols</th><th>Downtime</th><th>Idle</th><th>Incidents</th><th>Lost units*</th><th>Review</th></tr></thead><tbody>{machineRows.map(row => <tr key={row.machine} className={row.downtime > 0 ? 'row-highlight' : ''}><td className="cell-primary">{row.machine}</td><td>{row.patrols}</td><td>{row.downtime} min</td><td>{row.idleMinutes} min</td><td>{row.incidentMinutes} min</td><td>{row.lostOutput}</td><td>{row.downtime > 0 ? 'Investigate' : 'Monitor'}</td></tr>)}</tbody></table><div className="text-muted" style={{ padding: '10px 18px', fontSize: '0.75rem' }}>*Estimated until a machine production counter is connected.</div></div>
      <div className="card table-card"><div className="card-title" style={{ padding: '18px 18px 0' }}>Investigation timeline</div><table><thead><tr><th>Time</th><th>Operator</th><th>Machine</th><th>Activity</th><th>Observed reason</th></tr></thead><tbody>{timeline.map(row => <tr key={row.id}><td className="text-muted">{row.time}</td><td className="cell-primary">{row.operator}</td><td>{row.machine}</td><td>{row.activity}</td><td>{row.reason}</td></tr>)}{timeline.length === 0 && <tr><td colSpan="5" className="text-muted">No telemetry matches the selected filters.</td></tr>}</tbody></table></div>
      <div className="card table-card"><div className="card-title" style={{ padding: '18px 18px 0' }}>Workers to ask first</div><table><thead><tr><th>Operator</th><th>Machine</th><th>Reason</th><th>First reviewer</th><th>Action</th></tr></thead><tbody>{highDowntimeWorkers.map(([id, data]) => { const live = data.live; const incident = live.incident_type !== 'none'; return <tr key={id} className="row-highlight"><td className="cell-primary">{NAMES[id] || id}</td><td>{live.current_machine}</td><td>{incident ? INCIDENT_LABELS[live.incident_type] || live.incident_type : `Idle for ${Math.floor((live.idle_duration_sec || 0) / 60)} min`}</td><td>{incident ? 'Maintenance supervisor' : 'Shift supervisor'}</td><td><button className="icon-button" onClick={() => setActionStatus(`Review assigned for ${NAMES[id] || id}`)} title="Assign review"><CheckCircle2 size={16} /></button></td></tr>; })}{highDowntimeWorkers.length === 0 && <tr><td colSpan="5" className="text-muted">No high-downtime worker signals.</td></tr>}</tbody></table></div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><strong>Investigation status</strong><div className="text-muted" style={{ fontSize: '0.8rem' }}>{actionStatus}</div></div><button className="settings-button" onClick={() => setActionStatus('Marked as investigated')}><CheckCircle2 size={15} /> Mark investigated</button></div>
    </div>
  );
};

export default CorrelationDetailPage;
