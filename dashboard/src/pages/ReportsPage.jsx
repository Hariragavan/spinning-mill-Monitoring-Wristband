import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, UserRound } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Bar } from 'recharts';

const DOWNTIME_DATA = [
  { name: 'Cleaning', value: 45 },
  { name: 'Elec Break', value: 20 },
  { name: 'Mech Break', value: 15 },
  { name: 'Maintenance', value: 10 },
  { name: 'Other', value: 10 },
];
const DOWNTIME_COLORS = ['#f59e0b', '#ef4444', '#f97316', '#8b5cf6', '#cbd5e1'];

const CORRELATION_DATA = [
  { day: 'Mon', patrols: 28, downtime: 90 },
  { day: 'Tue', patrols: 31, downtime: 75 },
  { day: 'Wed', patrols: 18, downtime: 130 },
  { day: 'Thu', patrols: 30, downtime: 80 },
  { day: 'Fri', patrols: 27, downtime: 100 },
  { day: 'Sat', patrols: 33, downtime: 65 },
  { day: 'Sun', patrols: 29, downtime: 85 },
];

const ReportsPage = ({ workers, onOpenCorrelation }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [filterMachine, setFilterMachine] = useState('All');
  const [filterOperator, setFilterOperator] = useState('All');
  const [reportStatus, setReportStatus] = useState('Needs review');
  const names = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };
  const workerList = Object.entries(workers).filter(([, data]) => data?.live);
  const filteredWorkers = workerList.filter(([id, data]) => {
    const machineMatches = filterMachine === 'All' || data.live.current_machine === filterMachine.replace('Machine ', '');
    const operatorMatches = filterOperator === 'All' || names[id] === filterOperator;
    return machineMatches && operatorMatches;
  });
  const activeWorkers = filteredWorkers.filter(([, data]) => data.live.motion_state === 'walking').length;
  const averageBattery = filteredWorkers.length ? filteredWorkers.reduce((sum, [, data]) => sum + (data.live.wristband_battery_pct || 0), 0) / filteredWorkers.length : 0;
  const workerSummary = filteredWorkers.map(([id, data]) => {
    const live = data.live;
    const shiftHours = Math.max(0, (live.timestamp - (live.login_timestamp || live.timestamp)) / 3600000);
    return { name: names[id] || id, daysWorked: 1, avgHours: `${shiftHours.toFixed(1)} hr`, totalRounds: live.lap_count || 0, onTimeRate: live.incident_type === 'none' ? '100%' : 'Needs review' };
  });

  const activityRows = filteredWorkers
    .map(([id, data]) => {
      const live = data.live;
      const timestamp = live.timestamp || 0;
      const date = timestamp ? new Date(timestamp) : null;
      const idleMinutes = Math.floor((live.idle_duration_sec || 0) / 60);
      const activity = live.incident_type !== 'none'
        ? 'Incident response'
        : live.break_mode !== 'none'
          ? 'Break'
          : live.motion_state === 'stationary'
            ? 'Idle'
            : 'Patrol';
      return {
        id,
        date: date ? date.toISOString().slice(0, 10) : startDate,
        time: date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Unknown',
        operator: names[id] || id,
        machine: live.current_machine || 'Unknown',
        activity,
        output: live.lap_count || 0,
        expectedOutput: Math.max(live.lap_count || 0, Math.floor((live.timestamp - (live.login_timestamp || live.timestamp)) / 3600000) * 8),
        efficiency: live.motion_state === 'walking' ? 100 : 0,
        idleMinutes,
        reason: live.incident_type !== 'none' ? live.incident_type.replaceAll('_', ' ') : idleMinutes > 0 ? 'Stationary activity' : 'Normal operation',
        totalMinutes: Math.max(0, Math.floor((timestamp - (live.login_timestamp || timestamp)) / 60000)),
      };
    })
    .filter(row => row.date >= startDate && row.date <= endDate);

  const totalExpectedOutput = activityRows.reduce((sum, row) => sum + row.expectedOutput, 0);
  const totalActualOutput = activityRows.reduce((sum, row) => sum + row.output, 0);
  const lostUnits = Math.max(0, totalExpectedOutput - totalActualOutput);
  const causeSummary = activityRows.reduce((causes, row) => {
    causes[row.reason] = (causes[row.reason] || 0) + 1;
    return causes;
  }, {});
  const topCause = Object.entries(causeSummary).sort(([, first], [, second]) => second - first)[0];
  const reviewOwner = activityRows.some(row => row.activity === 'Incident response') ? 'Maintenance supervisor' : activityRows.some(row => row.activity === 'Idle' || row.activity === 'Break') ? 'Shift supervisor' : 'Production manager';
  const handleExportCSV = () => {
    let csv = "Date,Time,Operator,Machine,Activity,Actual Output,Expected Output,Efficiency,Idle/Break (min),Incident or Reason,Total Activity (min)\n";
    activityRows.forEach(row => {
      csv += `${row.date},${row.time},${row.operator},${row.machine},${row.activity},${row.output},${row.expectedOutput},${row.efficiency}%,${row.idleMinutes},${row.reason},${row.totalMinutes}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `worker_activity_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Advanced Analytics & Reports</h2>
          <p className="page-subtitle">Export data, view correlation charts, and analyze overall equipment effectiveness (OEE)</p>
        </div>
        
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>Start date
            <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>End date
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }} />
          </label>
          <select value={filterMachine} onChange={(e) => setFilterMachine(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }}>
            <option value="All">All Machines</option>
            <option>Machine M1</option>
            <option>Machine M2</option>
            <option>Machine M3</option>
          </select>
          <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }}>
            <option value="All">All Operators</option>
            <option>Alex P.</option>
            <option>Raj K.</option>
            <option>Maria S.</option>
          </select>
          <button onClick={handleExportCSV} style={{ padding: '8px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
             Export CSV
          </button>
        </div>
      </div>

      {/* OEE KPI Summary Row */}
      <div className="summary-row">
        <SummaryCard label="Availability (Uptime)" value={filteredWorkers.length ? `${Math.round((activeWorkers / filteredWorkers.length) * 1000) / 10}%` : '0%'} status="Live activity" icon="activity" tone="blue" />
        <SummaryCard label="Performance (Battery)" value={`${Math.round(averageBattery * 10) / 10}%`} status="Device readiness" icon="battery" tone="green" />
        <SummaryCard label="Actual Patrol Output" value={totalActualOutput} status="Selected date range" icon="route" tone="amber" />
        <SummaryCard label="Estimated Lost Units" value={lostUnits} status="Needs investigation" icon="alerts" tone="red" />
      </div>

      <div className="bottom-split">
        <div className="card">
          <div className="card-title"><AlertTriangle size={17} /> Production delay explanation</div>
          <div className="data-row"><span className="data-label">Main observed cause</span><strong>{topCause ? topCause[0] : 'No delay signal'}</strong></div>
          <div className="data-row"><span className="data-label">Events in selected range</span><strong>{activityRows.length}</strong></div>
          <div className="data-row"><span className="data-label">Expected output</span><strong>{totalExpectedOutput} patrols</strong></div>
          <div className="data-row"><span className="data-label">Actual output</span><strong>{totalActualOutput} patrols</strong></div>
        </div>
        <div className="card">
          <div className="card-title"><UserRound size={17} /> Who should review it?</div>
          <div className="data-row"><span className="data-label">Recommended owner</span><strong>{reviewOwner}</strong></div>
          <div className="data-row"><span className="data-label">Reason</span><span>{topCause ? topCause[0] : 'No current issue detected'}</span></div>
          <button className="settings-button" onClick={() => setReportStatus('Review assigned to ' + reviewOwner)}><CheckCircle2 size={15} /> Assign review</button>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>{reportStatus}</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Correlation Chart */}
        <div className="card">
          <div className="card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '6px' }}>Patrols vs. Breakdowns Correlation</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Does a lower number of patrol rounds lead to higher machine downtime?</div>
          <button className="back-button" onClick={onOpenCorrelation} style={{ marginBottom: '12px' }}>Open detailed investigation</button>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={CORRELATION_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}m`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="patrols" fill="#e2e8f0" name="Patrols Completed" radius={[4, 4, 0, 0]} barSize={20} />
                <Line yAxisId="left" type="monotone" dataKey="downtime" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Downtime (mins)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pareto / Breakdown Pie Chart */}
        <div className="card">
          <div className="card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '6px' }}>Top Downtime Reasons</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Breakdown of where machine time is being lost</div>
          <div style={{ width: '100%', height: 260, position: 'relative' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={DOWNTIME_DATA} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                  {DOWNTIME_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={DOWNTIME_COLORS[index % DOWNTIME_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Date-filtered worker activity report */}
      <div className="card table-card">
        <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div className="card-title" style={{ padding: 0, border: 'none', marginBottom: '4px', fontSize: '0.9rem' }}>WORKER ACTIVITY & PRODUCTION</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Live activity, patrol output, and reasons for lost production from {startDate} to {endDate}</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '1180px' }}>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Operator</th><th>Machine</th><th>Activity</th>
                <th>Actual Output</th><th>Expected Output</th><th>Efficiency</th><th>Idle / Break</th><th>Incident or Reason</th><th>Total Activity</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.map(row => {
                return (
                  <tr key={row.id} className={row.activity === 'Incident response' || row.activity === 'Idle' ? 'row-highlight' : ''}>
                    <td className="text-muted">{row.date}</td><td className="text-muted">{row.time}</td><td className="cell-primary">{row.operator}</td>
                    <td>{row.machine}</td><td>{row.activity}</td><td>{row.output} rounds</td><td>{row.expectedOutput} rounds</td><td>{row.efficiency}%</td>
                    <td>{row.idleMinutes} min</td><td>{row.reason}</td><td>{row.totalMinutes} min</td>
                  </tr>
                );
              })}
              {activityRows.length === 0 && <tr><td colSpan="11" className="text-muted">No worker activity is available from {startDate} to {endDate}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Weekly Attendance Summary</div>
        <table>
          <thead>
            <tr><th>Operator</th><th>Days Worked</th><th>Avg Hours/Day</th><th>Total Rounds</th><th>On-Time Rate</th></tr>
          </thead>
          <tbody>
            {workerSummary.map((w, i) => (
              <tr key={i}>
                <td className="cell-primary">{w.name}</td>
                <td>{w.daysWorked}/7</td>
                <td>{w.avgHours}</td>
                <td>{w.totalRounds}</td>
                <td><span className={w.onTimeRate === '100%' ? 'text-green' : 'text-amber'}>{w.onTimeRate}</span></td>
              </tr>
            ))}
            {workerSummary.length === 0 && <tr><td colSpan="5" className="text-muted">No workers match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
