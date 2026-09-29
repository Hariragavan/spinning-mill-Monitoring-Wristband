import express from 'express';
import { isLocalFileDbEnabled, saveLocalRecord, getLatestLocalRecords } from '../dbLocal.js';

const router = express.Router();

const getSupabaseConfig = () => ({
  url: process.env.SUPABASE_URL || 'https://vldhjpvyphzxofmwqmys.supabase.co',
  key: process.env.SUPABASE_KEY || 'sb_publishable_UxA-HekCjNWcPPBTmlbyJg_RVErZCmK'
});

const DEVICE_WORKER_MAP = {
  'ESP32C3-WRIST-01': { worker_id: 'worker_1', name: 'Worker 1' },
  'WRISTBAND_01': { worker_id: 'worker_1', name: 'Worker 1' },
  'WRISTBAND_02': { worker_id: 'worker_2', name: 'Worker 2' },
  'WRISTBAND_03': { worker_id: 'worker_3', name: 'Worker 3' },
};

function resolveWorker(deviceId) {
  if (DEVICE_WORKER_MAP[deviceId]) return DEVICE_WORKER_MAP[deviceId];
  const match = deviceId?.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return { worker_id: `worker_${num}`, name: `Worker ${num}` };
  }
  return { worker_id: deviceId || 'worker_1', name: deviceId || 'Worker 1' };
}

const BEACON_ZONE_MAP = {
  1: { machine: 'M1', beacon_code: 'A1', zone: 'Side A', zone_name: 'Station 1 (Start)' },
  2: { machine: 'M1', beacon_code: 'A2', zone: 'Side A', zone_name: 'Station 2 (Midpoint)' },
};

function mapDeviceToLive(raw) {
  const beaconInfo = BEACON_ZONE_MAP[raw.location?.beacon_id] || {
    machine: raw.machine || 'M1',
    beacon_code: raw.beacon_code || 'A1',
    zone: raw.zone || 'Side A',
    zone_name: 'Checkpoint'
  };

  const patrolState = raw.patrol?.state || 'IDLE';
  let heading = 'Forward';
  if (patrolState === 'RETURNING') heading = 'Return';
  else if (patrolState === 'IDLE') heading = 'Stationary';

  return {
    current_zone: beaconInfo.zone,
    last_beacon_id: `${beaconInfo.machine}-${beaconInfo.beacon_code}`,
    beacon_rssi: raw.location?.rssi_dbm ?? -70,
    current_machine: beaconInfo.machine,
    lap_count: raw.patrol?.lap_count ?? 0,
    lap_duration_sec: Math.round(raw.patrol?.current_lap_sec ?? 0),
    transit_time_sec: 0,
    directional_heading: heading,
    motion_state: raw.motion?.motion_state ?? 'stationary',
    idle_duration_sec: raw.motion?.idle_sec ?? 0,
    walking_speed_ms: raw.motion?.speed_estimate_ms?.toFixed(2) ?? '0.00',
    total_steps: 0,
    steps_per_min_cadence: 0,
    arm_motion_intensity: 0,
    shift_status: 'login',
    login_timestamp: Date.now() - (raw.telemetry?.uptime_ms ?? 0),
    logout_timestamp: null,
    break_mode: 'none',
    break_duration_sec: 0,
    incident_type: 'none',
    incident_zone: null,
    assistance_request_flag: raw.safety?.assistance_requested ?? false,
    doffing_cycle_active: false,
    timestamp: raw.received_at ? new Date(raw.received_at).getTime() : Date.now(),
    device_id: raw.device_id ?? 'unknown',
    wristband_battery_pct: 100,
    beacon_battery_pct: 100,
    packet_latency_ms: 0,
  };
}

