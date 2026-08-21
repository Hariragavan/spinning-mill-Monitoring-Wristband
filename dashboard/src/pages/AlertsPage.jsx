import React from 'react';

const SEVERITY = {
  critical: { label: 'Critical', cls: 'status-alert' },
  warning:  { label: 'Warning',  cls: 'status-idle' },
  info:     { label: 'Info',     cls: 'status-info' },
};

const AlertsPage = ({ workers }) => {
  // Build live alerts from worker data
  const liveAlerts = [];
  Object.entries(workers).forEach(([id, data]) => {
    if (!data?.live) return;
    const wName = `W${id.split('_')[1]}`;
    if (data.live.incident_type !== 'none') {
      liveAlerts.push({
        time: new Date(data.live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity: 'critical',
        source: wName,
        message: `${data.live.incident_type.replace('_', ' ')} detected at ${data.live.incident_zone || data.live.current_machine}`,
        status: 'Active',
      });
    }
    if (data.live.motion_state === 'stationary' && data.live.idle_duration_sec > 120) {
      liveAlerts.push({
        time: new Date(data.live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity: 'warning',
        source: wName,
        message: `Idle for ${Math.floor(data.live.idle_duration_sec / 60)} minutes at ${data.live.last_beacon_id}`,
        status: 'Active',
      });
    }
    if (data.live.wristband_battery_pct < 25) {
      liveAlerts.push({
        time: new Date(data.live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity: 'warning',
        source: wName,
        message: `Wristband battery low: ${data.live.wristband_battery_pct}%`,
        status: 'Active',
      });
    }
  });

  const HISTORY = [
    { time: '11:02 AM', severity: 'critical', source: 'M2',  message: 'Spindle jam on spindle #14',            status: 'Resolved' },
    { time: '10:30 AM', severity: 'warning',  source: 'W3',  message: 'Idle duration exceeded 5 min threshold', status: 'Resolved' },
    { time: '09:45 AM', severity: 'critical', source: 'M3',  message: 'Yarn break detected at M3-B2',          status: 'Resolved' },
    { time: '09:15 AM', severity: 'info',     source: 'SYS', message: 'Gateway reconnected after brief dropout', status: 'Resolved' },
    { time: '08:50 AM', severity: 'warning',  source: 'W1',  message: 'Wristband battery below 30%',           status: 'Resolved' },
    { time: '08:30 AM', severity: 'info',     source: 'M1',  message: 'Doffing cycle completed successfully',  status: 'Resolved' },
    { time: '07:45 AM', severity: 'warning',  source: 'W2',  message: 'No beacon signal for 60 seconds',       status: 'Resolved' },
    { time: '07:15 AM', severity: 'critical', source: 'M2',  message: 'Power fluctuation detected',            status: 'Resolved' },
  ];

  const allAlerts = [...liveAlerts, ...HISTORY];
  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = allAlerts.filter(a => a.severity === 'warning').length;
  const activeCount = allAlerts.filter(a => a.status === 'Active').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Alerts</h2>
        <p className="page-subtitle">Live and historical alerts from machines, operators, and system</p>
      </div>

      <div className="summary-row">
        <div className="summary-card"><div className="summary-value">{allAlerts.length}</div><div className="summary-label">Total Alerts Today</div></div>
        <div className="summary-card"><div className="summary-value red">{criticalCount}</div><div className="summary-label">Critical</div></div>
        <div className="summary-card"><div className="summary-value amber">{warningCount}</div><div className="summary-label">Warnings</div></div>
        <div className="summary-card"><div className="summary-value" style={{ color: activeCount > 0 ? 'var(--red)' : 'var(--green)' }}>{activeCount}</div><div className="summary-label">Active Now</div></div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr><th>Time</th><th>Severity</th><th>Source</th><th>Message</th><th>Status</th></tr>
          </thead>
          <tbody>
            {allAlerts.map((a, i) => {
              const sev = SEVERITY[a.severity] || SEVERITY.info;
              return (
                <tr key={i} className={a.status === 'Active' ? 'row-highlight' : ''}>
                  <td className="text-muted">{a.time}</td>
                  <td><span className={`status-badge ${sev.cls}`}>{sev.label}</span></td>
                  <td className="cell-primary">{a.source}</td>
                  <td>{a.message}</td>
                  <td>
                    <span className={a.status === 'Active' ? 'text-red' : 'text-green'}>
                      {a.status === 'Active' ? '\u25cf Active' : '\u2713 Resolved'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertsPage;
