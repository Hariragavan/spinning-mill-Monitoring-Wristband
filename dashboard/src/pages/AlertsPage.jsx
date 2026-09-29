import React, { useState } from 'react';
import SummaryCard from '../components/SummaryCard';
import { Search, SlidersHorizontal, ArrowUpDown, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

const SEVERITY = {
  critical: { label: 'Critical', cls: 'status-alert', priority: 0 },
  warning:  { label: 'Warning',  cls: 'status-idle',  priority: 1 },
  info:     { label: 'Info',     cls: 'status-info',  priority: 2 },
};

function isBeaconOnline(b) {
  if (!b) return false;
  if (b.status === 'online') {
    const timeUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    const timeSeen = b.last_seen ? new Date(b.last_seen).getTime() : 0;
    const time = Math.max(timeUpdated, timeSeen);
    if (!time) return true;
    return (Date.now() - time) < 60000;
  }
  return false;
}

const AlertsPage = ({ workers = {}, beacons = [], telemetryLogs = [], onWorkerClick }) => {
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attention');

  const liveAlerts = [];

  // 1. Live alerts from workers
  Object.entries(workers).forEach(([id, data]) => {
    const live = data?.live;
    if (!live) return;
    const source = live.device_id || `W${id.split('_')[1] || id}`;
    const time = new Date(live.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (live.assistance_request_flag || (live.incident_type && live.incident_type !== 'none')) {
      liveAlerts.push({
        id: `${id}-incident`,
        workerId: id,
        time,
        severity: 'critical',
        source,
        message: live.assistance_request_flag ? 'Assistance button pressed — Worker requests supervisor' : `${live.incident_type.replace('_', ' ')} reported at ${live.current_machine}`,
        status: 'Active',
      });
    }

    if (live.motion_state === 'stationary' && live.idle_duration_sec >= 180) {
      liveAlerts.push({
        id: `${id}-idle`,
        workerId: id,
        time,
        severity: 'warning',
        source,
        message: `Extended stationary idle: ${Math.floor(live.idle_duration_sec / 60)}m at ${live.last_beacon_id || 'machine'}`,
        status: 'Active',
      });
    }

    if (live.wristband_battery_pct < 25) {
      liveAlerts.push({
        id: `${id}-battery`,
        workerId: id,
        time,
        severity: 'warning',
        source,
        message: `Wristband battery low: ${live.wristband_battery_pct}%`,
        status: 'Active',
      });
    }
  });

  // 2. Beacons offline alerts
  beacons.forEach(b => {
    if (!isBeaconOnline(b)) {
      liveAlerts.push({
        id: `beacon-${b.beacon_id}-offline`,
        workerId: null,
        time: b.last_seen ? new Date(b.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        severity: 'warning',
        source: b.beacon_id,
        message: `Beacon checkpoint ${b.beacon_id} (${b.machine_id || 'M1'}) offline / awaiting heartbeat`,
        status: 'Active',
      });
    }
  });

  // 3. Real historical alerts from telemetry_logs
  const historyAlerts = telemetryLogs
    .filter(log => ['EMERGENCY_ASSIST', 'IDLE_TIMEOUT', 'ROUND_COMPLETED', 'TOUCH'].includes(log.event))
    .slice(0, 20)
    .map((log, index) => {
      const isCritical = log.event === 'EMERGENCY_ASSIST';
      const isWarning = log.event === 'IDLE_TIMEOUT';
      const severity = isCritical ? 'critical' : isWarning ? 'warning' : 'info';
      const date = new Date(log.created_at);

      let message = `${log.event.replace('_', ' ')} logged`;
      if (log.event === 'TOUCH') message = `Verified 10cm touch at checkpoint ${log.target_beacon || 'station'}`;
      if (log.event === 'ROUND_COMPLETED') message = `Full machine inspection round completed by ${log.target_device || 'operator'}`;
      if (log.event === 'EMERGENCY_ASSIST') message = `Emergency assistance flag raised by ${log.target_device || 'operator'}`;

      return {
        id: `log-${log.id || index}`,
        workerId: null,
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity,
        source: log.target_device || log.target_beacon || 'SYS',
        message,
        status: 'Resolved',
      };
    });

  const allAlerts = [...liveAlerts, ...historyAlerts];

  const filteredAlerts = allAlerts.filter(alert => {
    const searchable = `${alert.source} ${alert.message}`.toLowerCase();
    const matchesQuery = searchable.includes(query.toLowerCase());
    const matchesSev = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || alert.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesQuery && matchesSev && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'attention') return SEVERITY[a.severity].priority - SEVERITY[b.severity].priority || (a.status === 'Active' ? -1 : 1);
    if (sortBy === 'severity') return SEVERITY[a.severity].priority - SEVERITY[b.severity].priority;
    return a.status === 'Active' ? -1 : 1;
  });

  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = allAlerts.filter(a => a.severity === 'warning').length;
  const activeCount = allAlerts.filter(a => a.status === 'Active').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Alerts</h2>
        <p className="page-subtitle">Real-time incidents, hardware offline warnings, and telemetry log events</p>
      </div>

      <div className="summary-row">
        <SummaryCard label="Total Alert Events" value={allAlerts.length} status="Floor telemetry" icon="alerts" tone="blue" />
        <SummaryCard label="Critical" value={criticalCount} status={criticalCount > 0 ? "Immediate review" : "None active"} icon="alerts" tone={criticalCount > 0 ? "red" : "green"} />
        <SummaryCard label="Warnings" value={warningCount} status="Device & patrol alerts" icon="activity" tone="amber" />
        <SummaryCard label="Active Now" value={activeCount} status="Requiring action" icon="radio" tone={activeCount ? 'red' : 'green'} />
      </div>

      <div className="operator-toolbar">
        <label className="operator-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search alerts or devices..."
            aria-label="Search alerts"
          />
        </label>
        <label className="operator-select">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} aria-label="Filter alert severity">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="operator-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter alert status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="operator-select operator-sort">
          <ArrowUpDown size={15} aria-hidden="true" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort alerts">
            <option value="attention">Sort: Attention</option>
            <option value="severity">Sort: Severity</option>
            <option value="status">Sort: Active first</option>
          </select>
        </label>
      </div>

      <div className="card table-card">
        <div className="operator-table-scroll">
          <table className="operator-table alert-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Message</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => {
                const severity = SEVERITY[alert.severity];
                return (
                  <tr
                    key={alert.id}
                    className={alert.status === 'Active' ? 'row-highlight' : ''}
                    onClick={() => alert.workerId && onWorkerClick(alert.workerId)}
                  >
                    <td className="text-muted">{alert.time}</td>
                    <td>
                      <span className={`status-badge ${severity.cls}`}>
                        {alert.severity === 'critical' && <AlertTriangle size={12} />}
                        {severity.label}
                      </span>
                    </td>
                    <td className="cell-primary">{alert.source}</td>
                    <td>{alert.message}</td>
                    <td>
                      <span className={alert.status === 'Active' ? 'text-red' : 'text-green'} style={{ fontWeight: 600 }}>
                        {alert.status}
                      </span>
                    </td>
                    <td>
                      {alert.workerId && (
                        <button
                          className="icon-button"
                          onClick={e => { e.stopPropagation(); onWorkerClick(alert.workerId); }}
                          aria-label={`View ${alert.source}`}
                          title="View operator details"
                        >
                          <ChevronRight size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filteredAlerts.length && (
          <div className="operator-empty">
            <CheckCircle2 size={22} />
            <span>No alerts recorded in this category. All operations nominal.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
