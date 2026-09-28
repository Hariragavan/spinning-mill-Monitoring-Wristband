/*
  Beacon 2 Station Firmware - ESP32
  ---------------------------------------------------------------------------------
  Station: M1-B4 (Midpoint / Half-Round Station)
  Peer Beacon: M1-A1 (Beacon 1 Gateway)
  Monitored Band: WRISTBAND_01
  
  Features:
  - 1-Second Online Heartbeat to Supabase 'beacons' table (Marks M1-B4 as ONLINE)
  - Mutual Inter-Beacon Distance: Measures distance to Beacon 1 (M1-A1)
  - 10cm Touch Check-in:
      * When wristband reaches B2 (10cm touch) -> Logs 'HALF_ROUND_COMPLETED' (Visited B2)
      * Updates worker's live location to Side B / M1-B4 and Heading to 'Return'
  - BLE Broadcaster: Broadcasts M1-B4 so Beacon 1 & Wristband detect it
  - BLE Scanner: Listens for Wristband and Beacon 1
  - Safe 3000ms HTTP Timeouts (Eliminates TLS Handshake abort bugs)
  - Multi-Beacon Arbitration: Only updates worker status when band is actively present
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
#define LOCAL_ZONE_THRESHOLD  -65  // Inside Side B zone boundary

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

// 3-Second Idle Engine (EMA Filtered)
unsigned long lastMovementTime = 0;
float baselineDistance = 0.0;
float smoothedDistanceM = -1.0;
bool hasHardwareMotion = false;
String currentMotionState = "stationary";
int idleDurationSec = 0;
float walkingSpeed = 0.00;

unsigned long lastTransitionTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastSyncTime = 0;
unsigned long lastDashboardSyncTime = 0;
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

// 1. Send Online Heartbeat to 'beacons' table (PATCH avoids conflict errors)
void sendBeaconHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(3000);

  HTTPClient https;
  https.setTimeout(3000);

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
}

// 2. Upload Half-Round Check-in Event
void handleEventUpload() {
  if (!pendingEventUpload) return;
  if (WiFi.status() != WL_CONNECTED) {
    pendingEventUpload = false;
    return;
  }

  // A. Log Event in 'telemetry_logs' (Isolated socket scope)
  {
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

      https.POST(payload);
      https.end();
    }
  }

  // B. Update Worker Position in 'workers' (Fresh isolated socket scope)
  {
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(3000);

    HTTPClient https;
    https.setTimeout(3000);

    String workerEndpoint = String(SUPABASE_URL) + "/rest/v1/workers?worker_id=eq." + String(WORKER_ID);
    if (https.begin(client, workerEndpoint)) {
      https.addHeader("Content-Type", "application/json");
      https.addHeader("apikey", SUPABASE_KEY);
      https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      https.addHeader("Prefer", "return=minimal");

      String payload = "{";
      payload += "\"current_zone\":\"Side B\",";
      payload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
      payload += "\"beacon_rssi\":" + String(queuedRssi) + ",";
      payload += "\"current_machine\":\"M1\",";
      payload += "\"directional_heading\":\"Return\",";
      payload += "\"motion_state\":\"walking\",";
      payload += "\"shift_status\":\"active\"";
      payload += "}";

      https.PATCH(payload);
      https.end();
    }
  }

  pendingEventUpload = false;
  Serial.println("[SUPABASE] Half-Round Check-in recorded at Beacon 2 (M1-B4)!");
}

// 3. Sync Worker Dashboard when band is in Side B range (Zone-Guarded to prevent overwriting B1)
void syncWorkerDashboard() {
  if (WiFi.status() != WL_CONNECTED) return;

  // Band is actively within Beacon 2's local station territory (Side B)
  bool isNearB2 = (millis() - lastBandSeenTime < 4000) && (currentBandRssi >= LOCAL_ZONE_THRESHOLD);

  // If the band is NOT near Beacon 2, DO NOT touch the workers table!
  // This allows Beacon 1 to own the worker when they are on Side A.
  if (!isNearB2) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(3000);

  HTTPClient https;
  https.setTimeout(3000);

  String url = String(SUPABASE_URL) + "/rest/v1/workers?worker_id=eq." + String(WORKER_ID);
  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "return=minimal");

    String payload = "{";
    payload += "\"current_zone\":\"Side B\",";
    payload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"beacon_rssi\":" + String(currentBandRssi) + ",";
    payload += "\"current_machine\":\"M1\",";
    payload += "\"directional_heading\":\"Return\",";
    payload += "\"motion_state\":\"" + currentMotionState + "\",";
    payload += "\"idle_duration_sec\":" + String(idleDurationSec) + ",";
    payload += "\"walking_speed_ms\":" + String(walkingSpeed, 2) + ",";
    payload += "\"shift_status\":\"active\",";
    payload += "\"beacon_battery_pct\":100";
    payload += "}";

    https.PATCH(payload);
    https.end();
  }
}

// Scanner Callback: Listens for Wristband and Beacon 1 (M1-A1)
class Beacon2ScannerCallback: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName()) return;
    String name = advertisedDevice.getName().c_str();
    int rssi = advertisedDevice.getRSSI();

    // 1. Mutual Range Detection to Beacon 1 (M1-A1)
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

      // Exponential Moving Average (EMA) Filter: suppresses indoor RF multipath noise
      if (smoothedDistanceM < 0.0) {
        smoothedDistanceM = rawDistance;
      } else {
        smoothedDistanceM = (0.70 * smoothedDistanceM) + (0.30 * rawDistance);
      }

      // Hardware Accelerometer Sync (Reads MPU6050 payload from band if available)
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
      // RF-Stabilized Motion Filter Fallback using Smoothed Distance (Requires > 0.80m displacement)
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

      // 10cm Touch Event: Visited Beacon 2 (Half-Round Checkpoint)
      if (currentBandRssi >= TOUCH_RSSI_THRESHOLD) {
        if (millis() - lastTransitionTime < 4000) return; // Debounce 4s
        lastTransitionTime = millis();

        triggerBlink(6);
        Serial.println("\n***************************************************");
        Serial.println("  >>> [BEACON 2] 10cm TOUCH: HALF-ROUND VISITED! <<< ");
        Serial.printf ("  Signal: %d dBm | Est Distance: %.1f cm\n", currentBandRssi, currentBandDistanceM * 100.0);
        Serial.println("***************************************************\n");

        queuedRssi = currentBandRssi;
        queuedDistanceCm = currentBandDistanceM * 100.0;
        pendingEventUpload = true;
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

  // 1. BLE Broadcaster (Sends M1-B4 so Beacon 1 knows B2 range)
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

  // 2. BLE Scanner (Listens for Wristband and Beacon 1)
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new Beacon2ScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  lastMovementTime = millis();
  baselineDistance = 1.0;
  lastHeartbeatTime = millis(); // Initialize heartbeat timer
  sendBeaconHeartbeat();
  Serial.println("✓ Beacon 2 Active & Broadcasting M1-B4\n");
}

void loop() {
  handleEventUpload();

  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 3-Second Idle Engine: If stationary for >= 3 seconds, update state (only when hardware accelerometer is not reporting)
  if (!hasHardwareMotion && (millis() - lastMovementTime >= 3000)) {
    currentMotionState = "stationary";
    walkingSpeed = 0.00;
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // Periodic Worker Dashboard Sync every 2 seconds (only fires if band is present at B2)
  if (millis() - lastDashboardSyncTime >= 2000) {
    lastDashboardSyncTime = millis();
    syncWorkerDashboard();
  }

  // Print Monitor Log every 2 seconds
  if (millis() - lastSyncTime >= 2000) {
    lastSyncTime = millis();
    Serial.printf("[B2 MONITOR] Band: %.2fm (%d dBm) | Motion: %s (%ds) | Peer B1: %.1fm (%d dBm)\n",
                  currentBandDistanceM, currentBandRssi,
                  currentMotionState.c_str(), idleDurationSec,
                  peerBeaconDistanceM, peerBeaconRssi);
  }

  // Beacon 2 Heartbeat to 'beacons' table (Staggered to 5000ms to eliminate 4-second TLS collisions)
  if (millis() - lastHeartbeatTime >= 5000) {
    lastHeartbeatTime = millis();
    sendBeaconHeartbeat();
  }

  // Wi-Fi Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck >= 10000) {
    lastWiFiCheck = millis();
    WiFi.reconnect();
  }

  updateBlinkEngine();
}
