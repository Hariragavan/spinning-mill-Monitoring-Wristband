import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

const SEVERITY = {
  critical: { label: 'Critical', cls: 'status-alert', priority: 0 },
  warning: { label: 'Warning', cls: 'status-idle', priority: 1 },
  info: { label: 'Info', cls: 'status-info', priority: 2 },
};

const HISTORY = [
  { time: '11:02 AM', severity: 'critical', source: 'M2', message: 'Spindle jam on spindle #14', status: 'Resolved' },
  { time: '10:30 AM', severity: 'warning', source: 'W3', message: 'Idle duration exceeded 5 min threshold', status: 'Resolved' },
  { time: '09:45 AM', severity: 'critical', source: 'M3', message: 'Yarn break detected at M3-B2', status: 'Resolved' },
  { time: '09:15 AM', severity: 'info', source: 'SYS', message: 'Gateway reconnected after brief dropout', status: 'Resolved' },
  { time: '08:50 AM', severity: 'warning', source: 'W1', message: 'Wristband battery below 30%', status: 'Resolved' },
  { time: '08:30 AM', severity: 'info', source: 'M1', message: 'Doffing cycle completed successfully', status: 'Resolved' },
  { time: '07:45 AM', severity: 'warning', source: 'W2', message: 'No beacon signal for 60 seconds', status: 'Resolved' },
  { time: '07:15 AM', severity: 'critical', source: 'M2', message: 'Power fluctuation detected', status: 'Resolved' },
];

const AlertsPage = ({ workers, onWorkerClick }) => {
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attention');
  const liveAlerts = [];

  Object.entries(workers).forEach(([id, data]) => {
    const live = data?.live;
    if (!live) return;
    const source = `W${id.split('_')[1]}`;
    const time = new Date(live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (live.incident_type !== 'none') liveAlerts.push({ id: `${id}-incident`, workerId: id, time, severity: 'critical', source, message: `${live.incident_type.replace('_', ' ')} detected at ${live.incident_zone || live.current_machine}`, status: 'Active' });
    if (live.motion_state === 'stationary' && live.idle_duration_sec > 120) liveAlerts.push({ id: `${id}-idle`, workerId: id, time, severity: 'warning', source, message: `Idle for ${Math.floor(live.idle_duration_sec / 60)} minutes at ${live.last_beacon_id}`, status: 'Active' });
    if (live.wristband_battery_pct < 25) liveAlerts.push({ id: `${id}-battery`, workerId: id, time, severity: 'warning', source, message: `Wristband battery low: ${live.wristband_battery_pct}%`, status: 'Active' });
  });

  const allAlerts = [...liveAlerts, ...HISTORY.map((alert, index) => ({ ...alert, id: `history-${index}` }))];
  const filteredAlerts = allAlerts.filter(alert => `${alert.source} ${alert.message}`.toLowerCase().includes(query.toLowerCase()) && (severityFilter === 'all' || alert.severity === severityFilter) && (statusFilter === 'all' || alert.status.toLowerCase() === statusFilter)).sort((a, b) => {
    if (sortBy === 'attention') return SEVERITY[a.severity].priority - SEVERITY[b.severity].priority || (a.status === 'Active' ? -1 : 1);
    if (sortBy === 'severity') return SEVERITY[a.severity].priority - SEVERITY[b.severity].priority;
    return a.status === 'Active' ? -1 : 1;
  });
  const criticalCount = allAlerts.filter(alert => alert.severity === 'critical').length;
  const warningCount = allAlerts.filter(alert => alert.severity === 'warning').length;
  const activeCount = allAlerts.filter(alert => alert.status === 'Active').length;

  return <div className="page-content">
    <div className="page-header"><h2>Alerts</h2><p className="page-subtitle">Prioritized incidents and system events requiring supervisor attention</p></div>
    <div className="summary-row">
      <div className="summary-card"><div className="summary-value">{allAlerts.length}</div><div className="summary-label">Total Alerts Today</div></div>
      <div className="summary-card"><div className="summary-value red">{criticalCount}</div><div className="summary-label">Critical</div></div>
      <div className="summary-card"><div className="summary-value amber">{warningCount}</div><div className="summary-label">Warnings</div></div>
      <div className="summary-card"><div className="summary-value" style={{ color: activeCount ? 'var(--red)' : 'var(--green)' }}>{activeCount}</div><div className="summary-label">Active Now</div></div>
    </div>
    <div className="operator-toolbar">
      <label className="operator-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search alerts or sources" aria-label="Search alerts" /></label>
      <label className="operator-select"><SlidersHorizontal size={15} aria-hidden="true" /><select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)} aria-label="Filter alert severity"><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
      <label className="operator-select"><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter alert status"><option value="all">All statuses</option><option value="active">Active</option><option value="resolved">Resolved</option></select></label>
      <label className="operator-select operator-sort"><ArrowUpDown size={15} aria-hidden="true" /><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort alerts"><option value="attention">Sort: attention</option><option value="severity">Sort: severity</option><option value="status">Sort: active first</option></select></label>
    </div>
    <div className="card table-card">
      <div className="operator-table-scroll"><table className="operator-table alert-table"><thead><tr><th>Time</th><th>Severity</th><th>Source</th><th>Message</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>
        {filteredAlerts.map(alert => { const severity = SEVERITY[alert.severity]; return <tr key={alert.id} className={alert.status === 'Active' ? 'row-highlight' : ''} onClick={() => alert.workerId && onWorkerClick(alert.workerId)}>
          <td className="text-muted">{alert.time}</td><td><span className={`status-badge ${severity.cls}`}>{alert.severity === 'critical' && <AlertTriangle size={12} />}{severity.label}</span></td><td className="cell-primary">{alert.source}</td><td>{alert.message}</td><td><span className={alert.status === 'Active' ? 'text-red' : 'text-green'}>{alert.status === 'Active' ? 'Active' : 'Resolved'}</span></td><td>{alert.workerId && <button className="icon-button" onClick={event => { event.stopPropagation(); onWorkerClick(alert.workerId); }} aria-label={`View ${alert.source}`} title="View operator details"><ChevronRight size={17} /></button>}</td>
        </tr>; })}
      </tbody></table></div>
      {!filteredAlerts.length && <div className="operator-empty"><CheckCircle2 size={22} /><span>No alerts match these filters.</span></div>}
    </div>
  </div>;
};

export default AlertsPage;
