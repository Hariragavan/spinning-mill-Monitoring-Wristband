import React from 'react';
import SummaryCard from '../components/SummaryCard';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const BreaksPage = ({ workers = {}, telemetryLogs = [] }) => {
  const workerList = Object.entries(workers).filter(([, data]) => data?.live);

  // Extract real workers on break or stationary (idle >= 3s)
  const liveOnBreak = workerList
    .filter(([, data]) => data.live.motion_state === 'stationary' || data.live.break_mode !== 'none')
    .map(([id, data]) => {
      const idleSec = data.live.idle_duration_sec || 0;
      const breakSec = data.live.break_duration_sec || 0;
      const totalSec = idleSec + breakSec;
      return {
        id,
        worker: data.live.device_id || `W${id.split('_')[1] || id}`,
        machine: data.live.current_machine || 'M1',
        type: data.live.break_mode !== 'none' ? data.live.break_mode : 'Stationary Idle',
        durationSec: totalSec,
        durationMins: Math.floor(totalSec / 60),
        zone: data.live.last_beacon_id || 'Side A',
      };
    });

  const currentOnBreak = liveOnBreak.length;
  const unauthorizedCount = liveOnBreak.filter(b => b.durationSec > 180).length; // idle > 3 mins

  // Real breakdown of time across floor
  const walkingCount = workerList.filter(([, d]) => d.live.motion_state === 'walking').length;
  const stationaryCount = workerList.filter(([, d]) => d.live.motion_state === 'stationary' && (d.live.idle_duration_sec || 0) < 180).length;
  const extendedIdleCount = workerList.filter(([, d]) => (d.live.idle_duration_sec || 0) >= 180).length;

  const breakCategories = [
    { name: 'Active Patrolling', value: walkingCount || (workerList.length === 0 ? 1 : 0) },
    { name: 'Normal Stop / Idle (<3m)', value: stationaryCount },
    { name: 'Extended Idle (>3m)', value: extendedIdleCount },
  ];

  // Dynamic Shift Coverage over today's shift hours
  const currentHour = new Date().getHours();
  const coverageData = Array.from({ length: 8 }, (_, i) => {
    const h = (currentHour - 7 + i + 24) % 24;
    return {
      time: `${h < 10 ? '0' : ''}${h}:00`,
      active: walkingCount,
      break: currentOnBreak,
    };
  });

  // Recent Machine Downtime / Idle events from actual logs and workers
  const realIdleEvents = [];
  workerList.forEach(([id, data]) => {
    const live = data.live;
    if (live.idle_duration_sec >= 3) {
      realIdleEvents.push({
        time: new Date(live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        machine: live.current_machine || 'M1',
        reason: live.idle_duration_sec > 180 ? 'Extended Machine Idle' : 'Stationary at Checkpoint',
        duration: `${live.idle_duration_sec}s`,
        status: live.idle_duration_sec > 180 ? 'Review' : 'Active',
      });
    }
  });

  // Add historical logs from telemetry_logs if available
  telemetryLogs
    .filter(l => l.event === 'EMERGENCY_ASSIST' || (l.payload && l.payload.idle_duration_sec > 10))
    .slice(0, 5)
    .forEach(log => {
      realIdleEvents.push({
        time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        machine: (log.station_id || log.target_beacon) ? (log.station_id || log.target_beacon).split('-')[0] : 'M1',
        reason: log.event === 'EMERGENCY_ASSIST' ? 'Assistance Button Pressed' : 'Stationary Timeout',
        duration: log.payload?.idle_duration_sec ? `${log.payload.idle_duration_sec}s` : '—',
        status: 'Resolved',
      });
    });

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Floor Coverage & Break Tracking</h2>
        <p className="page-subtitle">Real-time operator presence, idle duration monitoring, and stoppage analysis</p>
      </div>

      <div className="summary-row">
        <SummaryCard label="Total Floor Operators" value={workerList.length} status="Shift roster" icon="user" tone="blue" />
        <SummaryCard label="Actively Patrolling" value={workerList.length - currentOnBreak} status="On floor patrol" icon="activity" tone="green" />
        <SummaryCard label="Stationary / On Break" value={currentOnBreak} status="Current telemetry" icon="clock" tone="amber" />
        <SummaryCard label="Extended Idle (>3m)" value={unauthorizedCount} status={unauthorizedCount > 0 ? 'Review required' : 'All operators within limits'} icon="alerts" tone={unauthorizedCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Top Split: Coverage and Categories */}
      <div className="bottom-split" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Coverage Area Chart */}
        <div className="card">
          <div className="card-title">Shift Coverage Overview</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
            Real-time ratio of active patrol vs. idle/break state
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={coverageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBreak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="active" stackId="1" stroke="#10b981" fill="url(#colorActive)" name="Active Patrolling" />
                <Area type="monotone" dataKey="break" stackId="1" stroke="#f59e0b" fill="url(#colorBreak)" name="Stationary / Idle" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Pie Chart */}
        <div className="card">
          <div className="card-title">State Distribution</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>
            Live proportion of operator floor activity
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={breakCategories} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                  {breakCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} Operators`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bottom-split">
        {/* Live On-Break Tracker */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Live Operator Stoppage Tracker</div>
          <table>
            <thead>
              <tr>
                <th>Operator</th>
                <th>Machine</th>
                <th>State</th>
                <th>Duration</th>
                <th>Checkpoint</th>
                <th>Alert Status</th>
              </tr>
            </thead>
            <tbody>
              {liveOnBreak.map((b, i) => {
                const isExtended = b.durationSec > 180;
                return (
                  <tr key={i} className={isExtended ? 'row-highlight' : ''}>
                    <td className="cell-primary">{b.worker}</td>
                    <td>{b.machine}</td>
                    <td>{b.type}</td>
                    <td style={{ color: isExtended ? '#ef4444' : 'inherit', fontWeight: isExtended ? 700 : 400 }}>
                      {b.durationSec > 60 ? `${b.durationMins}m ${b.durationSec % 60}s` : `${b.durationSec}s`}
                    </td>
                    <td className="text-muted">{b.zone}</td>
                    <td>
                      <span className={isExtended ? "status-badge status-alert" : "status-badge status-idle"}>
                        {isExtended ? 'EXTENDED IDLE' : 'NORMAL IDLE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {liveOnBreak.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>
                    All registered operators are currently active and patrolling.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Machine Downtime / Idle Events */}
        <div className="card table-card">
          <div className="card-title" style={{ padding: '18px 18px 0' }}>Recent Stoppage & Idle Events</div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Machine</th>
                <th>Event / Reason</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {realIdleEvents.map((d, i) => (
                <tr key={i}>
                  <td className="text-muted">{d.time}</td>
                  <td className="cell-primary">{d.machine}</td>
                  <td>{d.reason}</td>
                  <td>{d.duration}</td>
                  <td>
                    <span className={d.status === 'Review' ? 'status-badge status-alert' : 'status-badge status-good'}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {realIdleEvents.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>
                    No stoppage or downtime events recorded.
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

export default BreaksPage;
