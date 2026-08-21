import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  efficiency: Math.round((88 + Math.sin(h * 0.5) * 5 + (Math.random() - 0.5) * 3) * 10) / 10,
  target: 92,
}));

const PER_MACHINE = [
  { name: 'M1', efficiency: 94.2, uptime: 97.1, output: 3200 },
  { name: 'M2', efficiency: 91.8, uptime: 95.4, output: 3050 },
  { name: 'M3', efficiency: 89.5, uptime: 93.2, output: 2900 },
];

const PER_WORKER = [
  { name: 'W1: Alex', rounds: 12, avgLapTime: '6m 20s', steps: 4800, speed: '1.3 m/s' },
  { name: 'W2: Raj',  rounds: 9,  avgLapTime: '7m 05s', steps: 3600, speed: '1.1 m/s' },
  { name: 'W3: Maria', rounds: 7, avgLapTime: '7m 40s', steps: 2900, speed: '1.0 m/s' },
];

const PerformancePage = ({ workers }) => {
  const workerList = Object.values(workers).filter(w => w?.live);
  const avgEfficiency = workerList.length > 0
    ? (workerList.reduce((s, w) => s + (w.live.motion_state === 'walking' ? 95 : 82), 0) / workerList.length).toFixed(1)
    : '0.0';

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Performance</h2>
        <p className="page-subtitle">Real-time and historical performance metrics across machines and operators</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value green">{avgEfficiency}%</div><div className="summary-label">Current Efficiency</div></div>
        <div className="summary-card"><div className="summary-value">92.0%</div><div className="summary-label">Target Efficiency</div></div>
        <div className="summary-card"><div className="summary-value green">97.1%</div><div className="summary-label">Best Machine Uptime</div></div>
        <div className="summary-card"><div className="summary-value">9,150</div><div className="summary-label">Total Output (units)</div></div>
      </div>

      {/* Efficiency Trend */}
      <div className="card">
        <div className="card-title">Efficiency vs Target \u2014 24hr</div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={HOURLY} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval={3} />
              <YAxis domain={[75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="efficiency" stroke="#14b8a6" strokeWidth={2} fill="url(#perfGrad)" dot={false} name="Efficiency" />
              <Area type="monotone" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" fill="none" dot={false} name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bottom-split">
        {/* Per Machine */}
        <div className="card">
          <div className="card-title">Machine Performance</div>
          <table>
            <thead><tr><th>Machine</th><th>Efficiency</th><th>Uptime</th><th>Output</th></tr></thead>
            <tbody>
              {PER_MACHINE.map(m => (
                <tr key={m.name}>
                  <td className="cell-primary">{m.name}</td>
                  <td><span className={m.efficiency >= 92 ? 'text-green' : 'text-amber'}>{m.efficiency}%</span></td>
                  <td>{m.uptime}%</td>
                  <td>{m.output.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per Worker */}
        <div className="card">
          <div className="card-title">Operator Performance</div>
          <table>
            <thead><tr><th>Operator</th><th>Rounds</th><th>Avg Lap</th><th>Steps</th><th>Speed</th></tr></thead>
            <tbody>
              {PER_WORKER.map(w => (
                <tr key={w.name}>
                  <td className="cell-primary">{w.name}</td>
                  <td>{w.rounds}</td>
                  <td>{w.avgLapTime}</td>
                  <td>{w.steps.toLocaleString()}</td>
                  <td>{w.speed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformancePage;
