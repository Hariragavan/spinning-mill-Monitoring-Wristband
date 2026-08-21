// Store worker states in memory (in production, use a database)
const workerStates = {};
const WORKERS = ['worker_1', 'worker_2', 'worker_3'];
const MACHINES = ['M1', 'M2', 'M3'];
const BEACONS_PER_MACHINE = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1'];

// Initialize worker states
if (Object.keys(workerStates).length === 0) {
  WORKERS.forEach((worker, index) => {
    workerStates[worker] = {
      current_machine: MACHINES[index],
      beacon_index: 0,
      lap_count: 0,
      lap_start_time: Date.now(),
      total_steps: 0,
      login_timestamp: Date.now() - Math.floor(Math.random() * (7200000 - 3600000) + 3600000),
      motion_state: 'walking',
      idle_duration_sec: 0,
      incident_type: 'none',
      wristband_battery_pct: 100,
      doffing_cycle_active: false
    };
  });
}

const randomInRange = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(randomInRange(min, max));

function generateWorkerData(workerId) {
  const state = workerStates[workerId];
  if (!state) return null;

  const timestamp = Date.now();

  // Simulate battery drain
  if (Math.random() < 0.1) {
    state.wristband_battery_pct = Math.max(0, state.wristband_battery_pct - 1);
  }

  // Simulate motion state
  if (Math.random() < 0.1) {
    state.motion_state = 'stationary';
    state.idle_duration_sec += 5;
  } else {
    state.motion_state = 'walking';
    state.idle_duration_sec = 0;
  }

  // Simulate incidents
  if (Math.random() < 0.02 && state.incident_type === 'none') {
    const incidents = ['yarn_break', 'spindle_jam', 'elec_break', 'machine_break'];
    state.incident_type = incidents[randomInt(0, incidents.length)];
  } else if (Math.random() < 0.15) {
    state.incident_type = 'none';
  }

  // Move along beacons
  if (state.motion_state === 'walking' && state.incident_type === 'none') {
    state.beacon_index++;
    state.total_steps += randomInt(5, 12);

    if (state.beacon_index >= BEACONS_PER_MACHINE.length) {
      state.beacon_index = 0;
      state.lap_count++;

      if (Math.random() < 0.1) {
        state.current_machine = MACHINES[randomInt(0, MACHINES.length)];
      }
    }
  }

  const current_beacon = `${state.current_machine}-${BEACONS_PER_MACHINE[state.beacon_index]}`;
  const lap_duration_sec = Math.floor((timestamp - state.lap_start_time) / 1000);

  return {
    worker_id: workerId,
    current_zone: BEACONS_PER_MACHINE[state.beacon_index].startsWith('A') ? 'Side A' : 'Side B',
    last_beacon_id: current_beacon,
    beacon_rssi: Math.floor(randomInRange(-80, -40)),
    current_machine: state.current_machine,
    lap_count: state.lap_count,
    lap_duration_sec: lap_duration_sec,
    transit_time_sec: 5,
    directional_heading: state.beacon_index < 4 ? 'Forward' : 'Backward',
    total_steps: state.total_steps,
    steps_per_min_cadence: state.motion_state === 'walking' ? randomInt(90, 120) : 0,
    walking_speed_ms: state.motion_state === 'walking' ? randomInRange(1.0, 1.5).toFixed(2) : 0,
    motion_state: state.motion_state,
    idle_duration_sec: state.idle_duration_sec,
    arm_motion_intensity: state.motion_state === 'walking' ? randomInt(40, 80) : randomInt(0, 10),
    shift_status: 'login',
    login_timestamp: state.login_timestamp,
    logout_timestamp: null,
    break_mode: state.idle_duration_sec > 180 ? 'restroom' : 'none',
    break_duration_sec: state.idle_duration_sec > 180 ? state.idle_duration_sec : 0,
    incident_type: state.incident_type,
    incident_zone: state.incident_type !== 'none' ? current_beacon : null,
    assistance_request_flag: state.incident_type !== 'none' && Math.random() < 0.3,
    doffing_cycle_active: state.doffing_cycle_active,
    timestamp: timestamp,
    device_id: `ESP32-C3-${workerId.split('_')[1]}`,
    wristband_battery_pct: state.wristband_battery_pct,
    beacon_battery_pct: randomInt(80, 100),
    packet_latency_ms: randomInt(20, 150)
  };
}

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const workers = WORKERS.map(id => generateWorkerData(id));
    res.status(200).json({ workers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
