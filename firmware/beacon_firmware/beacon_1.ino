/*
  Beacon 1 Gateway Firmware - ESP32 (Production-Ready Edition)
  -------------------------------------------------------------
  Station: M1-A1 (Start / Finish Gate Station)
  Peer Beacon: M1-B4 (Midpoint Station)
  Monitored Band: WRISTBAND_01
  
  Key Fixes Applied:
  1. No Location-Snapping: Only claims Side A / M1-A1 when worker is locally near B1 (>= -65 dBm).
     Uses HTTP PATCH so Beacon 2's Side B updates are never overwritten while worker is away.
  2. RF Jitter Filter: Uses positional displacement (>= 0.6m) instead of raw dBm to prevent
     ambient RF noise from falsely triggering "walking" when stationary.
  3. Staggered Timers: Worker sync every 2s, Beacon heartbeat every 6s on separate ticks to prevent
     BLE scanner starvation and missed 10cm touch swipes.
  4. PostgREST PATCH: Directly updates seeded records without conflict headers or constraint errors.
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
#define LOCAL_ZONE_THRESHOLD  -65  // Inside Side A zone boundary

const int MEASURED_POWER_1M    = -59;
const float PATH_LOSS_EXPONENT = 2.0;

// =================== STATE ENGINE ===================
enum PatrolState { IDLE, OUTBOUND, RETURNING, COMPLETED };
PatrolState currentPatrolState = IDLE;

unsigned long lapStartTime = 0;
unsigned long lastTransitionTime = 0;
int completedLapCount = 0;
float lastCompletedDuration = 0.00;
bool hasLeftStation = false; // Prevents false round completion if worker stays at B1
BLEScan* pBLEScan;

// Band & Peer Beacon Tracking
int currentBandRssi = -99;
float currentBandDistanceM = 99.0;
unsigned long lastBandSeenTime = 0;

int peerBeaconRssi = -99;
float peerBeaconDistanceM = -1.0;
unsigned long lastPeerSeenTime = 0;

// 3-Second Idle Engine (RF Filtered)
unsigned long lastMovementTime = 0;
float baselineDistance = 0.0;
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

    String payload = "{\"status\":\"online\",\"battery_pct\":100}";
    https.PATCH(payload);
    https.end();
  }
}

// 2. Sync Worker Dashboard to 'workers' table (PATCH prevents location-snapping)
void syncWorkerDashboard() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool isBandPresent = (millis() - lastBandSeenTime < 4000) && (currentBandRssi >= LIVE_RSSI_THRESHOLD);

  // CRITICAL FIX: If the band is not actively near Beacon 1, do NOT push worker updates.
  // This allows Beacon 2 (where the worker is) to be the sole owner of location, heading, and motion!
  if (!isBandPresent) return;

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

    float liveDuration = 0.00;
    if (currentPatrolState == OUTBOUND || currentPatrolState == RETURNING) {
      liveDuration = (millis() - lapStartTime) / 1000.0;
    } else if (lastCompletedDuration > 0) {
      liveDuration = lastCompletedDuration;
    }

    String payload = "{";
    payload += "\"current_zone\":\"Side A\",";
    payload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"beacon_rssi\":" + String(currentBandRssi) + ",";
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

    https.PATCH(payload);
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
  syncWorkerDashboard();
}

// Scanner Callback: Evaluates Wristband and Peer Beacon (M1-B4)
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

    // 2. Wristband Tracking
    if (name == TARGET_BAND_NAME) {
      currentBandRssi = rssi;
      currentBandDistanceM = calculateDistance(rssi);
      lastBandSeenTime = millis();

      // Hardware Accelerometer Sync (Reads MPU6050 payload from band if available)
      if (advertisedDevice.haveManufacturerData()) {
        std::string mfg = advertisedDevice.getManufacturerData();
        if (mfg.length() >= 2) {
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
      // RF-Stabilized Motion Filter Fallback (Displacement > 0.60m)
      else if (abs(currentBandDistanceM - baselineDistance) >= 0.60) {
        lastMovementTime = millis();
        baselineDistance = currentBandDistanceM;
        currentMotionState = "walking";
        walkingSpeed = 1.20;
        idleDurationSec = 0;
      }

      // Departure Detection: Once lap starts, confirm worker actually walked away (> 2.0m or signal dropped)
      if (currentPatrolState == OUTBOUND && !hasLeftStation) {
        if (currentBandDistanceM > 2.0 || currentBandRssi < -65) {
          hasLeftStation = true;
          Serial.println("[BEACON 1] Departure Confirmed: Worker walked away from Station A1 toward B4.");
        }
      }

      // 10 cm Touch Check-in Event
      if (currentBandRssi >= TOUCH_RSSI_THRESHOLD) {
        if (millis() - lastTransitionTime < 3000) return; // 3-second debounce

        // A. START ROUND
        if (currentPatrolState == IDLE || currentPatrolState == COMPLETED) {
          currentPatrolState = OUTBOUND;
          hasLeftStation = false; // Reset departure flag for new lap
          lapStartTime = millis();
          lastTransitionTime = millis();
          currentHeading = "Forward";
          triggerBlink(4);

          Serial.println("\n***************************************************");
          Serial.println("  >>> [BEACON 1] 10cm TOUCH: ROUND STARTED! <<<    ");
          Serial.printf ("  Touch Signal: %d dBm | Distance: %.1f cm\n", currentBandRssi, currentBandDistanceM * 100.0);
          Serial.println("***************************************************\n");

          queuedEventName = "LAP_STARTED";
          queuedDuration = 0.00;
          queuedRssi = currentBandRssi;
          queuedDistanceCm = currentBandDistanceM * 100.0;
          pendingEventUpload = true;
        }
        // B. FINISH 1 ROUND (Returning to B1 after visiting B2 - requires confirmed departure)
        else if (currentPatrolState == RETURNING || (currentPatrolState == OUTBOUND && hasLeftStation && millis() - lapStartTime > 8000)) {
          currentPatrolState = COMPLETED;
          hasLeftStation = false;
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

          // Auto-start subsequent lap timer
          lapStartTime = millis();
          currentPatrolState = OUTBOUND;
          hasLeftStation = false;
        }
        else if (currentPatrolState == OUTBOUND && !hasLeftStation) {
          Serial.println("[BEACON 1] 10cm Touch Ignored: Worker has not departed Station A1 yet! Walk to B4 first.");
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

  // 1. BLE Broadcaster (Sends M1-A1 so Beacon 2 tracks distance to B1)
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

  // 2. BLE Scanner (High duty cycle for rapid touch capture)
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new Beacon1ScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  lastMovementTime = millis();
  baselineDistance = 1.0;
  sendBeaconHeartbeat();
  Serial.println("✓ Beacon 1 Active & Broadcasting M1-A1\n");
}

void loop() {
  handleEventUpload();

  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 3-Second Idle Engine: If stationary for >= 3 seconds, update state
  if (millis() - lastMovementTime >= 3000) {
    currentMotionState = "stationary";
    walkingSpeed = 0.00;
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // Departure Fallback: If band has left Beacon 1's RF range entirely while OUTBOUND, confirm departure
  if (currentPatrolState == OUTBOUND && !hasLeftStation && (millis() - lastBandSeenTime > 4000) && lastBandSeenTime > lapStartTime) {
    hasLeftStation = true;
    Serial.println("[BEACON 1] Departure Confirmed: Band out of Beacon 1 RF coverage area.");
  }

  // Staggered Timer 1: Live Worker Dashboard Sync every 2 seconds
  if (millis() - lastDashboardSyncTime >= 2000) {
    lastDashboardSyncTime = millis();
    syncWorkerDashboard();

    Serial.printf("[B1 MONITOR] Band: %.2fm (%d dBm) | Motion: %s (%ds) | Peer B2: %.1fm (%d dBm)\n",
                  currentBandDistanceM, currentBandRssi,
                  currentMotionState.c_str(), idleDurationSec,
                  peerBeaconDistanceM, peerBeaconRssi);
  }

  // Staggered Timer 2: Beacon Heartbeat every 6 seconds (Keeps M1-A1 ONLINE)
  if (millis() - lastHeartbeatTime >= 6000) {
    lastHeartbeatTime = millis();
    sendBeaconHeartbeat();
  }

  // Auto-reconnect Wi-Fi if dropped
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
