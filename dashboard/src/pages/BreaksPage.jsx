import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NAMES = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };

const BREAK_LOG = [
  { time: '10:45 AM', worker: 'Alex P.',  type: 'Tea Break',     duration: '12 min', zone: 'M1-A3' },
  { time: '10:30 AM', worker: 'Maria S.', type: 'Restroom',      duration: '5 min',  zone: 'M3-B2' },
  { time: '09:15 AM', worker: 'Raj K.',   type: 'Lunch Break',   duration: '30 min', zone: 'M2-A1' },
  { time: '08:50 AM', worker: 'Alex P.',  type: 'Restroom',      duration: '4 min',  zone: 'M1-B4' },
  { time: '08:10 AM', worker: 'Maria S.', type: 'Tea Break',     duration: '10 min', zone: 'M3-A2' },
  { time: '07:30 AM', worker: 'Raj K.',   type: 'Restroom',      duration: '6 min',  zone: 'M2-B1' },
];

const DOWNTIME_EVENTS = [
  { time: '11:02 AM', machine: 'M2', reason: 'Spindle Jam',        duration: '8 min',  status: 'Resolved' },
  { time: '09:45 AM', machine: 'M3', reason: 'Yarn Break',         duration: '3 min',  status: 'Resolved' },
  { time: '08:30 AM', machine: 'M1', reason: 'Doffing Cycle',      duration: '15 min', status: 'Resolved' },
  { time: '07:15 AM', machine: 'M2', reason: 'Power Fluctuation',  duration: '2 min',  status: 'Resolved' },
];

const HOURLY_DOWNTIME = Array.from({ length: 12 }, (_, i) => ({
  hour: `${6 + i}:00`,
  downtime: Math.round(Math.random() * 8 + 1),
}));

const BreaksPage = ({ workers }) => {
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const totalIdleSec = workerList.reduce((s, [, d]) => s + d.live.idle_duration_sec, 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Breaks & Downtime</h2>
        <p className="page-subtitle">Worker break tracking and machine downtime events</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value">{BREAK_LOG.length}</div><div className="summary-label">Breaks Today</div></div>
        <div className="summary-card"><div className="summary-value">67 min</div><div className="summary-label">Total Break Time</div></div>
        <div className="summary-card"><div className="summary-value amber">{DOWNTIME_EVENTS.length}</div><div className="summary-label">Downtime Events</div></div>
        <div className="summary-card"><div className="summary-value">28 min</div><div className="summary-label">Total Downtime</div></div>
      </div>

      {/* Downtime chart */}
      <div className="card">
        <div className="card-title">Hourly Downtime (minutes)</div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={HOURLY_DOWNTIME} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="downtime" fill="#f59e0b" radius={[4,4,0,0]} barSize={28} name="Downtime (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bottom-split">
        {/* Break Log */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Break Log</div>
          <table>
            <thead><tr><th>Time</th><th>Operator</th><th>Type</th><th>Duration</th><th>Zone</th></tr></thead>
            <tbody>
              {BREAK_LOG.map((b, i) => (
                <tr key={i}>
                  <td className="text-muted">{b.time}</td>
                  <td className="cell-primary">{b.worker}</td>
                  <td>{b.type}</td>
                  <td>{b.duration}</td>
                  <td>{b.zone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Downtime Events */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Downtime Events</div>
          <table>
            <thead><tr><th>Time</th><th>Machine</th><th>Reason</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {DOWNTIME_EVENTS.map((d, i) => (
                <tr key={i}>
                  <td className="text-muted">{d.time}</td>
                  <td className="cell-primary">{d.machine}</td>
                  <td>{d.reason}</td>
                  <td>{d.duration}</td>
                  <td><span className="status-badge status-good">{d.status}</span></td>
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
