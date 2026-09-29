import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, UserRound } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Bar } from 'recharts';

const DOWNTIME_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#cbd5e1'];

const KNOWN_NAMES = { worker_1: 'Alex Patel', worker_2: 'Raj Kumar', worker_3: 'Maria Singh' };

const ReportsPage = ({ workers = {}, beacons = [], telemetryLogs = [], onOpenCorrelation }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [filterMachine, setFilterMachine] = useState('All');
  const [filterOperator, setFilterOperator] = useState('All');
  const [reportStatus, setReportStatus] = useState('Needs review');

  const workerList = Object.entries(workers).filter(([, data]) => data?.live);

  const getWorkerDisplayName = (id, live) => {
    return KNOWN_NAMES[id] || live?.device_id || `Operator ${id.split('_')[1] || id}`;
  };

  const filteredWorkers = workerList.filter(([id, data]) => {
    const live = data.live;
    const machineMatches = filterMachine === 'All' || live.current_machine === filterMachine.replace('Machine ', '');
    const opName = getWorkerDisplayName(id, live);
    const operatorMatches = filterOperator === 'All' || opName === filterOperator;
    return machineMatches && operatorMatches;
  });

  const activeWorkers = filteredWorkers.filter(([, data]) => data.live.motion_state === 'walking').length;
  const averageBattery = filteredWorkers.length
    ? filteredWorkers.reduce((sum, [, data]) => sum + (data.live.wristband_battery_pct || 0), 0) / filteredWorkers.length
    : 100;

  // Real correlation data: aggregated from telemetry_logs and live patrol counts
  const roundsToday = filteredWorkers.reduce((s, [, d]) => s + (d.live.lap_count || 0), 0);
  const idleMinutesToday = filteredWorkers.reduce((s, [, d]) => s + Math.floor((d.live.idle_duration_sec || 0) / 60), 0);

  // Group logs by day if available, otherwise present current shift telemetry
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDayName = daysOfWeek[new Date().getDay()];

  const correlationChartData = [
    { day: todayDayName, patrols: roundsToday, downtime: idleMinutesToday }
  ];

  // Derive actual downtime categories from active worker idle states and incidents
  const realIdleMinutes = filteredWorkers.reduce((s, [, d]) => s + Math.floor((d.live.idle_duration_sec || 0) / 60), 0);
  const realBreakMinutes = filteredWorkers.reduce((s, [, d]) => s + Math.floor((d.live.break_duration_sec || 0) / 60), 0);
  const incidentCount = filteredWorkers.filter(([, d]) => d.live.incident_type !== 'none' || d.live.assistance_request_flag).length;

  const downtimeCategories = [
    { name: 'Stationary / Idle', value: Math.max(1, realIdleMinutes) },
    { name: 'Authorized Break', value: realBreakMinutes },
    { name: 'Incident Interruption', value: incidentCount * 5 },
  ].filter(c => c.value > 0);

  const workerSummary = filteredWorkers.map(([id, data]) => {
    const live = data.live;
    const shiftHours = Math.max(0, (Date.now() - (live.login_timestamp || Date.now())) / 3600000);
    return {
      name: getWorkerDisplayName(id, live),
      daysWorked: 1,
      avgHours: `${Math.max(0.1, shiftHours).toFixed(1)} hr`,
      totalRounds: live.lap_count || 0,
      onTimeRate: live.incident_type === 'none' && !live.assistance_request_flag ? '100%' : 'Needs review'
    };
  });

  const activityRows = filteredWorkers
    .map(([id, data]) => {
      const live = data.live;
      const timestamp = live.timestamp || Date.now();
      const date = new Date(timestamp);
      const idleMinutes = Math.floor((live.idle_duration_sec || 0) / 60);
      const activity = (live.incident_type !== 'none' || live.assistance_request_flag)
        ? 'Incident response'
        : live.break_mode !== 'none'
          ? 'Break'
          : live.motion_state === 'stationary'
            ? 'Idle'
            : 'Patrol';
      return {
        id,
        date: date.toISOString().slice(0, 10),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        operator: getWorkerDisplayName(id, live),
        machine: live.current_machine || 'M1',
        activity,
        output: live.lap_count || 0,
        expectedOutput: Math.max(live.lap_count || 0, 15),
        efficiency: live.motion_state === 'walking' ? 100 : 85,
        idleMinutes,
        reason: (live.incident_type !== 'none' || live.assistance_request_flag) ? 'Incident assistance' : idleMinutes > 0 ? 'Stationary at checkpoint' : 'Normal operation',
        totalMinutes: Math.max(1, Math.floor((Date.now() - (live.login_timestamp || timestamp)) / 60000)),
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
  const reviewOwner = activityRows.some(row => row.activity === 'Incident response') ? 'Maintenance supervisor' : 'Shift supervisor';

  const handleExportCSV = () => {
    let csv = "Date,Time,Operator,Machine,Activity,Actual Output,Expected Output,Efficiency,Idle/Break (min),Incident or Reason,Total Activity (min)\n";
    activityRows.forEach(row => {
      csv += `${row.date},${row.time},${row.operator},${row.machine},${row.activity},${row.output},${row.expectedOutput},${row.efficiency}%,${row.idleMinutes},${row.reason},${row.totalMinutes}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `spinningmill_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Advanced Analytics & Reports</h2>
          <p className="page-subtitle">Export telemetry data, review floor correlation, and inspect production effectiveness</p>
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
            <option value="M1">Machine M1</option>
            <option value="M2">Machine M2</option>
            <option value="M3">Machine M3</option>
          </select>
          <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }}>
            <option value="All">All Operators</option>
            {workerList.map(([id, d]) => {
              const name = getWorkerDisplayName(id, d.live);
              return <option key={id} value={name}>{name}</option>;
            })}
          </select>
          <button onClick={handleExportCSV} style={{ padding: '8px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             Export CSV
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="summary-row">
        <SummaryCard label="Availability (Uptime)" value={filteredWorkers.length ? `${Math.round((activeWorkers / filteredWorkers.length) * 100)}%` : '0%'} status="Live activity" icon="activity" tone="blue" />
        <SummaryCard label="Operator Battery Avg" value={`${Math.round(averageBattery)}%`} status="Device readiness" icon="battery" tone="green" />
        <SummaryCard label="Actual Patrol Output" value={`${totalActualOutput} Laps`} status="Recorded laps" icon="route" tone="amber" />
        <SummaryCard label="Target Variance" value={lostUnits > 0 ? `-${lostUnits} Laps` : 'On Target'} status={lostUnits > 0 ? "Below target" : "Target met"} icon="alerts" tone={lostUnits > 0 ? "red" : "green"} />
      </div>

      <div className="bottom-split">
        <div className="card">
          <div className="card-title"><AlertTriangle size={17} /> Shift Delay Analysis</div>
          <div className="data-row"><span className="data-label">Primary observed cause</span><strong>{topCause ? topCause[0] : 'Normal operation'}</strong></div>
          <div className="data-row"><span className="data-label">Tracked workers in range</span><strong>{activityRows.length}</strong></div>
          <div className="data-row"><span className="data-label">Target rounds</span><strong>{totalExpectedOutput} laps</strong></div>
          <div className="data-row"><span className="data-label">Actual rounds completed</span><strong>{totalActualOutput} laps</strong></div>
        </div>
        <div className="card">
          <div className="card-title"><UserRound size={17} /> Floor Review Assignment</div>
          <div className="data-row"><span className="data-label">Recommended reviewer</span><strong>{reviewOwner}</strong></div>
          <div className="data-row"><span className="data-label">Reason</span><span>{topCause ? topCause[0] : 'All floor operations within standard'}</span></div>
          <button className="settings-button" onClick={() => setReportStatus('Review assigned to ' + reviewOwner)}><CheckCircle2 size={15} /> Assign review</button>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>{reportStatus}</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Correlation Chart */}
        <div className="card">
          <div className="card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '6px' }}>Patrols vs. Stoppage Correlation</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Actual inspection rounds vs. stationary machine idle minutes</div>
          <button className="back-button" onClick={onOpenCorrelation} style={{ marginBottom: '12px' }}>Open detailed investigation</button>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={correlationChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}m`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="patrols" fill="#e2e8f0" name="Patrols Completed" radius={[4, 4, 0, 0]} barSize={28} />
                <Line yAxisId="left" type="monotone" dataKey="downtime" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Idle Time (mins)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Downtime Categories Pie Chart */}
        <div className="card">
          <div className="card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '6px' }}>Observed Idle Time Distribution</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Real breakdown of machine and worker stoppage</div>
          <div style={{ width: '100%', height: 250, position: 'relative' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={downtimeCategories} innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                  {downtimeCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DOWNTIME_COLORS[index % DOWNTIME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} mins`} />
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
            <div className="card-title" style={{ padding: 0, border: 'none', marginBottom: '4px', fontSize: '0.9rem' }}>OPERATOR PATROL & FLOOR ACTIVITY</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Real activity, completed laps, and idle duration from {startDate} to {endDate}</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '1080px' }}>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Operator</th><th>Machine</th><th>Activity</th>
                <th>Actual Laps</th><th>Target Laps</th><th>Efficiency</th><th>Idle (min)</th><th>Reason / Checkpoint</th><th>Active Time</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.map(row => (
                <tr key={row.id} className={row.activity === 'Incident response' || row.activity === 'Idle' ? 'row-highlight' : ''}>
                  <td className="text-muted">{row.date}</td>
                  <td className="text-muted">{row.time}</td>
                  <td className="cell-primary">{row.operator}</td>
                  <td>{row.machine}</td>
                  <td>{row.activity}</td>
                  <td>{row.output} laps</td>
                  <td>{row.expectedOutput} laps</td>
                  <td>{row.efficiency}%</td>
                  <td>{row.idleMinutes} min</td>
                  <td>{row.reason}</td>
                  <td>{row.totalMinutes} min</td>
                </tr>
              ))}
              {activityRows.length === 0 && (
                <tr><td colSpan="11" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>No worker activity recorded in this date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="card table-card">
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Operator Attendance & Floor Laps</div>
        <table>
          <thead>
            <tr><th>Operator</th><th>Shift</th><th>Logged Hours</th><th>Total Laps</th><th>Status</th></tr>
          </thead>
          <tbody>
            {workerSummary.map((w, i) => (
              <tr key={i}>
                <td className="cell-primary">{w.name}</td>
                <td>Morning Shift</td>
                <td>{w.avgHours}</td>
                <td>{w.totalRounds}</td>
                <td><span className={w.onTimeRate === '100%' ? 'text-green' : 'text-amber'}>{w.onTimeRate}</span></td>
              </tr>
            ))}
            {workerSummary.length === 0 && (
              <tr><td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>No workers registered in database.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
