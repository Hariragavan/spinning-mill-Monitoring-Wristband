import React from 'react';

const DEVICE_WORKER_MAP = {
  'ESP32C3-WRIST-01': 'Worker 1',
};

const BEACON_LABELS = {
  1: 'Station 1 (Start)',
  2: 'Station 2 (Midpoint)',
  3: 'Station 3',
  4: 'Station 4 (End)',
};

// Returns true if the timestamp is within the last 6 seconds (1-second heartbeat engine)
function isRecent(timestamp) {
  if (!timestamp) return false;
  return (Date.now() - timestamp) < 6000;
}

function isBeaconOnline(b) {
  if (b.status !== 'online') return false;
  const timeUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  const timeSeen = b.last_seen ? new Date(b.last_seen).getTime() : 0;
  const time = Math.max(timeUpdated, timeSeen);
  if (!time) return false;
  return (Date.now() - time) < 10000;
}

const LiveStatusPanel = ({ workers, beacons = [] }) => {
  const workerList = Object.values(workers).filter(w => w?.live);
  const onlineDevices = workerList.filter(w => isRecent(w.live.timestamp));
  const offlineDevices = workerList.filter(w => !isRecent(w.live.timestamp));

  // Collect unique active beacons from all online devices
  const activeBeacons = new Set(
    onlineDevices.map(w => w.live.last_beacon_id).filter(Boolean)
  );

  const patrollingCount = onlineDevices.filter(w =>
    w.live.motion_state === 'walking'
  ).length;

  const stationaryCount = onlineDevices.filter(w =>
    w.live.motion_state === 'stationary'
  ).length;

  return (
    <div className="live-status-panel">
      <div className="live-status-header">
        <span className="live-pulse-dot" />
        <strong>Live Device Status (1-Second Engine)</strong>
        <span className="live-status-subtitle">Real-time presence, heartbeat & 10cm touch checkpoints</span>
      </div>

      <div className="live-status-grid">
        {/* Online Devices */}
        <div className="live-status-block">
          <div className="live-status-block-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            Wristband Tracking
          </div>
          <div className="live-device-list">
            {onlineDevices.length === 0 && offlineDevices.length === 0 && (
              <div className="live-device-row offline">
                <span className="live-device-dot offline" />
                <span>No devices registered</span>
              </div>
            )}
            {onlineDevices.map((w, i) => (
              <div key={i} className="live-device-row online">
                <span className="live-device-dot online" />
                <span className="live-device-label">{w.live.device_id} ({w.live.current_machine || 'M1'} - {w.live.last_beacon_id})</span>
                <span className="live-device-tag online">ONLINE</span>
              </div>
            ))}
            {offlineDevices.map((w, i) => (
              <div key={i} className="live-device-row offline">
                <span className="live-device-dot offline" />
                <span className="live-device-label">{w.live.device_id}</span>
                <span className="live-device-tag offline">OFFLINE</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Beacons */}
        <div className="live-status-block">
          <div className="live-status-block-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5.5 11a6.5 6.5 0 0 1 13 0"/><path d="M2 11a10 10 0 0 1 20 0"/><circle cx="12" cy="17" r="1"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Beacon Stations (M1)
          </div>
          <div className="live-device-list">
            {beacons && beacons.length > 0 ? (
              // Filter to show active/relevant beacons or all seeded M1 beacons
              beacons.filter(b => b.beacon_id === 'M1-A1' || b.beacon_id === 'M1-B4' || b.beacon_id === 'M1-A2').map((b) => {
                const isOnline = isBeaconOnline(b);
                return (
                  <div key={b.beacon_id} className={`live-device-row ${isOnline ? 'online' : 'offline'}`}>
                    <span className={`live-device-dot ${isOnline ? 'online' : 'offline'}`} />
                    <span className="live-device-label">{b.beacon_id} ({b.beacon_id === 'M1-A1' ? 'Gate / B1' : 'Midpoint / B2'})</span>
                    <span className={`live-device-tag ${isOnline ? 'online' : 'offline'}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                );
              })
            ) : activeBeacons.size === 0 ? (
              <div className="live-device-row offline">
                <span className="live-device-dot offline" />
                <span>No beacons registered</span>
              </div>
            ) : (
              [...activeBeacons].map((bid, i) => (
                <div key={i} className="live-device-row online">
                  <span className="live-device-dot online" />
                  <span className="live-device-label">{bid}</span>
                  <span className="live-device-tag online">ACTIVE</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Motion Status Summary */}
        <div className="live-status-block">
          <div className="live-status-block-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Motion Summary
          </div>
          <div className="live-motion-summary">
            <div className="live-motion-row">
              <span className="motion-badge walking">Walking</span>
              <span className="motion-count">{patrollingCount} operator{patrollingCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="live-motion-row">
              <span className="motion-badge stationary">Stationary</span>
              <span className="motion-count">{stationaryCount} operator{stationaryCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="live-motion-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last update: {onlineDevices.length > 0
                  ? new Date(Math.max(...onlineDevices.map(w => w.live.timestamp))).toLocaleTimeString()
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStatusPanel;
