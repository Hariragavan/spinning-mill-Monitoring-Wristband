/**
 * Firebase Realtime Database Data Model Helper
 */

export function createDeviceDataPayload(rawPayload) {
  return {
    device_id: rawPayload.device_id || 'unknown',
    system_id: rawPayload.system_id || 'spinning_mill',
    location: {
      beacon_id: rawPayload.location?.beacon_id || 1,
      zone_name: rawPayload.location?.zone_name || 'Side A',
      rssi_dbm: rawPayload.location?.rssi_dbm || -70
    },
    patrol: {
      state: rawPayload.patrol?.state || 'IDLE',
      lap_count: rawPayload.patrol?.lap_count || 0,
      current_lap_sec: rawPayload.patrol?.current_lap_sec || 0,
      completed_lap_sec: rawPayload.patrol?.completed_lap_sec || 0
    },
    motion: {
      motion_state: rawPayload.motion?.motion_state || 'stationary',
      speed_estimate_ms: rawPayload.motion?.speed_estimate_ms || 0,
      idle_sec: rawPayload.motion?.idle_sec || 0
    },
    safety: {
      assistance_requested: rawPayload.safety?.assistance_requested || false
    },
    telemetry: {
      uptime_ms: rawPayload.telemetry?.uptime_ms || 0
    },
    received_at: new Date().toISOString()
  };
}

export default createDeviceDataPayload;
