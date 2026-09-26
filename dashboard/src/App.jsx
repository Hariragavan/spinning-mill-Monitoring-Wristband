import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
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

function formatSupabaseWorker(r) {
  return {
    current_zone: r.current_zone || 'Side A',
    last_beacon_id: r.last_beacon_id || 'M1-A1',
    beacon_rssi: r.beacon_rssi ?? -70,
    current_machine: r.current_machine || 'M1',
    lap_count: r.lap_count ?? 0,
    lap_duration_sec: Number(r.lap_duration_sec ?? 0),
    transit_time_sec: 0,
    directional_heading: r.directional_heading || 'Stationary',
    motion_state: r.motion_state || 'stationary',
    idle_duration_sec: r.idle_duration_sec ?? 0,
    walking_speed_ms: (Number(r.walking_speed_ms ?? 0)).toFixed(2),
    total_steps: 0,
    steps_per_min_cadence: 0,
    arm_motion_intensity: 0,
    shift_status: r.shift_status || 'login',
    login_timestamp: Date.now(),
    logout_timestamp: null,
    break_mode: 'none',
    break_duration_sec: 0,
    incident_type: r.incident_type || 'none',
    incident_zone: null,
    assistance_request_flag: r.assistance_request_flag ?? false,
    doffing_cycle_active: false,
    timestamp: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    device_id: r.device_id || 'WRISTBAND_01',
    wristband_battery_pct: r.wristband_battery_pct ?? 100,
    beacon_battery_pct: r.beacon_battery_pct ?? 100,
    packet_latency_ms: 0
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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

  const [dataMode, setDataMode] = useState(() => {
    return localStorage.getItem('spinningmill_data_mode') || 'live';
  });
  const [backendStatus, setBackendStatus] = useState('connected');

  const handleSetDataMode = useCallback((mode) => {
    setDataMode(mode);
    localStorage.setItem('spinningmill_data_mode', mode);
  }, []);

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Fetch live workers directly from Supabase
    const fetchSupabaseWorkers = async () => {
      try {
        const { data, error } = await supabase.from('workers').select('*');
        if (!error && data && data.length > 0 && !cancelled) {
          const formatted = {};
          for (const r of data) {
            formatted[r.worker_id] = { live: formatSupabaseWorker(r) };
          }
          setWorkers(formatted);
          setLoading(false);
          setBackendStatus('connected');
          return true;
        }
      } catch (err) {
        console.error('Supabase fetch error:', err);
      }
      return false;
    };

    // 2. Fallback fetch from Express Backend
    const fetchBackendWorkers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/workers`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data && Object.keys(data).length > 0) {
            setWorkers(data);
            setLoading(false);
            setBackendStatus('connected');
            return true;
          }
        }
      } catch (err) {
        // Backend offline
      }
      return false;
    };

    // Initial Load
    const initData = async () => {
      const fromSupabase = await fetchSupabaseWorkers();
      if (!fromSupabase) {
        await fetchBackendWorkers();
      }
      if (!cancelled) setLoading(false);
    };

    initData();

    // 3. Supabase Realtime Subscription (Instant live push on any ESP32 swipe/checkpoint!)
    const channel = supabase
      .channel('public:workers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, (payload) => {
        console.log('[Supabase Realtime Update]', payload);
        fetchSupabaseWorkers();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Supabase Realtime subscribed');
          setBackendStatus('connected');
        }
      });

    // 4. Polling fallback every 3 seconds
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      await fetchSupabaseWorkers();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [dataMode]);

  // Alert count for sidebar badge
  const alertCount = Object.values(workers).reduce((c, d) => {
    if (!d?.live) return c;
    if (d.live.incident_type !== 'none') c++;
    if (d.live.motion_state === 'stationary' && d.live.idle_duration_sec > 120) c++;
    if (d.live.wristband_battery_pct < 25) c++;
    return c;
  }, 0);

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

  if (loading) return <div className="app-layout"><div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div></div>;

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
      case 'settings':    return <SettingsPage dataMode={dataMode} onSetDataMode={handleSetDataMode} backendStatus={backendStatus} />;
      default:            return <DashboardPage workers={workers} onWorkerClick={(id) => setSelectedWorker(id)} dataMode={dataMode} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} alertCount={alertCount} />
      <main className="main-content">
        <div className="app-header">
          <div>
            <h1>{selectedWorker ? 'Worker Detail' : (activePage === 'dashboard' ? 'Welcome, Supervisor' : PAGE_TITLES[activePage])}</h1>
            <div className="header-subtitle">
              {activePage === 'dashboard' && !selectedWorker ? 'Spinning Mill — Patrol Monitoring Command Center' : ''}
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
            <div className={`live-indicator ${dataMode === 'live' ? 'live-mode-active' : ''}`}>
              <span className={`live-dot ${dataMode === 'live' ? 'live-dot-green' : ''}`} />
              {dataMode === 'live' ? 'LIVE' : 'SIM'}
            </div>
            <div className="timestamp-badge">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;
