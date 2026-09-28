/**
 * dataMapper.js
 * 
 * Converts raw device payload from ESP32 into the dashboard's
 * internal `live` data format. This keeps all existing dashboard
 * components working without modification.
 */

// Device-to-worker mapping (mirrors server/routes/deviceRoutes.js)
const DEVICE_WORKER_MAP = {
  'ESP32C3-WRIST-01': { worker_id: 'worker_1', name: 'Worker 1' },
  'WRISTBAND_01': { worker_id: 'worker_1', name: 'Worker 1' },
  'WRISTBAND_02': { worker_id: 'worker_2', name: 'Worker 2' },
  'WRISTBAND_03': { worker_id: 'worker_3', name: 'Worker 3' },
};

export function resolveWorker(deviceId) {
  if (DEVICE_WORKER_MAP[deviceId]) return DEVICE_WORKER_MAP[deviceId];
  const match = deviceId?.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return { worker_id: `worker_${num}`, name: `Worker ${num}` };
  }
  return { worker_id: deviceId || 'worker_1', name: deviceId || 'Worker 1' };
}

// Beacon ID to zone mapping
const BEACON_ZONE_MAP = {
  1: { machine: 'M1', beacon_code: 'A1', zone: 'Side A' },
  2: { machine: 'M1', beacon_code: 'A2', zone: 'Side A' },
};

/**
 * Maps a single raw device record to the dashboard's `live` format.
 */
export function mapDeviceToLive(raw) {
  const beaconInfo = BEACON_ZONE_MAP[raw.location?.beacon_id] || {
    machine: raw.machine || 'M1',
    beacon_code: raw.beacon_code || 'A1',
    zone: raw.zone || 'Side A'
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

export { DEVICE_WORKER_MAP };
