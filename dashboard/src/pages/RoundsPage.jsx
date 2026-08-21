import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, RadialBarChart, RadialBar, Cell } from 'recharts';

const NAMES = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };

const SCATTER_DATA = [
  { time: 8.0, duration: 6.2, worker: 'Alex P.' },
  { time: 8.5, duration: 6.5, worker: 'Raj K.' },
  { time: 9.0, duration: 6.1, worker: 'Maria S.' },
  { time: 9.5, duration: 6.8, worker: 'Alex P.' },
  { time: 10.0, duration: 7.2, worker: 'Raj K.' },
  { time: 10.5, duration: 5.9, worker: 'Maria S.' },
  { time: 11.0, duration: 18.5, worker: 'Alex P.' }, // Anomaly
  { time: 11.5, duration: 6.6, worker: 'Raj K.' },
  { time: 12.0, duration: 6.3, worker: 'Maria S.' },
  { time: 13.0, duration: 6.7, worker: 'Alex P.' },
  { time: 13.5, duration: 14.2, worker: 'Raj K.' }, // Anomaly
  { time: 14.0, duration: 6.0, worker: 'Maria S.' },
  { time: 14.5, duration: 6.4, worker: 'Alex P.' },
  { time: 15.0, duration: 6.9, worker: 'Raj K.' },
  { time: 15.5, duration: 6.2, worker: 'Maria S.' },
];

const BEACON_MISSES = [
  { name: 'B1 (Front Left)', misses: 2 },
  { name: 'B2 (Front Mid)', misses: 1 },
  { name: 'B3 (Front Right)', misses: 4 },
  { name: 'B4 (Side Right)', misses: 18 }, // Hotspot
  { name: 'B5 (Back Right)', misses: 15 }, // Hotspot
  { name: 'B6 (Back Mid)', misses: 3 },
  { name: 'B7 (Back Left)', misses: 5 },
  { name: 'B8 (Side Left)', misses: 2 },
];

const PROGRESS_DISTRIBUTION = [
  { group: '0-5 Rounds', workers: 4 },
  { group: '6-10 Rounds', workers: 12 },
  { group: '11-14 Rounds', workers: 28 },
  { group: '15+ (Goal)', workers: 16 },
];

