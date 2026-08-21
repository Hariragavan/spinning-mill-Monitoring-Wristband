import React, { useState } from 'react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Bar } from 'recharts';

const HOURLY_DATA = [
  { period: '05:30', rpm: 60, maintenance: 0, doffing: 0, cleaning: 0, mech: 0, elec: 0, break: 0, meeting: 0 },
  { period: '09:30', rpm: 55, maintenance: 0, doffing: 0, cleaning: 5, mech: 0, elec: 0, break: 0, meeting: 0 },
  { period: '10:30', rpm: 5, maintenance: 0, doffing: 0, cleaning: 55, mech: 0, elec: 0, break: 0, meeting: 0 },
  { period: '15:30', rpm: 35, maintenance: 0, doffing: 0, cleaning: 0, mech: 0, elec: 0, break: 25, meeting: 0 },
  { period: '16:30', rpm: 25, maintenance: 35, doffing: 0, cleaning: 0, mech: 0, elec: 0, break: 0, meeting: 0 },
  { period: '21:30', rpm: 52, maintenance: 0, doffing: 0, cleaning: 0, mech: 8, elec: 0, break: 0, meeting: 0 },
  { period: '22:30', rpm: 60, maintenance: 0, doffing: 0, cleaning: 0, mech: 0, elec: 0, break: 0, meeting: 0 },
  { period: '23:30', rpm: 31, maintenance: 0, doffing: 29, cleaning: 0, mech: 0, elec: 0, break: 0, meeting: 0 },
];

const DAILY_DATA = [
  { period: 'Mon', rpm: 1100, maintenance: 45, doffing: 120, cleaning: 60, mech: 15, elec: 0, break: 60, meeting: 40 },
  { period: 'Tue', rpm: 1250, maintenance: 0, doffing: 100, cleaning: 40, mech: 0, elec: 0, break: 50, meeting: 0 },
  { period: 'Wed', rpm: 980, maintenance: 120, doffing: 150, cleaning: 90, mech: 40, elec: 20, break: 40, meeting: 0 },
  { period: 'Thu', rpm: 1300, maintenance: 0, doffing: 90, cleaning: 30, mech: 0, elec: 0, break: 20, meeting: 0 },
  { period: 'Fri', rpm: 1150, maintenance: 30, doffing: 110, cleaning: 50, mech: 10, elec: 10, break: 60, meeting: 20 },
];

const MONTHLY_DATA = [
  { period: 'Jan', rpm: 32000, maintenance: 1200, doffing: 3500, cleaning: 1500, mech: 400, elec: 150, break: 1800, meeting: 600 },
  { period: 'Feb', rpm: 29000, maintenance: 1800, doffing: 3100, cleaning: 1400, mech: 800, elec: 300, break: 1600, meeting: 500 },
  { period: 'Mar', rpm: 35000, maintenance: 900, doffing: 3800, cleaning: 1600, mech: 200, elec: 100, break: 1900, meeting: 700 },
];

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

const DurationCell = ({ value, color, maxVal }) => {
  const displayVal = value >= 600 ? Math.floor(value / 60) + 'h' : value + 'm';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: value > 0 ? `${Math.max(4, (value / maxVal) * 50)}px` : '4px', 
        height: '4px', 
        backgroundColor: value > 0 ? color : '#cbd5e1',
        borderRadius: '2px',
        transition: 'width 0.3s'
      }} />
      <span style={{ fontSize: '0.75rem', color: value > 0 ? '#334155' : '#94a3b8', minWidth: '24px' }}>{displayVal}</span>
    </div>
  );
};

