import React from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COVERAGE_DATA = [
  { time: '06:00', active: 58, break: 2 },
  { time: '07:00', active: 55, break: 5 },
  { time: '08:00', active: 60, break: 0 },
  { time: '09:00', active: 45, break: 15 }, // Morning Tea spike
  { time: '10:00', active: 57, break: 3 },
  { time: '11:00', active: 56, break: 4 },
  { time: '12:00', active: 30, break: 30 }, // Lunch Shift 1
  { time: '13:00', active: 35, break: 25 }, // Lunch Shift 2
  { time: '14:00', active: 58, break: 2 },
  { time: '15:00', active: 40, break: 20 }, // Afternoon Tea spike
];

const BREAK_CATEGORIES = [
  { name: 'Authorized Lunch', value: 1200 }, // minutes
  { name: 'Authorized Tea', value: 800 },
  { name: 'Unauthorized Idle (>15m)', value: 340 },
];
const COLORS = ['#10b981', '#3b82f6', '#ef4444'];

const LIVE_ON_BREAK = [
  { worker: 'Alex P.',   type: 'Tea Break', durationMins: 8,  zone: 'Canteen' },
  { worker: 'Maria S.',  type: 'Restroom',  durationMins: 4,  zone: 'M3-B2' },
  { worker: 'Raj K.',    type: 'Idle',      durationMins: 19, zone: 'M2-A1' }, // Over 15 mins!
  { worker: 'David W.',  type: 'Idle',      durationMins: 22, zone: 'M1-A4' }, // Over 15 mins!
  { worker: 'Sarah J.',  type: 'Tea Break', durationMins: 12, zone: 'Canteen' },
];

const DOWNTIME_EVENTS = [
  { time: '15:10', machine: 'M2', reason: 'Spindle Jam',       duration: '8 min',  status: 'Resolved' },
  { time: '13:25', machine: 'M3', reason: 'Yarn Break',        duration: '14 min', status: 'Active' },
  { time: '12:05', machine: 'M1', reason: 'Doffing Cycle',     duration: '15 min', status: 'Resolved' },
  { time: '09:15', machine: 'M2', reason: 'Power Fluctuation', duration: '5 min',  status: 'Resolved' },
];

const BreaksPage = ({ workers }) => {
  const currentOnBreak = LIVE_ON_BREAK.length;
  const unauthorizedCount = LIVE_ON_BREAK.filter(b => b.durationMins > 15).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Floor Coverage & Break Tracking</h2>
        <p className="page-subtitle">Ensure machines are always attended and track unauthorized idle time</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value" style={{color: '#3b82f6'}}>60</div><div className="summary-label">Total Shift Workers</div></div>
        <div className="summary-card"><div className="summary-value" style={{color: '#10b981'}}>{60 - currentOnBreak}</div><div className="summary-label">Currently Active</div></div>
        <div className="summary-card"><div className="summary-value" style={{color: '#f59e0b'}}>{currentOnBreak}</div><div className="summary-label">Currently On Break</div></div>
        <div className="summary-card" style={{background: '#fef2f2', border: '1px solid #fecaca'}}><div className="summary-value" style={{color: '#ef4444'}}>{unauthorizedCount}</div><div className="summary-label" style={{color: '#991b1b'}}>Unauthorized (&gt;15m)</div></div>
      </div>

      {/* Top Split: Coverage and Categories */}
      <div className="bottom-split" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Coverage Area Chart */}
        <div className="card">
          <div className="card-title">Shift Coverage Heatmap</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Highlights potential coverage gaps when too many workers break simultaneously</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={COVERAGE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBreak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="active" stackId="1" stroke="#10b981" fill="url(#colorActive)" name="Active on Floor" />
                <Area type="monotone" dataKey="break" stackId="1" stroke="#ef4444" fill="url(#colorBreak)" name="On Break" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Pie Chart */}
        <div className="card">
          <div className="card-title">Break Categories</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Total shift break time distribution</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={BREAK_CATEGORIES} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                  {BREAK_CATEGORIES.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} mins`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bottom-split">
        {/* Live On-Break Tracker */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Live "On Break" Tracker</div>
          <table>
            <thead><tr><th>Operator</th><th>Type</th><th>Duration</th><th>Zone / Last Seen</th><th>Status</th></tr></thead>
            <tbody>
              {LIVE_ON_BREAK.map((b, i) => {
                const isUnauthorized = b.durationMins > 15;
                return (
                  <tr key={i} className={isUnauthorized ? 'row-highlight' : ''}>
                    <td className="cell-primary">{b.worker}</td>
                    <td>{b.type}</td>
                    <td style={{ color: isUnauthorized ? '#ef4444' : 'inherit', fontWeight: isUnauthorized ? 700 : 400 }}>{b.durationMins} min</td>
                    <td className="text-muted">{b.zone}</td>
                    <td>
                      <span className={isUnauthorized ? "status-badge status-error" : "status-badge status-good"}>
                        {isUnauthorized ? 'UNAUTHORIZED' : 'AUTHORIZED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Machine Downtime Correlation */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Recent Machine Downtime</div>
          <table>
            <thead><tr><th>Time</th><th>Machine</th><th>Reason</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {DOWNTIME_EVENTS.map((d, i) => (
                <tr key={i}>
                  <td className="text-muted">{d.time}</td>
                  <td className="cell-primary">{d.machine}</td>
                  <td>{d.reason}</td>
                  <td>{d.duration}</td>
                  <td>
                    <span className={d.status === 'Resolved' ? 'status-badge status-good' : 'status-badge status-error'}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BreaksPage;
