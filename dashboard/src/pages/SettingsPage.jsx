import React, { useState } from 'react';

const SettingsPage = () => {
  const [idleThreshold, setIdleThreshold] = useState(3);
  const [alertSound, setAlertSound] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Settings</h2>
        <p className="page-subtitle">System configuration and alert thresholds</p>
      </div>

      <div className="settings-grid">
        {/* Alert Configuration */}
        <div className="card">
          <div className="card-title">Alert Configuration</div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Idle Alert Threshold</div>
              <div className="setting-desc">Trigger alert when a worker is stationary beyond this duration</div>
            </div>
            <div className="setting-control">
              <select value={idleThreshold} onChange={e => setIdleThreshold(Number(e.target.value))} className="setting-select">
                <option value={1}>1 minute</option>
                <option value={2}>2 minutes</option>
                <option value={3}>3 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
              </select>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Alert Sound</div>
              <div className="setting-desc">Play an audible alert when critical incidents are detected</div>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input type="checkbox" checked={alertSound} onChange={e => setAlertSound(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Low Battery Threshold</div>
              <div className="setting-desc">Warn when wristband battery drops below this level</div>
            </div>
            <div className="setting-control">
              <select defaultValue={20} className="setting-select">
                <option value={10}>10%</option>
                <option value={15}>15%</option>
                <option value={20}>20%</option>
                <option value={25}>25%</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Configuration */}
        <div className="card">
          <div className="card-title">System Configuration</div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Auto Refresh</div>
              <div className="setting-desc">Automatically update dashboard data from the simulator or Firebase</div>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Refresh Interval</div>
              <div className="setting-desc">How often to update simulated data (in seconds)</div>
            </div>
            <div className="setting-control">
              <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))} className="setting-select">
                <option value={1}>1 second</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Dark Mode</div>
              <div className="setting-desc">Switch between light and dark interface themes</div>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input type="checkbox" checked={darkMode} onChange={e => setDarkMode(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Beacon Configuration */}
        <div className="card">
          <div className="card-title">Beacon Configuration</div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Beacons per Machine</div>
              <div className="setting-desc">Number of BLE checkpoints installed on each machine</div>
            </div>
            <div className="setting-control"><span className="setting-static">8</span></div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Beacon Layout</div>
              <div className="setting-desc">A1\u2013A4 (Side A) + B1\u2013B4 (Side B) per machine</div>
            </div>
            <div className="setting-control"><span className="setting-static">A+B Dual Row</span></div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Total Beacons</div>
              <div className="setting-desc">Across all 3 active machines</div>
            </div>
            <div className="setting-control"><span className="setting-static">24</span></div>
          </div>
        </div>

        {/* Firebase Connection */}
        <div className="card">
          <div className="card-title">Firebase Connection</div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Connection Status</div>
              <div className="setting-desc">Current connection to Firebase Realtime Database</div>
            </div>
            <div className="setting-control">
              <span className="status-badge status-idle">Simulator Mode</span>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Database URL</div>
              <div className="setting-desc">Set via VITE_FIREBASE_DATABASE_URL environment variable</div>
            </div>
            <div className="setting-control"><span className="text-muted">Not configured</span></div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Project ID</div>
              <div className="setting-desc">Set via VITE_FIREBASE_PROJECT_ID environment variable</div>
            </div>
            <div className="setting-control"><span className="text-muted">Not configured</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
