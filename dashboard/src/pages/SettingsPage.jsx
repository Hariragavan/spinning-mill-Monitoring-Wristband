import React, { useState } from 'react';
import { Check, RotateCcw, Save, Radio, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import SummaryCard from '../components/SummaryCard';

const DEFAULTS = { idleThreshold: 3, alertSound: true, autoRefresh: true, refreshInterval: 3, darkMode: false, batteryThreshold: 20 };

const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const update = (key, value) => { setSettings(current => ({ ...current, [key]: value })); setSaved(false); };
  const reset = () => { setSettings(DEFAULTS); setSaved(false); };
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const isFirebaseConfigured = import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'YOUR_API_KEY';

  return <div className="page-content">
    <div className="page-header"><h2>Settings</h2><p className="page-subtitle">Configure monitoring behavior, alert thresholds, and system connections</p></div>
    <div className="summary-row">
      <SummaryCard label="Auto Refresh" value={settings.autoRefresh ? 'ON' : 'OFF'} status="Session setting" icon="activity" tone="green" />
      <SummaryCard label="Refresh Interval" value={`${settings.refreshInterval}s`} status="Update frequency" icon="clock" tone="blue" />
      <SummaryCard label="Idle Threshold" value={`${settings.idleThreshold}m`} status="Alert threshold" icon="alerts" tone="amber" />
      <SummaryCard label="Data Connection" value={isFirebaseConfigured ? 'LIVE' : 'MOCK'} status={isFirebaseConfigured ? 'Firebase connected' : 'Simulator mode'} icon="radio" tone={isFirebaseConfigured ? 'green' : 'amber'} />
    </div>
    <div className="settings-actions"><span className={saved ? 'settings-saved' : 'text-muted'}>{saved && <Check size={15} />} {saved ? 'Settings saved for this session' : 'Changes apply to this dashboard session'}</span><div><button className="settings-button secondary" onClick={reset}><RotateCcw size={15} /> Reset</button><button className="settings-button" onClick={save}><Save size={15} /> Save Changes</button></div></div>
    <div className="settings-grid">
      <div className="card"><div className="card-title"><ShieldAlert size={17} /> Alert Configuration</div>
        <div className="setting-row"><div><div className="setting-label">Idle Alert Threshold</div><div className="setting-desc">Alert when an operator is stationary beyond this duration</div></div><div className="setting-control"><select value={settings.idleThreshold} onChange={event => update('idleThreshold', Number(event.target.value))} className="setting-select"><option value={1}>1 minute</option><option value={2}>2 minutes</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Low Battery Threshold</div><div className="setting-desc">Warn when a wristband battery drops below this level</div></div><div className="setting-control"><select value={settings.batteryThreshold} onChange={event => update('batteryThreshold', Number(event.target.value))} className="setting-select"><option value={10}>10%</option><option value={15}>15%</option><option value={20}>20%</option><option value={25}>25%</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Alert Sound</div><div className="setting-desc">Play an audible alert for critical incidents</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.alertSound} onChange={event => update('alertSound', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
      </div>
      <div className="card"><div className="card-title"><SlidersHorizontal size={17} /> System Configuration</div>
        <div className="setting-row"><div><div className="setting-label">Auto Refresh</div><div className="setting-desc">Update dashboard data automatically</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.autoRefresh} onChange={event => update('autoRefresh', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
        <div className="setting-row"><div><div className="setting-label">Refresh Interval</div><div className="setting-desc">How frequently simulated or Firebase data is refreshed</div></div><div className="setting-control"><select value={settings.refreshInterval} onChange={event => update('refreshInterval', Number(event.target.value))} className="setting-select"><option value={1}>1 second</option><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></div></div>
        <div className="setting-row"><div><div className="setting-label">Dark Mode</div><div className="setting-desc">Reserved for the next visual theme update</div></div><div className="setting-control"><label className="toggle"><input type="checkbox" checked={settings.darkMode} onChange={event => update('darkMode', event.target.checked)} /><span className="toggle-slider" /></label></div></div>
      </div>
      <div className="card"><div className="card-title"><Radio size={17} /> Beacon Configuration</div><div className="setting-row"><div><div className="setting-label">Active Layout</div><div className="setting-desc">A1-A4 on Side A and B1-B4 on Side B</div></div><div className="setting-control"><span className="setting-static">8 / machine</span></div></div><div className="setting-row"><div><div className="setting-label">Monitored Machines</div><div className="setting-desc">Currently configured production machines</div></div><div className="setting-control"><span className="setting-static">3 active</span></div></div><div className="setting-row"><div><div className="setting-label">Total Beacons</div><div className="setting-desc">Across active machines</div></div><div className="setting-control"><span className="setting-static">24</span></div></div></div>
      <div className="card"><div className="card-title"><Radio size={17} /> Firebase Connection</div><div className="setting-row"><div><div className="setting-label">Connection Status</div><div className="setting-desc">Realtime Database data source</div></div><div className="setting-control"><span className={`status-badge ${isFirebaseConfigured ? 'status-good' : 'status-idle'}`}>{isFirebaseConfigured ? 'Connected' : 'Simulator Mode'}</span></div></div><div className="setting-row"><div><div className="setting-label">Database URL</div><div className="setting-desc">VITE_FIREBASE_DATABASE_URL environment variable</div></div><div className="setting-control"><span className="text-muted">{isFirebaseConfigured ? 'Configured' : 'Not configured'}</span></div></div><div className="setting-row"><div><div className="setting-label">Project ID</div><div className="setting-desc">VITE_FIREBASE_PROJECT_ID environment variable</div></div><div className="setting-control"><span className="text-muted">{isFirebaseConfigured ? 'Configured' : 'Not configured'}</span></div></div></div>
    </div>
  </div>;
};

export default SettingsPage;
