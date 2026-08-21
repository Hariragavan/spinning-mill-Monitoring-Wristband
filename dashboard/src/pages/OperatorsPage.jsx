import React from 'react';

const WORKER_PROFILES = {
  worker_1: { name: 'Alex Patel',  role: 'Senior Operator', shift: 'Morning (6AM\u20132PM)',  avatar: 'AP' },
  worker_2: { name: 'Raj Kumar',   role: 'Operator',        shift: 'Morning (6AM\u20132PM)',  avatar: 'RK' },
  worker_3: { name: 'Maria Singh', role: 'Operator',        shift: 'Morning (6AM\u20132PM)',  avatar: 'MS' },
  worker_4: { name: 'Priya Devi',  role: 'Junior Operator', shift: 'Afternoon (2PM\u201310PM)', avatar: 'PD' },
  worker_5: { name: 'Arun Yadav',  role: 'Senior Operator', shift: 'Afternoon (2PM\u201310PM)', avatar: 'AY' },
  worker_6: { name: 'Sita Ram',    role: 'Operator',        shift: 'Night (10PM\u20136AM)',   avatar: 'SR' },
};

const COLORS = ['#3b82f6', '#8b5cf6', '#e91e63', '#14b8a6', '#f59e0b', '#6366f1'];

const OperatorsPage = ({ workers }) => {
  const allWorkers = { ...WORKER_PROFILES };
  // Merge live data where available
  const mergedList = Object.entries(allWorkers).map(([id, profile], idx) => {
    const live = workers[id]?.live || null;
    return { id, ...profile, live, color: COLORS[idx % COLORS.length] };
  });

  const activeCount = mergedList.filter(w => w.live && w.live.motion_state === 'walking').length;
  const onShiftCount = mergedList.filter(w => w.live).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Operators</h2>
        <p className="page-subtitle">All registered operators and their current shift status</p>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-value">{mergedList.length}</div>
          <div className="summary-label">Total Operators</div>
        </div>
        <div className="summary-card">
          <div className="summary-value green">{onShiftCount}</div>
          <div className="summary-label">On Shift Now</div>
        </div>
        <div className="summary-card">
          <div className="summary-value green">{activeCount}</div>
          <div className="summary-label">Currently Active</div>
        </div>
        <div className="summary-card">
          <div className="summary-value amber">{onShiftCount - activeCount}</div>
          <div className="summary-label">Idle / Break</div>
        </div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Operator</th>
              <th>Role</th>
              <th>Shift</th>
              <th>Current Machine</th>
              <th>Last Beacon</th>
              <th>Steps</th>
              <th>Rounds</th>
              <th>Battery</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mergedList.map((w) => {
              const statusCls = !w.live ? 'status-muted'
                : w.live.incident_type !== 'none' ? 'status-alert'
                : w.live.motion_state === 'stationary' ? 'status-idle'
                : 'status-good';
              const statusText = !w.live ? 'Off Shift'
                : w.live.incident_type !== 'none' ? w.live.incident_type.replace('_', ' ')
                : w.live.motion_state === 'stationary' ? 'Idle'
                : 'Active';
              return (
                <tr key={w.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="table-avatar" style={{ background: w.color }}>{w.avatar}</div>
                      <div>
                        <div className="cell-primary">{w.name}</div>
                        <div className="cell-secondary">{w.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{w.role}</td>
                  <td>{w.shift}</td>
                  <td>{w.live ? w.live.current_machine : '\u2014'}</td>
                  <td>{w.live ? w.live.last_beacon_id : '\u2014'}</td>
                  <td>{w.live ? w.live.total_steps.toLocaleString() : '\u2014'}</td>
                  <td>{w.live ? w.live.lap_count : '\u2014'}</td>
                  <td>
                    {w.live ? (
                      <div className="battery-indicator">
                        <div className="battery-bar" style={{ width: `${w.live.wristband_battery_pct}%`, background: w.live.wristband_battery_pct < 20 ? 'var(--red)' : 'var(--green)' }} />
                        <span>{w.live.wristband_battery_pct}%</span>
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td><span className={`status-badge ${statusCls}`}>{statusText}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OperatorsPage;
