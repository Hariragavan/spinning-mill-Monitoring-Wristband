import React, { useState } from 'react';
import SummaryCard from '../components/SummaryCard';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATIONS_A = ['A1', 'A2', 'A3', 'A4'];
const STATIONS_B = ['B1', 'B2', 'B3', 'B4'];

const RoundsPage = ({ workers = {}, beacons = [], telemetryLogs = [] }) => {
  const [selectedMachine, setSelectedMachine] = useState('M1');
  const workerList = Object.entries(workers).filter(([, d]) => d?.live);
  const selectedMachineWorkers = workerList.filter(([, data]) => data.live.current_machine === selectedMachine);
  const primaryWorker = selectedMachineWorkers[0]?.live || workerList[0]?.live || null;

  const totalRounds = workerList.reduce((sum, [, data]) => sum + (data.live.lap_count || 0), 0);
  const lapDurations = workerList.map(([, data]) => Number(data.live.lap_duration_sec || 0)).filter(d => d > 0);
  const averageLapSeconds = lapDurations.length ? Math.round(lapDurations.reduce((sum, v) => sum + v, 0) / lapDurations.length) : 0;
  const slowLapsCount = lapDurations.filter(d => d > 300).length;

  // Real checkpoint touch counts computed from Supabase telemetry_logs
  const checkpointCounts = {};
  [...STATIONS_A, ...STATIONS_B].forEach(st => {
    checkpointCounts[st] = 0;
  });

  telemetryLogs.forEach(log => {
    const bId = log.target_beacon || log.payload?.beacon_id || '';
    [...STATIONS_A, ...STATIONS_B].forEach(st => {
      if (bId.includes(st)) {
        checkpointCounts[st] = (checkpointCounts[st] || 0) + 1;
      }
    });
  });

  const checkpointChartData = [...STATIONS_A, ...STATIONS_B].map(st => ({
    name: st,
    touches: checkpointCounts[st] || 0,
  }));

  // Target Progress Distribution based on real worker lap counts
  const progressDistribution = [
    { group: '0-5 Laps', workers: workerList.filter(([, d]) => (d.live.lap_count || 0) <= 5).length },
    { group: '6-10 Laps', workers: workerList.filter(([, d]) => (d.live.lap_count || 0) > 5 && (d.live.lap_count || 0) <= 10).length },
    { group: '11-14 Laps', workers: workerList.filter(([, d]) => (d.live.lap_count || 0) > 10 && (d.live.lap_count || 0) < 15).length },
    { group: '15+ (Goal)', workers: workerList.filter(([, d]) => (d.live.lap_count || 0) >= 15).length },
  ];

  // Real patrol log from Supabase telemetry_logs
  const realRoundEvents = telemetryLogs
    .filter(log => ['ROUND_COMPLETED', 'HALF_ROUND_COMPLETED', 'TOUCH', 'PATROL_STARTED'].includes(log.event))
    .slice(0, 10)
    .map(log => {
      const date = new Date(log.created_at);
      return {
        id: log.id || log.created_at,
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        operator: log.target_device || 'Operator 1',
        event: log.event.replace('_', ' '),
        beacon: log.target_beacon || '—',
        rssi: log.rssi ? `${log.rssi} dBm` : '—',
      };
    });

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Advanced Patrol Tracking</h2>
        <p className="page-subtitle">Real-time inspection frequency, checkpoint touches, and lap duration analytics</p>
      </div>

      <div className="summary-row">
        <SummaryCard label="Total Rounds Completed" value={`${totalRounds} Laps`} status="Recorded in database" icon="route" tone="blue" />
        <SummaryCard label="Active Floor Operators" value={workerList.length} status="On patrol" icon="radio" tone="green" />
        <SummaryCard label="Avg Current Lap Time" value={averageLapSeconds > 0 ? `${averageLapSeconds}s` : '—'} status="Realtime pace" icon="clock" tone="amber" />
        <SummaryCard label="Slow / Idle Patrols" value={slowLapsCount} status={slowLapsCount > 0 ? 'Review required' : 'Pace on target'} icon="alerts" tone={slowLapsCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Top Split: Checkpoint Activity and Target Distribution */}
      <div className="bottom-split">
        {/* Checkpoint Touches Chart */}
        <div className="card">
          <div className="card-title">Checkpoint Verification Touches</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
            Real 10 cm touch counts recorded by mill beacons (M1-A1 through M1-B4)
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={checkpointChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip formatter={v => [`${v} touches`, 'Touch Events']} />
                <Bar dataKey="touches" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {checkpointChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.touches > 0 ? '#10b981' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Target Distribution */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title">Shift Target Progress</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
            Operators grouped by completed patrol laps (Target: 15 laps)
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={progressDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip formatter={v => [`${v} Operators`, 'Count']} />
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

      {/* Frame Visual Checkpoint Overview */}
      <div className="bottom-split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Patrol Checkpoint Layout ({selectedMachine})</span>
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              aria-label="Select Machine"
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
            >
              <option value="M1">Machine M1</option>
              <option value="M2">Machine M2</option>
              <option value="M3">Machine M3</option>
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
            Current Station: <strong>{primaryWorker?.last_beacon_id || 'M1-A1'}</strong> | Heading: <strong>{primaryWorker?.directional_heading || 'Forward'}</strong>
          </div>

          <div style={{ padding: '20px 10px', background: '#fafbfc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {/* Side A */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>SIDE A (Forward Leg)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              {STATIONS_A.map(st => {
                const isCurrent = (primaryWorker?.last_beacon_id || '').includes(st);
                return (
                  <div key={st} style={{ textAlign: 'center' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: isCurrent ? '#2563eb' : '#f1f5f9', border: `2px solid ${isCurrent ? '#1d4ed8' : '#cbd5e1'}`, color: isCurrent ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', margin: '0 auto 4px', boxShadow: isCurrent ? '0 0 0 4px rgba(37,99,235,0.2)' : 'none' }}>
                      {st}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{checkpointCounts[st] || 0} hits</span>
                  </div>
                );
              })}
            </div>

            {/* Chassis */}
            <div style={{ height: '14px', background: '#0f172a', borderRadius: '4px', margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.65rem', letterSpacing: '0.1em' }}>RING SPINNING CHASSIS ({selectedMachine})</span>
            </div>

            {/* Side B */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', margin: '14px 0 6px' }}>SIDE B (Return Leg)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {STATIONS_B.map(st => {
                const isCurrent = (primaryWorker?.last_beacon_id || '').includes(st);
                return (
                  <div key={st} style={{ textAlign: 'center' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: isCurrent ? '#2563eb' : '#f1f5f9', border: `2px solid ${isCurrent ? '#1d4ed8' : '#cbd5e1'}`, color: isCurrent ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', margin: '0 auto 4px', boxShadow: isCurrent ? '0 0 0 4px rgba(37,99,235,0.2)' : 'none' }}>
                      {st}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{checkpointCounts[st] || 0} hits</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Patrol Event Log */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '16px 20px 8px' }}>
            Real-Time Patrol Log (Supabase)
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Operator</th>
                <th>Event</th>
                <th>Beacon</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {realRoundEvents.map(evt => (
                <tr key={evt.id}>
                  <td className="text-muted">{evt.time}</td>
                  <td className="cell-primary">{evt.operator}</td>
                  <td>
                    <span className="status-badge status-good">{evt.event}</span>
                  </td>
                  <td><strong>{evt.beacon}</strong></td>
                  <td className="text-muted">{evt.rssi}</td>
                </tr>
              ))}
              {realRoundEvents.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>
                    Awaiting checkpoint touch events from ESP32 beacons...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RoundsPage;