// ──────────────────────────────────────────────────────────
// POST /api/device-data
// ──────────────────────────────────────────────────────────
router.post('/device-data', async (req, res) => {
  try {
    const payload = req.body;
    const { url, key } = getSupabaseConfig();

    if (!payload.device_id) {
      return res.status(400).json({ error: 'Missing device_id in payload' });
    }

    let recordId = 'sb_' + Date.now();

    if (isLocalFileDbEnabled()) {
      const record = await saveLocalRecord(payload);
      recordId = record._id;
    } else {
      // 1. Insert into Supabase table public.telemetry_logs
      const logRes = await fetch(`${url}/rest/v1/telemetry_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          station_id: payload.location?.beacon_id ? `M1-A${payload.location.beacon_id}` : 'M1-A1',
          target_device: payload.device_id,
          event: payload.patrol?.state === 'OUTBOUND' ? 'LAP_STARTED' : 'ROUND_COMPLETED',
          lap_duration_sec: payload.patrol?.current_lap_sec || 0,
          signal_rssi: payload.location?.rssi_dbm || -70,
          est_distance_cm: 2.51,
          uptime_ms: payload.telemetry?.uptime_ms || 0
        })
      });

      if (logRes.ok) {
        const logs = await logRes.json();
        if (Array.isArray(logs) && logs.length > 0) recordId = logs[0].id;
      }

      // 2. Upsert into Supabase table public.workers
      const workerInfo = resolveWorker(payload.device_id);
      const liveData = mapDeviceToLive(payload);

      await fetch(`${url}/rest/v1/workers?on_conflict=worker_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          worker_id: workerInfo.worker_id,
          device_id: payload.device_id,
          current_zone: liveData.current_zone,
          last_beacon_id: liveData.last_beacon_id,
          beacon_rssi: liveData.beacon_rssi,
          current_machine: liveData.current_machine,
          lap_count: liveData.lap_count,
          lap_duration_sec: liveData.lap_duration_sec,
          directional_heading: liveData.directional_heading,
          motion_state: liveData.motion_state,
          idle_duration_sec: liveData.idle_duration_sec,
          walking_speed_ms: parseFloat(liveData.walking_speed_ms),
          shift_status: liveData.shift_status,
          incident_type: liveData.incident_type,
          assistance_request_flag: liveData.assistance_request_flag,
          wristband_battery_pct: liveData.wristband_battery_pct,
          beacon_battery_pct: liveData.beacon_battery_pct
        })
      });
    }

    console.log(`[${new Date().toISOString()}] Received data from ${payload.device_id} -> Supabase Updated (${recordId})`);
    res.status(201).json({ status: 'ok', id: recordId });
  } catch (error) {
    console.error('Error saving device data to Supabase:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/workers
// ──────────────────────────────────────────────────────────
router.get('/workers', async (req, res) => {
  try {
    const { url, key } = getSupabaseConfig();
    const deviceIds = Object.keys(DEVICE_WORKER_MAP);

    if (isLocalFileDbEnabled()) {
      const latestLocalMap = await getLatestLocalRecords(deviceIds);
      const workers = {};
      for (const deviceId of deviceIds) {
        const latest = latestLocalMap[deviceId];
        const workerInfo = DEVICE_WORKER_MAP[deviceId];
        if (latest) {
          workers[workerInfo.worker_id] = { live: mapDeviceToLive(latest) };
        }
      }
      return res.json(workers);
    }

    // Fetch directly from Supabase table public.workers
    const sbRes = await fetch(`${url}/rest/v1/workers?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (sbRes.ok) {
      const rows = await sbRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const workers = {};
        for (const r of rows) {
          workers[r.worker_id] = {
            live: {
              current_zone: r.current_zone || 'Side A',
              last_beacon_id: r.last_beacon_id || 'M1-A1',
              beacon_rssi: r.beacon_rssi ?? -70,
              current_machine: r.current_machine || 'M1',
              lap_count: r.lap_count ?? 0,
              lap_duration_sec: r.lap_duration_sec ?? 0,
              transit_time_sec: 0,
              directional_heading: r.directional_heading || 'Stationary',
              motion_state: r.motion_state || 'stationary',
              idle_duration_sec: r.idle_duration_sec ?? 0,
              walking_speed_ms: (r.walking_speed_ms ?? 0).toFixed(2),
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
              device_id: r.device_id || 'unknown',
              wristband_battery_pct: r.wristband_battery_pct ?? 100,
              beacon_battery_pct: r.beacon_battery_pct ?? 100,
              packet_latency_ms: 0
            }
          };
        }
        return res.json(workers);
      }
    }

    // No workers found in Supabase
    res.json({});
  } catch (error) {
    console.error('Error fetching workers from Supabase:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/health
// ──────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'Supabase PostgreSQL', timestamp: new Date().toISOString() });
});

export default router;
