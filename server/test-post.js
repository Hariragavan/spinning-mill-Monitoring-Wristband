import http from 'http';

const data = JSON.stringify({
  "device_id": "ESP32C3-WRIST-01",
  "system_id": "0xCAFE",
  "location": {
    "beacon_id": 2,
    "zone_name": "Station 2 (Midpoint)",
    "rssi_dbm": -61
  },
  "patrol": {
    "state": "RETURNING",
    "lap_count": 1,
    "current_lap_sec": 18.45,
    "completed_lap_sec": 0.00
  },
  "motion": {
    "motion_state": "walking",
    "speed_estimate_ms": 1.08,
    "idle_sec": 0
  },
  "safety": {
    "assistance_requested": false
  },
  "telemetry": {
    "uptime_ms": 78240
  }
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/device-data',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error('Error posting data:', error);
});

req.write(data);
req.end();
console.log('Sending test telemetry packet to backend...');