const RoundsPage = ({ workers }) => {
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const totalRounds = workerList.reduce((s, [, d]) => s + d.live.lap_count, 0);

  // Generate a fake round log
  const roundLog = [];
  workerList.forEach(([id, data]) => {
    for (let i = 1; i <= data.live.lap_count; i++) {
      const isAnomaly = Math.random() > 0.9;
      const mins = isAnomaly ? 12 + Math.floor(Math.random() * 8) : 5 + Math.floor(Math.random() * 3);
      const secs = Math.floor(Math.random() * 60);
      const beaconsHit = isAnomaly ? 8 - Math.floor(Math.random() * 4) : 8;
      roundLog.push({
        worker: NAMES[id] || id,
        machine: data.live.current_machine,
        round: i,
        duration: `${mins}m ${secs}s`,
        beaconsHit: beaconsHit,
        completedAt: new Date(Date.now() - (data.live.lap_count - i) * 420000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
  });
  roundLog.reverse();

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Advanced Patrol Tracking</h2>
        <p className="page-subtitle">Monitor operator consistency, beacon hotspots, and shift progress</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value">{totalRounds}</div><div className="summary-label">Total Rounds Completed</div></div>
        <div className="summary-card"><div className="summary-value">4.2%</div><div className="summary-label">Beacon Miss Rate</div></div>
        <div className="summary-card"><div className="summary-value">6m 42s</div><div className="summary-label">Avg Round Time</div></div>
        <div className="summary-card" style={{background: '#fef2f2', border: '1px solid #fecaca'}}><div className="summary-value" style={{color: '#ef4444'}}>2</div><div className="summary-label" style={{color: '#991b1b'}}>Time Anomalies Detected</div></div>
      </div>

      {/* Top Split: Scatter and Radial */}
      <div className="bottom-split">
        {/* Round Consistency Scatter Plot */}
        <div className="card">
          <div className="card-title">Round Consistency & Anomalies</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Identifies rounds that took unusually long to complete</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" type="number" domain={[7, 16]} tickFormatter={(v) => `${v}:00`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} name="Time of Day" />
                <YAxis dataKey="duration" type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}m`} name="Duration" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(val, name) => [name === 'Time of Day' ? `${val}:00` : `${val} mins`, name]} />
                <Legend />
                <Scatter name="Alex P." data={SCATTER_DATA.filter(d => d.worker === 'Alex P.')} fill="#3b82f6" shape="circle" />
                <Scatter name="Raj K." data={SCATTER_DATA.filter(d => d.worker === 'Raj K.')} fill="#10b981" shape="square" />
                <Scatter name="Maria S." data={SCATTER_DATA.filter(d => d.worker === 'Maria S.')} fill="#f59e0b" shape="triangle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Target Progress Distribution */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title">Shift Target Distribution</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Workers mapped by rounds completed (Goal: 15)</div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={PROGRESS_DISTRIBUTION} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val) => [`${val} Workers`, 'Count']} />
                <Bar dataKey="workers" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                   {PROGRESS_DISTRIBUTION.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.group === '15+ (Goal)' ? '#10b981' : '#3b82f6'} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bottom-split" style={{ gridTemplateColumns: '2fr 3fr' }}>
        {/* Machine Beacon Heatmap / Path */}
        <div className="card">
          <div className="card-title">Beacon Path Checkpoints</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>Standard 8-beacon machine layout</div>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
            <div style={{ width: '200px', height: '140px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '1.2rem' }}>MACHINE</span>
              
              {/* Beacons */}
              {/* Top Row */}
              <div style={{ position: 'absolute', top: '-12px', left: '10%', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</div>
              <div style={{ position: 'absolute', top: '-12px', left: '45%', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</div>
              <div style={{ position: 'absolute', top: '-12px', right: '10%', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</div>
              
              {/* Right Side */}
              <div style={{ position: 'absolute', top: '40%', right: '-12px', width: 24, height: 24, background: '#ef4444', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>4</div>
              
              {/* Bottom Row */}
              <div style={{ position: 'absolute', bottom: '-12px', right: '10%', width: 24, height: 24, background: '#ef4444', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>5</div>
              <div style={{ position: 'absolute', bottom: '-12px', left: '45%', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>6</div>
              <div style={{ position: 'absolute', bottom: '-12px', left: '10%', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>7</div>
              
              {/* Left Side */}
              <div style={{ position: 'absolute', top: '40%', left: '-12px', width: 24, height: 24, background: '#10b981', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>8</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}><div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }}></div> Hit</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div> Missed</span>
          </div>
        </div>

        {/* Missed Beacon Hotspots Bar Chart */}
        <div className="card">
          <div className="card-title">Missed Beacon Hotspots</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Highlights which checkpoints are being skipped most often</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={BEACON_MISSES} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="misses" radius={[4, 4, 0, 0]}>
                  {BEACON_MISSES.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.misses > 10 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Round log table */}
      <div className="card table-card" style={{ marginBottom: '20px' }}>
        <div className="card-title" style={{ padding: '18px 18px 0' }}>Recent Patrol Log</div>
        <table>
          <thead>
            <tr><th>Time</th><th>Operator</th><th>Machine</th><th>Round #</th><th>Duration</th><th>Beacons</th></tr>
          </thead>
          <tbody>
            {roundLog.slice(0, 10).map((r, i) => (
              <tr key={i} className={r.beaconsHit < 8 || parseInt(r.duration) > 10 ? 'row-highlight' : ''}>
                <td className="text-muted">{r.completedAt}</td>
                <td className="cell-primary">{r.worker}</td>
                <td>{r.machine}</td>
                <td>#{r.round}</td>
                <td style={{ color: parseInt(r.duration) > 10 ? '#ef4444' : 'inherit', fontWeight: parseInt(r.duration) > 10 ? 700 : 400 }}>{r.duration}</td>
                <td>
                  <span className={r.beaconsHit === 8 ? "status-badge status-good" : "status-badge status-error"}>
                    {r.beaconsHit}/8
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoundsPage;
