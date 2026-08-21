import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import dotenv from 'dotenv';

dotenv.config();

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://YOUR_PROJECT_ID.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const WORKERS = ['worker_1', 'worker_2', 'worker_3'];
const MACHINES = ['M1', 'M2', 'M3'];
const BEACONS_PER_MACHINE = ['A1', 'A2', 'A3', 'A4', 'B4', 'B3', 'B2', 'B1'];

// Helper to generate random number in range
const randomInRange = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(randomInRange(min, max));

// Keep track of state for each worker
const workerStates = {};

WORKERS.forEach((worker, index) => {
  workerStates[worker] = {
    current_machine: MACHINES[index],
    beacon_index: 0, // Starts at A1
    lap_count: 0,
    lap_start_time: Date.now(),
    total_steps: 0,
    login_timestamp: Date.now() - randomInt(3600000, 7200000), // logged in 1-2 hours ago
    motion_state: 'walking',
    idle_duration_sec: 0,
    incident_type: 'none',
    wristband_battery_pct: 100,
    doffing_cycle_active: false
  };
});

function simulateTick() {
  const timestamp = Date.now();

  WORKERS.forEach(workerId => {
    let state = workerStates[workerId];
    
    // Simulate battery drain
    if (Math.random() < 0.1) {
      state.wristband_battery_pct = Math.max(0, state.wristband_battery_pct - 1);
    }

    // Simulate motion state (90% chance walking, 10% stationary)
    if (Math.random() < 0.1) {
      state.motion_state = 'stationary';
      state.idle_duration_sec += 5; // Assuming 5 sec tick
    } else {
      state.motion_state = 'walking';
      state.idle_duration_sec = 0;
    }

    // Simulate incidents (2% chance)
    if (Math.random() < 0.02 && state.incident_type === 'none') {
      const incidents = ['yarn_break', 'spindle_jam', 'elec_break', 'machine_break'];
      state.incident_type = incidents[randomInt(0, incidents.length)];
    } else if (Math.random() < 0.15) { // chance to clear incident
      state.incident_type = 'none';
    }

    // If walking, move along the beacons
    if (state.motion_state === 'walking' && state.incident_type === 'none') {
      state.beacon_index++;
      state.total_steps += randomInt(5, 12);
      
      // Completed a round on the machine
      if (state.beacon_index >= BEACONS_PER_MACHINE.length) {
        state.beacon_index = 0;
        state.lap_count++;
        
        // 10% chance to switch machine after a lap
        if (Math.random() < 0.1) {
          state.current_machine = MACHINES[randomInt(0, MACHINES.length)];
        }
      }
    }

    const current_beacon = `${state.current_machine}-${BEACONS_PER_MACHINE[state.beacon_index]}`;
    const lap_duration_sec = Math.floor((timestamp - state.lap_start_time) / 1000);

    const liveData = {
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

    // Update Firebase Realtime Database
    // Only attempt if database URL is valid (not the placeholder)
    if (firebaseConfig.databaseURL && firebaseConfig.databaseURL.includes('firebaseio.com') && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
       set(ref(db, `workers/${workerId}/live`), liveData)
        .then(() => console.log(`[${new Date().toISOString()}] Updated ${workerId}`))
        .catch((error) => console.error(`Error updating ${workerId}:`, error));
    } else {
        console.log(`[${new Date().toISOString()}] DRY RUN (No Firebase config) Updated ${workerId}:`, liveData.last_beacon_id, liveData.motion_state);
    }
    
    // Periodically update history (e.g. daily summaries) - simulated here just once for demonstration
    if (Math.random() < 0.05) {
       const today = new Date().toISOString().split('T')[0];
       const historyData = {
           total_hours_worked: ((timestamp - state.login_timestamp) / 3600000).toFixed(2),
           rounds_completed: state.lap_count,
           on_time: true,
           idle_minutes_total: Math.floor(state.idle_duration_sec / 60) + randomInt(10, 30) // mock total
       };
       if (firebaseConfig.databaseURL && firebaseConfig.databaseURL.includes('firebaseio.com') && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
          set(ref(db, `workers/${workerId}/history/${today}`), historyData);
       }
    }
  });
}

console.log('Starting IoT Worker Simulator...');
console.log('Ensure you have a .env file with FIREBASE_ configuration variables to actually write to the database.');
// Run every 5 seconds
setInterval(simulateTick, 5000);
