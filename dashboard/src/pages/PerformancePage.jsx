import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  efficiency: Math.round((88 + Math.sin(h * 0.5) * 5 + (Math.random() - 0.5) * 3) * 10) / 10,
  target: 92,
}));

const Gauge = ({ value, label, color }) => {
  const data = [
    { name: 'Value', value: value },
    { name: 'Remaining', value: 100 - value }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 140, height: 75, position: 'relative' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={50} outerRadius={70} stroke="none" dataKey="value">
              <Cell fill={color} />
              <Cell fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          {value}%
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
};

const PerformancePage = ({ workers }) => {
  const workerList = Object.entries(workers).filter(([, data]) => data?.live);
  const machineData = ['M1', 'M2', 'M3'].map(machine => {
    const machineWorkers = workerList.filter(([, data]) => data.live.current_machine === machine);
    const walking = machineWorkers.filter(([, data]) => data.live.motion_state === 'walking').length;
    const efficiency = machineWorkers.length ? Math.round((walking / machineWorkers.length) * 1000) / 10 : 0;
    const uptime = machineWorkers.length ? Math.round((machineWorkers.length / Math.max(workerList.length, 1)) * 1000) / 10 : 0;
    const output = machineWorkers.reduce((sum, [, data]) => sum + (data.live.total_steps || 0), 0);
    return { name: machine, efficiency, uptime, output, trend: [{ v: efficiency }, { v: efficiency }, { v: efficiency }] };
  });
  const totalOutput = workerList.reduce((sum, [, data]) => sum + (data.live.total_steps || 0), 0);
  const timelineData = workerList.map(([id, data]) => {
    const live = data.live;
    const elapsedMinutes = Math.max(0, (live.timestamp - (live.login_timestamp || live.timestamp)) / 60000);
    return {
      name: `W${id.split('_')[1]}`,
      M1: live.current_machine === 'M1' ? Math.max(0, Math.round(elapsedMinutes - (live.idle_duration_sec || 0) / 60)) : 0,
      M2: live.current_machine === 'M2' ? Math.max(0, Math.round(elapsedMinutes - (live.idle_duration_sec || 0) / 60)) : 0,
      M3: live.current_machine === 'M3' ? Math.max(0, Math.round(elapsedMinutes - (live.idle_duration_sec || 0) / 60)) : 0,
      Idle: Math.round((live.idle_duration_sec || 0) / 60),
    };
  });
  const overallEfficiency = machineData.filter(machine => machine.efficiency > 0).length
    ? Math.round(machineData.reduce((sum, machine) => sum + machine.efficiency, 0) / machineData.filter(machine => machine.efficiency > 0).length)
    : 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Live Performance Monitoring</h2>
        <p className="page-subtitle">Real-time predictive analytics and machine health</p>
      </div>

      {/* Live Gauges Row */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '30px 20px' }}>
        <Gauge value={machineData[0].efficiency} label="M1 Efficiency" color="#10b981" />
        <div style={{ width: '1px', height: '60px', background: '#e2e8f0' }}></div>
        <Gauge value={machineData[1].efficiency} label="M2 Efficiency" color="#ef4444" />
        <div style={{ width: '1px', height: '60px', background: '#e2e8f0' }}></div>
        <Gauge value={machineData[2].efficiency} label="M3 Efficiency" color="#f59e0b" />
        <div style={{ width: '1px', height: '60px', background: '#e2e8f0' }}></div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{totalOutput.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live Output (Units)</div>
        </div>
      </div>

      <div style={{ display: 'block', marginBottom: '20px' }}>
        {/* Machine Performance with Sparklines */}
        <div className="card">
          <div className="card-title">Live Machine Health</div>
          <table>
            <thead><tr><th>Machine</th><th>Efficiency</th><th>10m Trend</th><th>Uptime</th><th>Output</th></tr></thead>
            <tbody>
              {machineData.map(m => {
                const color = m.efficiency >= 92 ? '#10b981' : m.efficiency >= 89 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={m.name}>
                    <td className="cell-primary">{m.name}</td>
                    <td><span style={{ color, fontWeight: 700 }}>{m.efficiency}%</span></td>
                    <td style={{ width: '100px' }}>
                      <div style={{ width: '80px', height: '24px' }}>
                        <ResponsiveContainer>
                          <LineChart data={m.trend}>
                            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td>{m.uptime}%</td>
                    <td>{m.output.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bottom-split">
        {/* Operator Timeline */}
        <div className="card">
          <div className="card-title">Operator Shift Timeline</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Where each operator spent their time today (mins)</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={timelineData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#0f172a', fontWeight: 600 }} width={70} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" />
                <Bar dataKey="M1" stackId="a" fill="#3b82f6" name="Machine 1" radius={[4, 0, 0, 4]} />
                <Bar dataKey="M2" stackId="a" fill="#10b981" name="Machine 2" />
                <Bar dataKey="M3" stackId="a" fill="#f59e0b" name="Machine 3" />
                <Bar dataKey="Idle" stackId="a" fill="#cbd5e1" name="Idle / Break" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Existing Area Chart */}
        <div className="card">
          <div className="card-title">Overall Efficiency Trend</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={HOURLY.map(point => ({ ...point, efficiency: overallEfficiency || point.efficiency }))} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={4} />
                <YAxis domain={[75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
                <Tooltip />
                <Area type="monotone" dataKey="efficiency" stroke="#14b8a6" strokeWidth={2} fill="url(#perfGrad)" dot={false} name="Efficiency" />
                <Area type="monotone" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" fill="none" dot={false} name="Target" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformancePage;
