import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import Sidebar from './components/Sidebar/Sidebar';
import DashboardPage from './pages/DashboardPage';
import MachinesPage from './pages/MachinesPage';
import OperatorsPage from './pages/OperatorsPage';
import PerformancePage from './pages/PerformancePage';
import RoundsPage from './pages/RoundsPage';
import BreaksPage from './pages/BreaksPage';
import ReportsPage from './pages/ReportsPage';
import CorrelationDetailPage from './pages/CorrelationDetailPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import WorkerDetail from './components/WorkerDetail';

// ── Built-in live simulator ──────────────────────────────
const BEACONS = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1'];
const MACHINES = ['M1', 'M2', 'M3'];
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b));

function createWorkerState(machine) {
  return {
    current_machine: machine, beacon_index: 0, lap_count: 0,
    lap_start_time: Date.now(), total_steps: 0,
    login_timestamp: Date.now() - randInt(3600000, 7200000),
    motion_state: 'walking', idle_duration_sec: 0, idle_ticks_remaining: 0,
    incident_type: 'none', incident_ticks_remaining: 0,
    wristband_battery_pct: 100, doffing_cycle_active: false,
  };
}

function tickWorker(s) {
  s = { ...s };
  if (Math.random() < 0.08) s.wristband_battery_pct = Math.max(5, s.wristband_battery_pct - 1);
  if (s.idle_ticks_remaining > 0) {
    s.idle_ticks_remaining--; s.idle_duration_sec += 3; s.motion_state = 'stationary';
    if (!s.idle_ticks_remaining) { s.motion_state = 'walking'; s.idle_duration_sec = 0; }
    return s;
  }
  if (s.incident_ticks_remaining > 0) {
    s.incident_ticks_remaining--; s.motion_state = 'stationary';
    if (!s.incident_ticks_remaining) { s.incident_type = 'none'; s.motion_state = 'walking'; }
    return s;
  }
  if (Math.random() < 0.05) { s.idle_ticks_remaining = randInt(2, 6); s.motion_state = 'stationary'; s.idle_duration_sec = 3; return s; }
  if (Math.random() < 0.02) { s.incident_type = Math.random() < 0.5 ? 'yarn_break' : 'spindle_jam'; s.incident_ticks_remaining = randInt(3, 8); s.motion_state = 'stationary'; return s; }
  s.motion_state = 'walking'; s.idle_duration_sec = 0; s.beacon_index++; s.total_steps += randInt(8, 18);
  if (s.beacon_index >= BEACONS.length) {
    s.beacon_index = 0; s.lap_count++; s.lap_start_time = Date.now();
    if (Math.random() < 0.1) s.current_machine = MACHINES[randInt(0, MACHINES.length)];
  }
  return s;
}

function toLive(id, s) {
  const b = BEACONS[s.beacon_index]; const cb = `${s.current_machine}-${b}`; const now = Date.now();
  return {
    current_zone: b.startsWith('A') ? 'Side A' : 'Side B', last_beacon_id: cb,
    beacon_rssi: randInt(-75, -40), current_machine: s.current_machine, lap_count: s.lap_count,
    lap_duration_sec: Math.floor((now - s.lap_start_time) / 1000), transit_time_sec: randInt(3, 8),
    directional_heading: s.beacon_index < 4 ? 'Forward' : 'Return',
    total_steps: s.total_steps, steps_per_min_cadence: s.motion_state === 'walking' ? randInt(90, 120) : 0,
    walking_speed_ms: s.motion_state === 'walking' ? rand(1.0, 1.5).toFixed(2) : '0.00',
    motion_state: s.motion_state, idle_duration_sec: s.idle_duration_sec,
    arm_motion_intensity: s.motion_state === 'walking' ? randInt(40, 80) : randInt(0, 10),
    shift_status: 'login', login_timestamp: s.login_timestamp, logout_timestamp: null,
    break_mode: s.idle_duration_sec > 30 ? 'restroom' : 'none',
    break_duration_sec: s.idle_duration_sec > 30 ? s.idle_duration_sec : 0,
    incident_type: s.incident_type, incident_zone: s.incident_type !== 'none' ? cb : null,
    assistance_request_flag: s.incident_type !== 'none' && Math.random() < 0.3,
    doffing_cycle_active: s.doffing_cycle_active, timestamp: now,
    device_id: `ESP32-C3-${id.split('_')[1]}`, wristband_battery_pct: s.wristband_battery_pct,
    beacon_battery_pct: randInt(80, 100), packet_latency_ms: randInt(20, 150),
  };
}
// ── End simulator ────────────────────────────────────────

