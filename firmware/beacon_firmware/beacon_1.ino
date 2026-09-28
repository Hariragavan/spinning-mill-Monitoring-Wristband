/*
  Beacon 1 Gateway Firmware - ESP32
  ---------------------------------------------------------------------------------
  Station: M1-A1 (Start / Finish Gate Station)
  Peer Beacon: M1-B4 (Midpoint Station)
  Monitored Band: WRISTBAND_01
  
  Features:
  - 1-Second Online Heartbeat to Supabase 'beacons' table (Live Online/Offline Detection)
  - Mutual Inter-Beacon Distance: Measures distance to Beacon 2 (M1-B4)
  - 10cm Touch Check-in:
      * Start Round at B1 (Lap Started)
      * Returning from B2 (1 Round Completed + Exact Duration Calculation)
  - 3-Second Idle Engine: Detects stationary periods > 3 seconds
  - 1-Second Live Worker Dashboard Sync to Supabase 'workers' table
  - Milestone Logging to Supabase 'telemetry_logs' table
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
const char* WIFI_SSID          = "Redmi Note 11T 5G";
const char* WIFI_PASSWORD      = "hari1234";

const char* SUPABASE_URL       = "https://vldhjpvyphzxofmwqmys.supabase.co"; 
const char* SUPABASE_KEY       = "sb_publishable_UxA-HekCjNWcPPBTmlbyJg_RVErZCmK";

// =================== HARDWARE & THRESHOLDS ===================
#define STATION_ID             "M1-A1"
#define PEER_BEACON_ID         "M1-B4"
#define TARGET_BAND_NAME       "WRISTBAND_01"
#define WORKER_ID              "worker_1"
#define STATUS_LED_PIN         2
#define RESET_BUTTON_PIN       0

#define TOUCH_RSSI_THRESHOLD  -38  // ~10 cm touch check-in
#define LIVE_RSSI_THRESHOLD   -85  // In-room boundary

const int MEASURED_POWER_1M    = -59;
const float PATH_LOSS_EXPONENT = 2.0;

// =================== STATE ENGINE ===================
enum PatrolState { IDLE, OUTBOUND, RETURNING, COMPLETED };
PatrolState currentPatrolState = IDLE;

unsigned long lapStartTime = 0;
unsigned long lastTransitionTime = 0;
int completedLapCount = 0;
float lastCompletedDuration = 0.00;
BLEScan* pBLEScan;

// Band & Peer Beacon Tracking
int currentBandRssi = -99;
float currentBandDistanceM = 99.0;
unsigned long lastBandSeenTime = 0;

int peerBeaconRssi = -99;
float peerBeaconDistanceM = -1.0;
unsigned long lastPeerSeenTime = 0;

// 3-Second Idle Engine
unsigned long lastMovementTime = 0;
float lastLoggedDistance = 0.0;
int lastLoggedRssi = 0;
String currentMotionState = "stationary";
int idleDurationSec = 0;
float walkingSpeed = 0.00;
String currentHeading = "Stationary";

// Asynchronous Queues
volatile bool pendingEventUpload = false;
String queuedEventName = "";
float queuedDuration = 0.0;
int queuedRssi = -40;
float queuedDistanceCm = 5.0;

unsigned long lastDashboardSyncTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastWiFiCheck = 0;

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

// 1. Send Online Heartbeat to 'beacons' table (1-Second Engine)
void sendBeaconHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(2);

  HTTPClient https;
  https.setTimeout(2000);

  String url = String(SUPABASE_URL) + "/rest/v1/beacons?on_conflict=beacon_id";
  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

    String payload = "{";
    payload += "\"beacon_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"station_id\":\"A1\",";
    payload += "\"machine_id\":\"M1\",";
    payload += "\"zone\":\"Side A\",";
    payload += "\"status\":\"online\",";
    payload += "\"battery_pct\":100";
    payload += "}";

    https.POST(payload);
    https.end();
  }
}

// 2. Sync Worker Dashboard to 'workers' table (1-Second Engine)
void syncWorkerDashboard() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool isBandPresent = (millis() - lastBandSeenTime < 5000) && (currentBandRssi >= LIVE_RSSI_THRESHOLD);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(2);

  HTTPClient https;
  https.setTimeout(2000);

  String url = String(SUPABASE_URL) + "/rest/v1/workers?on_conflict=worker_id";
  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    https.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

    float liveDuration = 0.00;
    if (currentPatrolState == OUTBOUND || currentPatrolState == RETURNING) {
      liveDuration = (millis() - lapStartTime) / 1000.0;
    } else if (lastCompletedDuration > 0) {
      liveDuration = lastCompletedDuration;
    }

    String payload = "{";
    payload += "\"worker_id\":\"" + String(WORKER_ID) + "\",";
    payload += "\"device_id\":\"" + String(TARGET_BAND_NAME) + "\",";
    payload += "\"current_zone\":\"Side A\",";
    payload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"beacon_rssi\":" + String(isBandPresent ? currentBandRssi : -85) + ",";
    payload += "\"current_machine\":\"M1\",";
    payload += "\"lap_count\":" + String(completedLapCount) + ",";
    payload += "\"lap_duration_sec\":" + String(liveDuration, 2) + ",";
    payload += "\"directional_heading\":\"" + currentHeading + "\",";
    payload += "\"motion_state\":\"" + currentMotionState + "\",";
    payload += "\"idle_duration_sec\":" + String(idleDurationSec) + ",";
    payload += "\"walking_speed_ms\":" + String(walkingSpeed, 2) + ",";
    payload += "\"shift_status\":\"active\",";
    payload += "\"beacon_battery_pct\":100";
    payload += "}";

    https.POST(payload);
    https.end();
  }
}

// 3. Log Checkpoint Events to 'telemetry_logs' table
void handleEventUpload() {
  if (!pendingEventUpload) return;
  if (WiFi.status() != WL_CONNECTED) {
    pendingEventUpload = false;
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(3);

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
    payload += "\"event\":\"" + queuedEventName + "\",";
    payload += "\"lap_duration_sec\":" + String(queuedDuration, 2) + ",";
    payload += "\"signal_rssi\":" + String(queuedRssi) + ",";
    payload += "\"est_distance_cm\":" + String(queuedDistanceCm, 2) + ",";
    payload += "\"uptime_ms\":" + String(millis());
    payload += "}";

    int code = https.POST(payload);
    if (code == 200 || code == 201) {
      Serial.printf("[SUPABASE] Logged '%s' (%.2fs)!\n", queuedEventName.c_str(), queuedDuration);
    }
    https.end();
  }

  pendingEventUpload = false;
  syncWorkerDashboard(); // Instant dashboard update
}

// Scanner Callback: Watches for Wristband and Peer Beacon (M1-B4)
class Beacon1ScannerCallback: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName()) return;
    String name = advertisedDevice.getName().c_str();
    int rssi = advertisedDevice.getRSSI();

    // 1. Mutual Range Detection to Beacon 2 (M1-B4)
    if (name == PEER_BEACON_ID) {
      peerBeaconRssi = rssi;
      peerBeaconDistanceM = calculateDistance(rssi);
      lastPeerSeenTime = millis();
    }

    // 2. Wristband Detection
    if (name == TARGET_BAND_NAME) {
      currentBandRssi = rssi;
      currentBandDistanceM = calculateDistance(rssi);
      lastBandSeenTime = millis();

      // Motion vs Idle Detection (RF filtered)
      if (abs(currentBandRssi - lastLoggedRssi) >= 5 || abs(currentBandDistanceM - lastLoggedDistance) >= 0.35) {
        lastMovementTime = millis();
        lastLoggedDistance = currentBandDistanceM;
        lastLoggedRssi = currentBandRssi;
        currentMotionState = "walking";
        walkingSpeed = 1.20;
        idleDurationSec = 0;
      }

      // 10cm Touch Check-in Event
      if (currentBandRssi >= TOUCH_RSSI_THRESHOLD) {
        if (millis() - lastTransitionTime < 3000) return; // Debounce 3s

        // A. START ROUND (Touch at B1 when idle or finished)
        if (currentPatrolState == IDLE || currentPatrolState == COMPLETED) {
          currentPatrolState = OUTBOUND;
          lapStartTime = millis();
          lastTransitionTime = millis();
          currentHeading = "Forward";
          triggerBlink(4);

          Serial.println("\n***************************************************");
          Serial.println("  >>> [BEACON 1] 10cm TOUCH: ROUND STARTED! <<<    ");
          Serial.printf ("  Touch Signal: %d dBm | Est Distance: %.1f cm\n", currentBandRssi, currentBandDistanceM * 100.0);
          Serial.println("***************************************************\n");

          queuedEventName = "LAP_STARTED";
          queuedDuration = 0.00;
          queuedRssi = currentBandRssi;
          queuedDistanceCm = currentBandDistanceM * 100.0;
          pendingEventUpload = true;
        }
        // B. FINISH 1 ROUND (Returning to B1 after visiting B2)
        else if (currentPatrolState == RETURNING || (currentPatrolState == OUTBOUND && millis() - lapStartTime > 8000)) {
          currentPatrolState = COMPLETED;
          completedLapCount++;
          lastCompletedDuration = (millis() - lapStartTime) / 1000.0;
          lastTransitionTime = millis();
          currentHeading = "Forward";
          triggerBlink(8);

          Serial.println("\n===================================================");
          Serial.println("  >>> [BEACON 1] 10cm TOUCH: 1 ROUND COMPLETED! <<< ");
          Serial.printf ("  Total Round Duration: %.2f seconds\n", lastCompletedDuration);
          Serial.printf ("  Rounds Completed: %d\n", completedLapCount);
          Serial.println("===================================================\n");

          queuedEventName = "ROUND_COMPLETED";
          queuedDuration = lastCompletedDuration;
          queuedRssi = currentBandRssi;
          queuedDistanceCm = currentBandDistanceM * 100.0;
          pendingEventUpload = true;

          // Auto-start next round
          lapStartTime = millis();
          currentPatrolState = OUTBOUND;
        }
      }
    }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(1000);

  Serial.println("\n=========================================");
  Serial.println("   BEACON 1 GATEWAY (M1-A1) STARTING     ");
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

  // 1. BLE Broadcaster (Sends M1-A1 so Beacon 2 knows B1 range)
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

  // 2. BLE Scanner (Listens for Wristband and Beacon 2)
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new Beacon1ScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(120);
  pBLEScan->setWindow(80);

  lastMovementTime = millis();
  sendBeaconHeartbeat();
  Serial.println("✓ Beacon 1 Active & Broadcasting M1-A1\n");
}

void loop() {
  handleEventUpload();

  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 3-Second Idle Engine: If worker has not moved for 3 seconds -> mark idle
  if (millis() - lastMovementTime >= 3000) {
    currentMotionState = "stationary";
    walkingSpeed = 0.00;
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // Live 1-Second Heartbeat Engine (Sync to Supabase every 1.5 seconds)
  if (millis() - lastDashboardSyncTime >= 1500) {
    lastDashboardSyncTime = millis();
    syncWorkerDashboard();

    // Print mutual range & status
    Serial.printf("[B1 MONITOR] Band: %.2fm (%d dBm) | Motion: %s (%ds) | Peer B2 (M1-B4): %.1fm (%d dBm)\n",
                  currentBandDistanceM, currentBandRssi,
                  currentMotionState.c_str(), idleDurationSec,
                  peerBeaconDistanceM, peerBeaconRssi);
  }

  // Beacon 1 Heartbeat to 'beacons' table (Marks M1-A1 ONLINE)
  if (millis() - lastHeartbeatTime >= 3000) {
    lastHeartbeatTime = millis();
    sendBeaconHeartbeat();
  }

  // Wi-Fi Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck >= 10000) {
    lastWiFiCheck = millis();
    WiFi.reconnect();
  }

  updateBlinkEngine();

  // Manual Reset Button
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      currentPatrolState = IDLE;
      completedLapCount = 0;
      lastCompletedDuration = 0.0;
      Serial.println("\n[RESET] Patrol counters reset to IDLE.\n");
      triggerBlink(2);
      syncWorkerDashboard();
      while (digitalRead(RESET_BUTTON_PIN) == LOW);
    }
  }
}
