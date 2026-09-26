import React, { useState, useEffect } from 'react';
import { Check, RotateCcw, Save, Radio, ShieldAlert, SlidersHorizontal, Database, Wifi, WifiOff } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const DEFAULTS = { idleThreshold: 3, alertSound: true, autoRefresh: true, refreshInterval: 3, darkMode: false, batteryThreshold: 20 };

const SettingsPage = ({ dataMode = 'simulation', onSetDataMode, backendStatus = 'unknown' }) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [healthCheck, setHealthCheck] = useState(null);

  const update = (key, value) => { setSettings(current => ({ ...current, [key]: value })); setSaved(false); };
  const reset = () => { setSettings(DEFAULTS); setSaved(false); };
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // Check backend health when in live mode or when toggling
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) {
          const data = await res.json();
          setHealthCheck({ status: 'ok', timestamp: data.timestamp });
        } else {
          setHealthCheck({ status: 'error', message: `HTTP ${res.status}` });
        }
      } catch (err) {
        setHealthCheck({ status: 'error', message: err.message });
      }
    };
    checkHealth();
    const iv = setInterval(checkHealth, 10000);
    return () => clearInterval(iv);
  }, [dataMode]);

  const isBackendOnline = healthCheck?.status === 'ok';

  return <div className="page-content">
    <div className="page-header"><h2>Settings</h2><p className="page-subtitle">Configure monitoring behavior, alert thresholds, and system connections</p></div>
    <div className="summary-row">
      <SummaryCard label="Data Source" value={dataMode === 'live' ? 'LIVE' : 'SIMULATION'} status={dataMode === 'live' ? 'MongoDB backend' : 'Built-in simulator'} icon="radio" tone={dataMode === 'live' ? 'green' : 'blue'} />
      <SummaryCard label="Backend Status" value={isBackendOnline ? 'ONLINE' : 'OFFLINE'} status={isBackendOnline ? `Last: ${new Date(healthCheck.timestamp).toLocaleTimeString()}` : 'Not reachable'} icon="activity" tone={isBackendOnline ? 'green' : 'red'} />
      <SummaryCard label="Refresh Interval" value={`${settings.refreshInterval}s`} status="Update frequency" icon="clock" tone="blue" />
      <SummaryCard label="Idle Threshold" value={`${settings.idleThreshold}m`} status="Alert threshold" icon="alerts" tone="amber" />
    </div>
    <div className="settings-actions"><span className={saved ? 'settings-saved' : 'text-muted'}>{saved && <Check size={15} />} {saved ? 'Settings saved for this session' : 'Changes apply to this dashboard session'}</span><div><button className="settings-button secondary" onClick={reset}><RotateCcw size={15} /> Reset</button><button className="settings-button" onClick={save}><Save size={15} /> Save Changes</button></div></div>
    <div className="settings-grid">

      {/* ── Data Source Card ── */}
      <div className="card">
        <div className="card-title"><Database size={17} /> Data Source</div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Data Mode</div>
            <div className="setting-desc">Switch between built-in simulator and live device data from MongoDB backend</div>
          </div>
          <div className="setting-control">
            <div className="data-mode-toggle">
              <button
                className={`mode-btn ${dataMode === 'simulation' ? 'mode-btn-active' : ''}`}
                onClick={() => onSetDataMode && onSetDataMode('simulation')}
              >
                Simulation
              </button>
              <button
                className={`mode-btn ${dataMode === 'live' ? 'mode-btn-active mode-btn-live' : ''}`}
                onClick={() => onSetDataMode && onSetDataMode('live')}
              >
                Live
              </button>
            </div>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Backend API URL</div>
            <div className="setting-desc">Express + MongoDB server endpoint</div>
          </div>
          <div className="setting-control">
            <span className="text-muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{API_BASE_URL}</span>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Connection Status</div>
            <div className="setting-desc">Backend health check (polls every 10s)</div>
          </div>
          <div className="setting-control">
            <span className={`status-badge ${isBackendOnline ? 'status-good' : 'status-alert'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {isBackendOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isBackendOnline ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Alert Configuration Card ── */}
      <div className="card"><div className="card-title"><ShieldAlert size={17} /> Alert Configuration</div>
        <div className="setting-row"><div><div className="setting-label">Idle Alert Threshold</div><div className="setting-desc">Alert when an operator is stationary beyond this duration</div></div><div className="setting-control"><select value={settings.idleThreshold} onChange={event => update('idleThreshold', Number(event.target.value))} className="setting-select"><option value={1}>1 minute</option><option value={2}>2 minutes</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Low Battery Threshold</div><div className="setting-desc">Warn when a wristband battery drops below this level</div></div><div className="setting-control"><select value={settings.batteryThreshold} onChange={event => update('batteryThreshold', Number(event.target.value))} className="setting-select"><option value={10}>10%</option><option value={15}>15%</option><option value={20}>20%</option><option value={25}>25%</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Alert Sound</div><div className="setting-desc">Play an audible alert for critical incidents</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.alertSound} onChange={event => update('alertSound', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
      </div>

      {/* ── System Configuration Card ── */}
      <div className="card"><div className="card-title"><SlidersHorizontal size={17} /> System Configuration</div>
        <div className="setting-row"><div><div className="setting-label">Auto Refresh</div><div className="setting-desc">Update dashboard data automatically</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.autoRefresh} onChange={event => update('autoRefresh', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
        <div className="setting-row"><div><div className="setting-label">Refresh Interval</div><div className="setting-desc">How frequently data is refreshed from the backend</div></div><div className="setting-control"><select value={settings.refreshInterval} onChange={event => update('refreshInterval', Number(event.target.value))} className="setting-select"><option value={1}>1 second</option><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Dark Mode</div><div className="setting-desc">Reserved for the next visual theme update</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.darkMode} onChange={event => update('darkMode', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
      </div>

      {/* ── Beacon / Device Configuration Card ── */}
      <div className="card"><div className="card-title"><Radio size={17} /> Device Configuration</div>
        <div className="setting-row"><div><div className="setting-label">Active Beacons</div><div className="setting-desc">{dataMode === 'live' ? 'Station 1 (Start) and Station 2 (Midpoint)' : 'A1-A4 on Side A and B1-B4 on Side B'}</div></div><div className="setting-control"><span className="setting-static">{dataMode === 'live' ? '2 beacons' : '8 / machine'}</span></div></div>
        <div className="setting-row"><div><div className="setting-label">Wristbands</div><div className="setting-desc">{dataMode === 'live' ? 'ESP32C3-WRIST-01' : '3 simulated workers'}</div></div><div className="setting-control"><span className="setting-static">{dataMode === 'live' ? '1 active' : '3 active'}</span></div></div>
        <div className="setting-row"><div><div className="setting-label">Monitored Machines</div><div className="setting-desc">Currently configured production machines</div></div><div className="setting-control"><span className="setting-static">{dataMode === 'live' ? '1 active' : '3 active'}</span></div></div>
      </div>

    </div>
  </div>;
};

export default SettingsPage;
