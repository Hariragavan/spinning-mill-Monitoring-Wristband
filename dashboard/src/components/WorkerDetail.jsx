import React from 'react';
import { ArrowLeft, Activity, User, Battery, Radio, AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const WorkerDetail = ({ workerId, workerData, onBack }) => {
  if (!workerData || !workerData.live) return <div>No data available</div>;

  const { live, history } = workerData;

  // Format history for chart
  const chartData = history ? Object.keys(history).slice(-7).map(date => ({
    name: date.split('-').slice(1).join('/'),
    hours: parseFloat(history[date].total_hours_worked)
  })) : [];

  const getStatusColorClass = () => {
    if (live.incident_type !== 'none') return 'status-alert';
    if (live.motion_state === 'stationary' && live.idle_duration_sec > 60) return 'status-idle';
    return 'status-good';
  };
  
  const statusText = live.incident_type !== 'none' 
    ? `Incident: ${live.incident_type}` 
    : (live.motion_state === 'stationary' && live.idle_duration_sec > 60) 
      ? `Idle (${Math.floor(live.idle_duration_sec / 60)}m)` 
      : 'Active';

  return (
    <div>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Overview
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={24} />
            Worker {workerId.split('_')[1]}
          </h2>
          <div style={{ color: 'var(--text-secondary)' }}>ID: {live.device_id} | Location: {live.current_machine}</div>
        </div>
        <div className={`status-badge ${getStatusColorClass()}`}>
          {statusText}
        </div>
      </div>

      <div className="grid-2x2">
        {/* Patrol Tracking */}
        <div className="card">
          <h3 className="card-title"><Radio size={18} /> Patrol Tracking</h3>
          <div className="data-row">
            <span className="data-label">Last Beacon</span>
            <span className="data-value">{live.last_beacon_id} ({live.current_zone})</span>
          </div>
          <div className="data-row">
            <span className="data-label">Beacon RSSI</span>
            <span className="data-value">{live.beacon_rssi} dBm</span>
          </div>
          <div className="data-row">
            <span className="data-label">Lap Time</span>
            <span className="data-value">{live.lap_duration_sec} sec</span>
          </div>
          <div className="data-row">
            <span className="data-label">Heading</span>
            <span className="data-value">{live.directional_heading}</span>
          </div>
        </div>

        {/* Motion & Ergonomics */}
        <div className="card">
          <h3 className="card-title"><Activity size={18} /> Motion & Ergonomics</h3>
          <div className="data-row">
            <span className="data-label">Steps (Round)</span>
            <span className="data-value">{live.total_steps}</span>
          </div>
          <div className="data-row">
            <span className="data-label">Cadence</span>
            <span className="data-value">{live.steps_per_min_cadence} spm</span>
          </div>
          <div className="data-row">
            <span className="data-label">Walking Speed</span>
            <span className="data-value">{live.walking_speed_ms} m/s</span>
          </div>
          <div className="data-row">
            <span className="data-label">Arm Intensity</span>
            <span className="data-value">{live.arm_motion_intensity}%</span>
          </div>
        </div>

        {/* Shift & Break */}
        <div className="card">
          <h3 className="card-title"><User size={18} /> Shift & Break</h3>
          <div className="data-row">
            <span className="data-label">Login Time</span>
            <span className="data-value">{new Date(live.login_timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="data-row">
            <span className="data-label">Break Mode</span>
            <span className="data-value">{live.break_mode}</span>
          </div>
          <div className="data-row">
            <span className="data-label">Break Duration</span>
            <span className="data-value">{live.break_duration_sec} sec</span>
          </div>
          <div className="data-row">
            <span className="data-label">Doffing Cycle</span>
            <span className="data-value">{live.doffing_cycle_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        {/* Device Health */}
        <div className="card">
          <h3 className="card-title"><Battery size={18} /> Device Health</h3>
          <div className="data-row">
            <span className="data-label">Wristband Battery</span>
            <span className="data-value">
              <span style={{ color: live.wristband_battery_pct < 20 ? 'var(--status-alert)' : 'inherit' }}>
                {live.wristband_battery_pct}%
              </span>
            </span>
          </div>
          <div className="data-row">
            <span className="data-label">Beacon Battery</span>
            <span className="data-value">{live.beacon_battery_pct}%</span>
          </div>
          <div className="data-row">
            <span className="data-label">Packet Latency</span>
            <span className="data-value">{live.packet_latency_ms} ms</span>
          </div>
          <div className="data-row">
            <span className="data-label">Last Updated</span>
            <span className="data-value">{new Date(live.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Attendance and Hours */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Attendance & Working Hours</h3>
        <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
          <div>
            <div className="data-label">Days Worked (Month)</div>
            <div className="big-stat">{history ? Object.keys(history).length : 0}</div>
          </div>
          <div>
            <div className="data-label">Rounds Completed</div>
            <div className="big-stat">{live.lap_count}</div>
          </div>
        </div>
        
        {chartData.length > 0 && (
          <div style={{ height: '200px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f4f7f6'}} />
                <Bar dataKey="hours" fill="#4caf50" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerDetail;