const PAGE_TITLES = {
  dashboard: 'Dashboard', machines: 'Machines', operators: 'Operators',
  performance: 'Performance', rounds: 'Rounds', breaks: 'Breaks & Downtime',
  reports: 'Reports', alerts: 'Alerts', settings: 'Settings',
  correlation: 'Correlation Investigation',
};
const PAGE_IDS = new Set(Object.keys(PAGE_TITLES));

function getPageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, '');
  return PAGE_IDS.has(page) ? page : 'dashboard';
}

function App() {
  const [workers, setWorkers] = useState({});
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const simStates = useRef(null);

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const isMock = import.meta.env.VITE_FIREBASE_API_KEY === 'YOUR_API_KEY' || !import.meta.env.VITE_FIREBASE_API_KEY;
    if (!isMock) {
      const unsubscribe = onValue(ref(db, 'workers'), (snap) => { if (snap.exists()) setWorkers(snap.val()); setLoading(false); });
      return () => unsubscribe();
    }
    if (!simStates.current) {
      simStates.current = { worker_1: createWorkerState('M1'), worker_2: createWorkerState('M2'), worker_3: createWorkerState('M3') };
    }
    const build = () => { const o = {}; for (const [id, st] of Object.entries(simStates.current)) o[id] = { live: toLive(id, st) }; return o; };
    setWorkers(build()); setLoading(false);
    const iv = setInterval(() => { for (const id of Object.keys(simStates.current)) simStates.current[id] = tickWorker(simStates.current[id]); setWorkers(build()); }, 3000);
    return () => clearInterval(iv);
  }, []);

  // Alert count for sidebar badge
  const alertCount = Object.values(workers).reduce((c, d) => {
    if (!d?.live) return c;
    if (d.live.incident_type !== 'none') c++;
    if (d.live.motion_state === 'stationary' && d.live.idle_duration_sec > 120) c++;
    if (d.live.wristband_battery_pct < 25) c++;
    return c;
  }, 0) + 8; // +8 historical

  const alerts = Object.entries(workers).reduce((acc, [id, data]) => {
    if (!data.live) return acc;
    if (data.live.incident_type !== 'none')
      acc.push(`W${id.split('_')[1]}: ${data.live.incident_type.replace('_', ' ')} at ${data.live.current_machine}`);
    else if (data.live.motion_state === 'stationary' && data.live.idle_duration_sec > 180)
      acc.push(`W${id.split('_')[1]} idle for ${Math.floor(data.live.idle_duration_sec / 60)}m`);
    return acc;
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash());
      setSelectedWorker(null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page) => {
    if (!PAGE_IDS.has(page)) return;
    setSelectedWorker(null);
    window.location.hash = page;
  };

  if (loading) return <div className="app-layout"><div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading\u2026</div></div>;

  const renderPage = () => {
    if (selectedWorker) return <WorkerDetail workerId={selectedWorker} workerData={workers[selectedWorker]} onBack={() => setSelectedWorker(null)} />;
    switch (activePage) {
      case 'machines':    return <MachinesPage workers={workers} />;
      case 'operators':   return <OperatorsPage workers={workers} onWorkerClick={(id) => setSelectedWorker(id)} />;
      case 'performance': return <PerformancePage workers={workers} />;
      case 'rounds':      return <RoundsPage workers={workers} />;
      case 'breaks':      return <BreaksPage workers={workers} />;
      case 'reports':     return <ReportsPage workers={workers} onOpenCorrelation={() => handleNavigate('correlation')} />;
      case 'correlation': return <CorrelationDetailPage workers={workers} onBack={() => handleNavigate('reports')} />;
      case 'alerts':      return <AlertsPage workers={workers} onWorkerClick={(id) => setSelectedWorker(id)} />;
      case 'settings':    return <SettingsPage />;
      default:            return <DashboardPage workers={workers} onWorkerClick={(id) => setSelectedWorker(id)} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} alertCount={alertCount} />
      <main className="main-content">
        {/* Header */}
        <div className="app-header">
          <div>
            <h1>{selectedWorker ? 'Worker Detail' : (activePage === 'dashboard' ? 'Welcome, Supervisor' : PAGE_TITLES[activePage])}</h1>
            <div className="header-subtitle">
              {activePage === 'dashboard' && !selectedWorker ? 'Spinning Mill \u2014 Patrol Monitoring Command Center' : ''}
            </div>
          </div>
          <div className="header-right">
            {alerts.length > 0 && (
              <div className="header-alert-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {alerts.length} active
              </div>
            )}
            <div className="live-indicator"><span className="live-dot" />LIVE</div>
            <div className="timestamp-badge">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Page content */}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
