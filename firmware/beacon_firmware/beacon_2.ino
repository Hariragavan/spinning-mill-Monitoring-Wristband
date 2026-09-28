/*
  Beacon 2 Station Firmware - ESP32 (Production-Ready Final Edition)
  ---------------------------------------------------------------------------------
  Station: M1-B4 (Midpoint / Half-Round Station)
  Peer Beacon: M1-A1 (Beacon 1 Gateway)
  Monitored Band: WRISTBAND_01
  
  Architecture:
  - Dual BLE: Broadcasts "M1-B4" while scanning for "WRISTBAND_01" & "M1-A1"
  - Periodic 5s Online Heartbeat to 'beacons' table (Keeps M1-B4 ONLINE)
  - Periodic 2s Live Dashboard Sync to 'workers' table (Side B / Heading Control)
  - Proximity 10cm Check-in: Logs 'HALF_ROUND_COMPLETED' in 'telemetry_logs'
  - 3-Second Idle Engine (EMA Noise Filtered)
  - Non-blocking asynchronous queues (WDT-Safe)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <math.h>

// =================== NETWORK CONFIGURATION ===================
const char* WIFI_SSID          = "Redmi11T";
const char* WIFI_PASSWORD      = "hari1234";

const char* SUPABASE_URL       = "https://vldhjpvyphzxofmwqmys.supabase.co"; 
const char* SUPABASE_KEY       = "sb_publishable_UxA-HekCjNWcPPBTmlbyJg_RVErZCmK";

// =================== HARDWARE & THRESHOLDS ===================
#define STATION_ID             "M1-B4"
#define PEER_BEACON_ID         "M1-A1"
#define TARGET_BAND_NAME       "WRISTBAND_01"
#define WORKER_ID              "worker_1"
#define STATUS_LED_PIN         2

#define TOUCH_RSSI_THRESHOLD  -38  // ~10 cm touch check-in
#define LIVE_RSSI_THRESHOLD   -85  // In-room boundary
#define LOCAL_ZONE_THRESHOLD  -65  // Inside Side B station boundary

const int MEASURED_POWER_1M    = -59;
const float PATH_LOSS_EXPONENT = 2.0;

// State Variables
BLEScan* pBLEScan;
int currentBandRssi = -99;
float currentBandDistanceM = 99.0;
unsigned long lastBandSeenTime = 0;

int peerBeaconRssi = -99;
float peerBeaconDistanceM = -1.0;
unsigned long lastPeerSeenTime = 0;

// Checkpoint & Ownership State
bool isReturnLegOwner = false;
bool hasDepartedB2 = true;
unsigned long lastCheckpointTouchTime = 0;

// 3-Second Idle Engine (EMA Filtered)
unsigned long lastMovementTime = 0;
float baselineDistance = 0.0;
float smoothedDistanceM = -1.0;
bool hasHardwareMotion = false;
String currentMotionState = "stationary";
int idleDurationSec = 0;
float walkingSpeed = 0.00;

// System Timers
unsigned long lastHeartbeatTime = 0;
unsigned long lastDashboardSyncTime = 0;
unsigned long lastMonitorLogTime = 0;
unsigned long lastWiFiCheck = 0;

// Asynchronous Queues
volatile bool pendingEventUpload = false;
int queuedRssi = -40;
float queuedDistanceCm = 5.0;

// Non-blocking LED Engine
bool isBlinking = false;
int blinkCycles = 0;
bool ledState = LOW;
unsigned long lastBlinkToggle = 0;

void triggerBlink(int count) {
  isBlinking = true;
  blinkCycles = count * 2;
  lastBlinkToggle = millis();
}

void updateBlinkEngine() {
  if (!isBlinking) return;
  if (millis() - lastBlinkToggle >= 70) {
    lastBlinkToggle = millis();
    ledState = !ledState;
    digitalWrite(STATUS_LED_PIN, ledState);
    blinkCycles--;
    if (blinkCycles <= 0) {
      isBlinking = false;
      digitalWrite(STATUS_LED_PIN, LOW);
    }
  }
}

float calculateDistance(int rssi) {
  if (rssi == 0) return -1.0;
  float ratio = (float)(MEASURED_POWER_1M - rssi) / (10.0 * PATH_LOSS_EXPONENT);
  return pow(10.0, ratio);
}

// 1. Send Online Heartbeat to 'beacons' table (Keeps M1-B4 ONLINE)
void sendBeaconHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(2500);

  HTTPClient https;
  https.setTimeout(2500);

  String url = String(SUPABASE_URL) + "/rest/v1/beacons?beacon_id=eq." + String(STATION_ID);
  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "return=minimal");

    String payload = "{\"status\":\"online\",\"battery_pct\":100}";
    https.PATCH(payload);
    https.end();
  }
  client.stop(); // Immediate TLS heap cleanup
}

// 2. Sync Worker Dashboard (Zone-Guarded & Stale-Proof)
void syncWorkerDashboard() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool isBandPresent = (millis() - lastBandSeenTime < 4500) && (currentBandRssi >= LIVE_RSSI_THRESHOLD);
  bool isNearB2 = isBandPresent && (currentBandRssi >= LOCAL_ZONE_THRESHOLD);

  // Maintain ownership if actively near B2 OR if worker is on return leg and still heard
  bool shouldOwnUpdate = isNearB2 || (isReturnLegOwner && isBandPresent);
  if (!shouldOwnUpdate) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(2500);

  HTTPClient https;
  https.setTimeout(2500);

  String url = String(SUPABASE_URL) + "/rest/v1/workers?worker_id=eq." + String(WORKER_ID);
  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "return=minimal");

    // Dynamic Heading: "Forward" while approaching B4, "Return" once checkpoint is visited
    String heading = isReturnLegOwner ? "Return" : "Forward";

    String payload = "{";
    payload += "\"current_zone\":\"Side B\",";
    payload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"beacon_rssi\":" + String(currentBandRssi) + ",";
    payload += "\"current_machine\":\"M1\",";
    payload += "\"directional_heading\":\"" + heading + "\",";
    payload += "\"motion_state\":\"" + currentMotionState + "\",";
    payload += "\"idle_duration_sec\":" + String(idleDurationSec) + ",";
    payload += "\"walking_speed_ms\":" + String(walkingSpeed, 2) + ",";
    payload += "\"shift_status\":\"active\",";
    payload += "\"beacon_battery_pct\":100";
    payload += "}";

    https.PATCH(payload);
    https.end();
  }
  client.stop(); // Immediate TLS heap cleanup
}

// 3. Upload Half-Round Check-in Event (telemetry_logs)
void handleEventUpload() {
  if (!pendingEventUpload) return;
  if (WiFi.status() != WL_CONNECTED) {
    pendingEventUpload = false;
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(3000);

  HTTPClient https;
  https.setTimeout(3000);

  String logEndpoint = String(SUPABASE_URL) + "/rest/v1/telemetry_logs";
  if (https.begin(client, logEndpoint)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "return=minimal");

    String payload = "{";
    payload += "\"station_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"target_device\":\"" + String(TARGET_BAND_NAME) + "\",";
    payload += "\"event\":\"HALF_ROUND_COMPLETED\",";
    payload += "\"lap_duration_sec\":0.00,";
    payload += "\"signal_rssi\":" + String(queuedRssi) + ",";
    payload += "\"est_distance_cm\":" + String(queuedDistanceCm, 2) + ",";
    payload += "\"uptime_ms\":" + String(millis());
    payload += "}";

    int code = https.POST(payload);
    if (code == 200 || code == 201) {
      Serial.println("[SUPABASE] Half-Round Check-in recorded at Beacon 2 (M1-B4)!");
    }
    https.end();
  }
  client.stop(); // Immediate TLS heap cleanup

  pendingEventUpload = false;
  syncWorkerDashboard(); // Instant state sync to update heading to "Return"
}

// Scanner Callback: Evaluates Wristband and Beacon 1 (M1-A1)
class Beacon2ScannerCallback: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName()) return;
    String name = advertisedDevice.getName().c_str();
    int rssi = advertisedDevice.getRSSI();

    // 1. Inter-Beacon Tracking to Beacon 1 (M1-A1)
    if (name == PEER_BEACON_ID) {
      peerBeaconRssi = rssi;
      peerBeaconDistanceM = calculateDistance(rssi);
      lastPeerSeenTime = millis();
    }

    // 2. Wristband Detection
    if (name == TARGET_BAND_NAME) {
      currentBandRssi = rssi;
      float rawDistance = calculateDistance(rssi);
      currentBandDistanceM = rawDistance;
      lastBandSeenTime = millis();

      // Exponential Moving Average (EMA) Filter
      if (smoothedDistanceM < 0.0) {
        smoothedDistanceM = rawDistance;
      } else {
        smoothedDistanceM = (0.70 * smoothedDistanceM) + (0.30 * rawDistance);
      }

      // Accelerometer Payload Sync (if wristband broadcasts MPU data)
      if (advertisedDevice.haveManufacturerData()) {
        std::string mfg = advertisedDevice.getManufacturerData();
        if (mfg.length() >= 2) {
          hasHardwareMotion = true;
          if ((uint8_t)mfg[0] == 0x01) {
            currentMotionState = "walking";
            walkingSpeed = 1.20;
            idleDurationSec = 0;
            lastMovementTime = millis();
          } else {
            currentMotionState = "stationary";
            walkingSpeed = 0.00;
            idleDurationSec = (uint8_t)mfg[1];
          }
        }
      } 
      // RF Displacement Fallback (Requires > 0.80m displacement)
      else {
        hasHardwareMotion = false;
        if (abs(smoothedDistanceM - baselineDistance) >= 0.80) {
          lastMovementTime = millis();
          baselineDistance = smoothedDistanceM;
          currentMotionState = "walking";
          walkingSpeed = 1.20;
          idleDurationSec = 0;
        }
      }

      // Departure Detection: Worker moved away from B4 on the return path (> 1.80m or RSSI <= -65 dBm)
      if (!hasDepartedB2) {
        if (smoothedDistanceM > 1.80 || currentBandRssi <= -65) {
          hasDepartedB2 = true;
          Serial.println("[BEACON 2] Departure Verified: Worker en route back to Station A1.");
        }
      }

      // 10cm Checkpoint Touch Event
      if (currentBandRssi >= TOUCH_RSSI_THRESHOLD) {
        if (millis() - lastCheckpointTouchTime < 3000) return; // 3-second debounce

        if (hasDepartedB2) {
          lastCheckpointTouchTime = millis();
          hasDepartedB2 = false;
          isReturnLegOwner = true; // Claim live updates for the return path

          triggerBlink(6);
          Serial.println("\n***************************************************");
          Serial.println("  >>> [BEACON 2] 10cm TOUCH: HALF-ROUND VISITED! <<< ");
          Serial.printf ("  Signal: %d dBm | Distance: %.1f cm\n", currentBandRssi, currentBandDistanceM * 100.0);
          Serial.println("***************************************************\n");

          queuedRssi = currentBandRssi;
          queuedDistanceCm = currentBandDistanceM * 100.0;
          pendingEventUpload = true;
        }
      }
    }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(1000);

  Serial.println("\n=========================================");
  Serial.println("   BEACON 2 STATION (M1-B4) STARTING     ");
  Serial.println("=========================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✓ Wi-Fi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  }

  // 1. BLE Broadcaster (Sends M1-B4 so B1 tracks distance to B2)
  BLEDevice::init(STATION_ID);
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(STATION_ID);
  pAdvertising->setAdvertisementData(advData);
  pAdvertising->setMinInterval(160);
  pAdvertising->setMaxInterval(160);
  BLEDevice::startAdvertising();

  // 2. BLE Scanner
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new Beacon2ScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  lastMovementTime = millis();
  baselineDistance = 1.0;
  
  // Initialize timers cleanly (natural stagger: sync at 2s, heartbeat at 5s)
  lastDashboardSyncTime = millis();
  lastHeartbeatTime = millis();
  lastMonitorLogTime = millis();
  lastWiFiCheck = millis();

  sendBeaconHeartbeat();
  Serial.println("✓ Beacon 2 Active & Broadcasting M1-B4\n");
}

void loop() {
  handleEventUpload();

  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 3-Second Idle Engine: If stationary for >= 3 seconds, update state
  if (!hasHardwareMotion && (millis() - lastMovementTime >= 3000)) {
    currentMotionState = "stationary";
    walkingSpeed = 0.00;
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // Departure Timeout Fallback: confirm departure if absent for > 4s after touch
  if (!hasDepartedB2 && (millis() - lastBandSeenTime > 4000) && (millis() - lastCheckpointTouchTime > 4000)) {
    hasDepartedB2 = true;
    Serial.println("[BEACON 2] Departure Verified via Absence (en route to Station A1).");
  }

  // Release return-leg ownership once worker is well en route to B1 or absent > 6s
  if (isReturnLegOwner && (currentBandRssi <= -82 || millis() - lastBandSeenTime > 6000)) {
    isReturnLegOwner = false;
  }

  // Live Dashboard Sync every 2 seconds
  if (millis() - lastDashboardSyncTime >= 2000) {
    lastDashboardSyncTime = millis();
    syncWorkerDashboard();
  }

  // Monitor Print Log every 2 seconds
  if (millis() - lastMonitorLogTime >= 2000) {
    lastMonitorLogTime = millis();
    Serial.printf("[B2 MONITOR] Band: %.2fm (%d dBm) | Motion: %s (%ds) | Peer B1: %.1fm (%d dBm)\n",
                  currentBandDistanceM, currentBandRssi,
                  currentMotionState.c_str(), idleDurationSec,
                  peerBeaconDistanceM, peerBeaconRssi);
  }

  // Beacon 2 Heartbeat every 5 seconds (Keeps M1-B4 ONLINE)
  if (millis() - lastHeartbeatTime >= 5000) {
    lastHeartbeatTime = millis();
    sendBeaconHeartbeat();
  }

  // Auto-reconnect Wi-Fi
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck >= 10000) {
    lastWiFiCheck = millis();
    WiFi.reconnect();
  }

  updateBlinkEngine();
}