const WORKER_SUMMARY = [
  { name: 'Alex P.',  daysWorked: 6, avgHours: '7.8 hr', totalRounds: 72, onTimeRate: '100%' },
  { name: 'Raj K.',   daysWorked: 5, avgHours: '7.5 hr', totalRounds: 58, onTimeRate: '80%' },
  { name: 'Maria S.', daysWorked: 6, avgHours: '7.2 hr', totalRounds: 64, onTimeRate: '100%' },
];

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('hourly');
  const [filterDate, setFilterDate] = useState('Today');
  const [filterMachine, setFilterMachine] = useState('All');
  const [filterOperator, setFilterOperator] = useState('All');

  let activeData = HOURLY_DATA;
  let maxVal = 60;
  if (activeTab === 'daily') {
    activeData = DAILY_DATA;
    maxVal = 1440;
  } else if (activeTab === 'monthly') {
    activeData = MONTHLY_DATA;
    maxVal = 43200;
  }

  const handleExportCSV = () => {
    let csv = "Period,RPM,Maintenance,Doffing,Cleaning,Mech Break,Elec Break,Break,Meeting,Total\n";
    activeData.forEach(r => {
      const total = r.rpm + r.maintenance + r.doffing + r.cleaning + r.mech + r.elec + r.break + r.meeting;
      csv += `${r.period},${r.rpm},${r.maintenance},${r.doffing},${r.cleaning},${r.mech},${r.elec},${r.break},${r.meeting},${total}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mode_duration_${activeTab}.csv`);
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
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff', fontSize: '0.85rem' }}>
            <option>Today</option>
            <option>Last 7 Days</option>
            <option>This Month</option>
            <option>Custom Range...</option>
          </select>
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
        <div className="summary-card" style={{ background: '#dbeafe', color: '#1e40af' }}>
          <div className="summary-value">92.4%</div>
          <div className="summary-label">Availability (Uptime)</div>
        </div>
        <div className="summary-card" style={{ background: '#dcfce7', color: '#166534' }}>
          <div className="summary-value">95.1%</div>
          <div className="summary-label">Performance (RPM vs Target)</div>
        </div>
        <div className="summary-card" style={{ background: '#fef3c7', color: '#92400e' }}>
          <div className="summary-value">98.5%</div>
          <div className="summary-label">Quality (Good Yield)</div>
        </div>
        <div className="summary-card" style={{ background: '#1e3a8a', color: '#ffffff' }}>
          <div className="summary-value" style={{ color: '#ffffff' }}>86.5%</div>
          <div className="summary-label" style={{ color: '#cbd5e1' }}>Overall OEE Score</div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Correlation Chart */}
        <div className="card">
          <div className="card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '6px' }}>Patrols vs. Breakdowns Correlation</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Does a lower number of patrol rounds lead to higher machine downtime?</div>
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

      {/* Mode Duration Analytics */}
      <div className="card table-card">
        <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div className="card-title" style={{ padding: 0, border: 'none', marginBottom: '4px', fontSize: '0.9rem' }}>MODE DURATION ANALYTICS</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>How many minutes the machine stayed in each mode</div>
          </div>
          <div className="toggle-group" style={{ display: 'flex', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setActiveTab('hourly')} style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: activeTab === 'hourly' ? 600 : 500, border: 'none', background: activeTab === 'hourly' ? '#3b82f6' : '#fff', color: activeTab === 'hourly' ? '#fff' : '#64748b', cursor: 'pointer' }}>Hourly</button>
            <button onClick={() => setActiveTab('daily')} style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: activeTab === 'daily' ? 600 : 500, border: 'none', background: activeTab === 'daily' ? '#3b82f6' : '#fff', color: activeTab === 'daily' ? '#fff' : '#64748b', borderLeft: '1px solid #e2e8f0', cursor: 'pointer' }}>Daily</button>
            <button onClick={() => setActiveTab('monthly')} style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: activeTab === 'monthly' ? 600 : 500, border: 'none', background: activeTab === 'monthly' ? '#3b82f6' : '#fff', color: activeTab === 'monthly' ? '#fff' : '#64748b', borderLeft: '1px solid #e2e8f0', cursor: 'pointer' }}>Monthly</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Period</th>
                <th>RPM</th>
                <th>Maintenance</th>
                <th>Doffing</th>
                <th>Cleaning</th>
                <th>Mech Breaking</th>
                <th>Elec Breaking</th>
                <th>Break</th>
                <th>Meeting</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {activeData.map((r, i) => {
                const total = r.rpm + r.maintenance + r.doffing + r.cleaning + r.mech + r.elec + r.break + r.meeting;
                const totalDisplay = total >= 600 ? Math.floor(total / 60) + 'h' : total + 'm';
                return (
                  <tr key={i}>
                    <td className="text-muted" style={{ fontSize: '0.75rem' }}>{r.period}</td>
                    <td><DurationCell value={r.rpm} color="#3b82f6" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.maintenance} color="#8b5cf6" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.doffing} color="#10b981" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.cleaning} color="#f59e0b" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.mech} color="#ef4444" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.elec} color="#ef4444" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.break} color="#64748b" maxVal={maxVal} /></td>
                    <td><DurationCell value={r.meeting} color="#14b8a6" maxVal={maxVal} /></td>
                    <td style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>{totalDisplay}</td>
                  </tr>
                );
              })}
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
            {WORKER_SUMMARY.map((w, i) => (
              <tr key={i}>
                <td className="cell-primary">{w.name}</td>
                <td>{w.daysWorked}/7</td>
                <td>{w.avgHours}</td>
                <td>{w.totalRounds}</td>
                <td><span className={w.onTimeRate === '100%' ? 'text-green' : 'text-amber'}>{w.onTimeRate}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
