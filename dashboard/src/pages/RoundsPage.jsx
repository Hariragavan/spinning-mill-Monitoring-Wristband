import React, { useState } from 'react';
import SummaryCard from '../components/SummaryCard';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts';

const NAMES = { worker_1: 'Alex P.', worker_2: 'Raj K.', worker_3: 'Maria S.' };
const BEACONS = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1'];

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

const RoundsPage = ({ workers }) => {
  const [selectedMachine, setSelectedMachine] = useState('M1');
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const selectedMachineWorkers = workerList.filter(([, data]) => data.live.current_machine === selectedMachine);
  const selectedBeaconIds = selectedMachineWorkers.map(([, data]) => data.live.last_beacon_id).filter(Boolean);
  const selectedBeacon = selectedBeaconIds.find(beacon => beacon.startsWith(`${selectedMachine}-`))?.replace(`${selectedMachine}-`, '');
  const totalRounds = workerList.reduce((sum, [, data]) => sum + (data.live.lap_count || 0), 0);
  const lapDurations = workerList.map(([, data]) => data.live.lap_duration_sec || 0).filter(Boolean);
  const averageLapMinutes = lapDurations.length ? lapDurations.reduce((sum, value) => sum + value, 0) / lapDurations.length / 60 : 0;
  const anomalies = lapDurations.filter(duration => duration > 600).length;
  const progressDistribution = [
    { group: '0-5 Rounds', workers: workerList.filter(([, data]) => (data.live.lap_count || 0) <= 5).length },
    { group: '6-10 Rounds', workers: workerList.filter(([, data]) => data.live.lap_count > 5 && data.live.lap_count <= 10).length },
    { group: '11-14 Rounds', workers: workerList.filter(([, data]) => data.live.lap_count > 10 && data.live.lap_count < 15).length },
    { group: '15+ (Goal)', workers: workerList.filter(([, data]) => data.live.lap_count >= 15).length },
  ];
  const scatterData = workerList.map(([id, data]) => ({
    time: new Date(data.live.timestamp || 0).getHours() + new Date(data.live.timestamp || 0).getMinutes() / 60,
    duration: (data.live.lap_duration_sec || 0) / 60,
    worker: NAMES[id] || id,
  }));

  const roundLog = workerList.map(([id, data]) => ({
    worker: NAMES[id] || id,
    machine: data.live.current_machine || 'Unknown',
    round: data.live.lap_count || 0,
    duration: `${Math.floor((data.live.lap_duration_sec || 0) / 60)}m ${(data.live.lap_duration_sec || 0) % 60}s`,
    beaconsHit: data.live.last_beacon_id ? 1 : 0,
    completedAt: 'In progress',
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Advanced Patrol Tracking</h2>
        <p className="page-subtitle">Monitor operator consistency, beacon hotspots, and shift progress</p>
      </div>

      <div className="summary-row">
        <SummaryCard label="Total Rounds Completed" value={totalRounds} status="Live patrol count" icon="route" tone="blue" />
        <SummaryCard label="Beacon Signal Coverage" value={workerList.length ? `${Math.round((workerList.filter(([, data]) => data.live.last_beacon_id).length / workerList.length) * 100)}%` : '0%'} status="Current telemetry" icon="radio" tone="green" />
        <SummaryCard label="Avg Current Lap Time" value={`${Math.floor(averageLapMinutes)}m ${Math.round((averageLapMinutes % 1) * 60)}s`} status="Live lap timing" icon="clock" tone="amber" />
        <SummaryCard label="Slow Current Laps" value={anomalies} status="Review required" icon="alerts" tone="red" />
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
                <Scatter name="Live workers" data={scatterData} fill="#3b82f6" />
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
              <BarChart data={progressDistribution} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val) => [`${val} Workers`, 'Count']} />
                <Bar dataKey="workers" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                   {progressDistribution.map((entry, index) => (
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
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>Beacon Path Checkpoints</span>
            <select value={selectedMachine} onChange={event => setSelectedMachine(event.target.value)} aria-label="Choose machine for beacon checkpoints" style={{ padding: '6px 9px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', color: '#334155', fontSize: '0.75rem', fontWeight: 600 }}>
              {['M1', 'M2', 'M3'].map(machine => <option key={machine} value={machine}>Machine {machine}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>{selectedMachineWorkers.length ? `${selectedMachineWorkers.length} worker${selectedMachineWorkers.length > 1 ? 's' : ''} detected on ${selectedMachine}` : `No worker detected on ${selectedMachine}`} {selectedBeacon ? `• Last beacon ${selectedBeacon}` : ''}</div>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
            <div style={{ width: '200px', height: '140px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '1.2rem' }}>{selectedMachine}</span>
              
              {/* Beacons */}
              {/* Top Row */}
              {BEACONS.slice(0, 3).map((beacon, index) => <div key={beacon} style={{ position: 'absolute', top: '-12px', left: index === 0 ? '10%' : index === 1 ? '45%' : undefined, right: index === 2 ? '10%' : undefined, width: 24, height: 24, background: selectedBeacon === beacon ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{index + 1}</div>)}
              
              {/* Right Side */}
              <div style={{ position: 'absolute', top: '40%', right: '-12px', width: 24, height: 24, background: selectedBeacon === BEACONS[3] ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>4</div>
              
              {/* Bottom Row */}
              <div style={{ position: 'absolute', bottom: '-12px', right: '10%', width: 24, height: 24, background: selectedBeacon === BEACONS[4] ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>5</div>
              <div style={{ position: 'absolute', bottom: '-12px', left: '45%', width: 24, height: 24, background: selectedBeacon === BEACONS[5] ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>6</div>
              <div style={{ position: 'absolute', bottom: '-12px', left: '10%', width: 24, height: 24, background: selectedBeacon === BEACONS[6] ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>7</div>
              
              {/* Left Side */}
              <div style={{ position: 'absolute', top: '40%', left: '-12px', width: 24, height: 24, background: selectedBeacon === BEACONS[7] ? '#2563eb' : '#cbd5e1', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>8</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}><div style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%' }}></div> Current beacon</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: '#cbd5e1', borderRadius: '50%' }}></div> Not currently detected</span>
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
