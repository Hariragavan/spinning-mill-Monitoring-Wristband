// ============================================================
// Universal Patrol Beacon Firmware (ESP32 / ESP32-C3)
// Station 2: Midpoint Station (M1-B4)
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <math.h>

// ======================= CONFIG =======================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL  = "YOUR_SUPABASE_URL"; 
const char* SUPABASE_KEY  = "YOUR_SUPABASE_ANON_KEY";

// ---- BEACON 2 (MIDPOINT STATION) ----
const char* BEACON_ID       = "M1-B4";      // Midpoint Checkpoint
const char* PEER_ID         = "M1-A1";      // Gateway Peer Beacon
const char* ZONE            = "Side B";
const bool  IS_GATE_STATION = false;        // true for M1-A1 (Gate), false for M1-B4 (Midpoint)
// -------------------------------------

const char* MACHINE_ID   = "M1";
const char* BAND_NAME    = "WRISTBAND_01";
const char* BAND_DEVICE  = "WRISTBAND_01";
const char* WORKER_ID    = "worker_1";

const int LED_PIN   = 2;  // Onboard LED pin (use GPIO 8 on ESP32-C3 SuperMini)
const int RESET_PIN = 0;  // BOOT button for manual resets

// Calibrated Touch Thresholds
const int      TOUCH_ENTER_RSSI  = -38;    // Proximity touch threshold (~10 cm)
const int      TOUCH_EXIT_RSSI   = -55;    // Hysteresis release threshold
const int      NEAR_RSSI         = -65;    // Zone claim threshold
const uint32_t TOUCH_COOLDOWN_MS = 3500;   // Debounce window

const float TX_POWER_1M = -59.0;
const float PATH_LOSS_N = 2.0;

// Motion Detection via Signal Delta
const float    MOVE_DB      = 4.0;
const uint32_t IDLE_AFTER_MS= 3000;       // 3 seconds without displacement = stationary

const uint32_t HEARTBEAT_MS    = 5000;
const uint32_t LIVE_MS         = 2000;
const uint32_t BAND_TIMEOUT_MS = 3500;
const uint32_t PEER_TIMEOUT_MS = 10000;
// =====================================================

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// Shared volatile states
volatile uint32_t lastBandMs    = 0;
volatile uint8_t  bandMotion    = 0;
volatile uint8_t  bandIdleSec   = 0;
volatile int      bandRssi      = -100;
volatile bool     touched       = false;
volatile bool     touchPending  = false;
volatile int      touchRssi     = 0;
volatile uint32_t lastTouchMs   = 0;

volatile int      peerRssi      = -100;
volatile uint32_t lastPeerMs    = 0;

int rb[3]; int rbCount = 0; int rbIdx = 0;
float emaRssi = -100;
int   baseRssi = -100;
uint32_t lastMoveMs = 0;

// Patrol cycle tracking (Gate station only)
int completedLaps = 0;
uint32_t lapStartMs = 0;
bool isOutbound = false;

BLEScan* pScan;
volatile bool netBusy = false;

int median3(int a, int b, int c) {
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

float distCm(int rssi) {
  if (rssi == 0) return -1.0f;
  return 100.0f * powf(10.0f, (TX_POWER_1M - (float)rssi) / (10.0f * PATH_LOSS_N));
}

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveName()) return;
    int rssi = dev.getRSSI();
    uint32_t now = millis();

    // 1. Inter-Beacon Link
    if (dev.getName() == PEER_ID) {
      portENTER_CRITICAL(&mux);
      if (now - lastPeerMs > PEER_TIMEOUT_MS) peerRssi = rssi;
      else peerRssi = (peerRssi * 3 + rssi) / 4;
      lastPeerMs = now;
      portEXIT_CRITICAL(&mux);
      return;
    }

    // 2. Wristband Tracking
    if (dev.getName() != BAND_NAME) return;

    portENTER_CRITICAL(&mux);
    bool stale = (now - lastBandMs > 2000);
    if (stale) rbCount = 0;
    rb[rbIdx] = rssi;
    rbIdx = (rbIdx + 1) % 3;
    if (rbCount < 3) rbCount++;
    lastBandMs = now;

    // Motion vs Stationary Filter
    if (stale) {
      emaRssi = rssi; baseRssi = rssi; lastMoveMs = now;
    } else {
      emaRssi = 0.5f * emaRssi + 0.5f * (float)rssi;
      if (fabsf(emaRssi - (float)baseRssi) >= MOVE_DB) {
        baseRssi = (int)emaRssi;
        lastMoveMs = now;
      }
    }

    if (now - lastMoveMs < IDLE_AFTER_MS) {
      bandMotion = 1;
      bandIdleSec = 0;
    } else {
      bandMotion = 0;
      uint32_t sec = (now - lastMoveMs) / 1000;
      bandIdleSec = sec > 255 ? 255 : (uint8_t)sec;
    }

    // Median Proximity Touch Evaluation
    if (rbCount >= 3) {
      int f = median3(rb[0], rb[1], rb[2]);
      bandRssi = f;

      if (!touched && f >= TOUCH_ENTER_RSSI && (now - lastTouchMs > TOUCH_COOLDOWN_MS)) {
        touched = true;
        lastTouchMs = now;
        touchPending = true;
        touchRssi = f;
      } else if (touched && f <= TOUCH_EXIT_RSSI) {
        touched = false;
      }
    }
    portEXIT_CRITICAL(&mux);
  }
};

// Safe HTTPS Client with TLS release
bool sendJson(const char* method, const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return false;

  netBusy = true;
  if (pScan != nullptr) pScan->stop(); // Halt BLE to free the radio antenna
  delay(15);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(2500);

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/" + path);
  http.setTimeout(2500);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  int code = http.sendRequest(method, body);
  http.end();
  client.stop(); // Free TLS heap buffers

  netBusy = false;
  return (code >= 200 && code < 300);
}

void sendHeartbeat() {
  int pr; uint32_t pm;
  portENTER_CRITICAL(&mux);
  pr = peerRssi; pm = lastPeerMs;
  portEXIT_CRITICAL(&mux);

  char body[250];
  if (pm != 0 && millis() - pm < PEER_TIMEOUT_MS) {
    snprintf(body, sizeof(body),
      "{\"status\":\"online\",\"battery_pct\":100,\"peer_beacon_id\":\"%s\","
      "\"peer_rssi\":%d,\"peer_distance_cm\":%.0f}", PEER_ID, pr, distCm(pr));
  } else {
    snprintf(body, sizeof(body),
      "{\"status\":\"online\",\"battery_pct\":100,\"peer_beacon_id\":\"%s\","
      "\"peer_rssi\":null,\"peer_distance_cm\":null}", PEER_ID);
  }

  bool ok = sendJson("PATCH", String("beacons?beacon_id=eq.") + BEACON_ID, String(body));
  Serial.printf("[%s HB] -> %s\n", BEACON_ID, ok ? "ok" : "FAIL");
}

void sendLiveState() {
  uint32_t heard; uint8_t motion, idle; int f;
  portENTER_CRITICAL(&mux);
  heard = lastBandMs; motion = bandMotion; idle = bandIdleSec; f = bandRssi;
  portEXIT_CRITICAL(&mux);

  // If band has not been heard recently, stay completely silent
  if (heard == 0 || millis() - heard > BAND_TIMEOUT_MS) return;

  // ARBITRATION: Only the beacon close to the band updates the dashboard
  if (f < NEAR_RSSI) return;

  char body[380];
  if (IS_GATE_STATION) {
    float liveDuration = 0.00;
    if (lapStartMs > 0 && isOutbound) {
      liveDuration = (millis() - lapStartMs) / 1000.0f;
    }
    snprintf(body, sizeof(body),
      "{\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"current_machine\":\"%s\","
      "\"beacon_rssi\":%d,\"motion_state\":\"%s\",\"idle_duration_sec\":%u,"
      "\"walking_speed_ms\":%.2f,\"shift_status\":\"active\",\"beacon_battery_pct\":100,"
      "\"lap_count\":%d,\"lap_duration_sec\":%.2f}",
      ZONE, BEACON_ID, MACHINE_ID, f,
      motion ? "walking" : "stationary", idle, motion ? 1.20 : 0.00,
      completedLaps, liveDuration);
  } else {
    // Beacon 2 (Midpoint): Omits lap_count and lap_duration_sec to avoid resetting the count
    snprintf(body, sizeof(body),
      "{\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"current_machine\":\"%s\","
      "\"beacon_rssi\":%d,\"motion_state\":\"%s\",\"idle_duration_sec\":%u,"
      "\"walking_speed_ms\":%.2f,\"shift_status\":\"active\",\"beacon_battery_pct\":100}",
      ZONE, BEACON_ID, MACHINE_ID, f,
      motion ? "walking" : "stationary", idle, motion ? 1.20 : 0.00);
  }

  bool ok = sendJson("PATCH", String("workers?worker_id=eq.") + WORKER_ID, String(body));
  Serial.printf("[%s LIVE] Motion: %s | Idle: %us | RSSI: %d -> %s\n",
                BEACON_ID, motion ? "walking" : "stationary", idle, f, ok ? "ok" : "FAIL");
}

void processTouch(int rssi) {
  float cm = distCm(rssi);
  String eventName = "TOUCH";
  float durationSec = 0.00;

  if (IS_GATE_STATION) {
    if (!isOutbound || lapStartMs == 0) {
      isOutbound = true;
      lapStartMs = millis();
      eventName = "LAP_STARTED";
      Serial.println("\n>>> [GATE A1] PATROL ROUND STARTED! <<<");
    } else if (isOutbound && (millis() - lapStartMs > 5000)) {
      durationSec = (millis() - lapStartMs) / 1000.0f;
      completedLaps++;
      eventName = "ROUND_COMPLETED";
      Serial.printf("\n>>> [GATE A1] ROUND COMPLETED! Duration: %.2fs | Total Laps: %d <<<\n",
                    durationSec, completedLaps);
      lapStartMs = millis();
    }
  } else {
    // MIDPOINT CHECKPOINT REACHED
    eventName = "HALF_ROUND_COMPLETED";
    Serial.println("\n>>> [CHECKPOINT B4] HALF-ROUND CHECKPOINT VISITED! <<<");
  }

  // 1. Insert into telemetry_logs
  char logBody[300];
  snprintf(logBody, sizeof(logBody),
    "{\"station_id\":\"%s\",\"target_device\":\"%s\",\"event\":\"%s\","
    "\"lap_duration_sec\":%.2f,\"signal_rssi\":%d,\"est_distance_cm\":%.2f,\"uptime_ms\":%lu}",
    BEACON_ID, BAND_DEVICE, eventName.c_str(), durationSec, rssi, cm, (unsigned long)millis());
  sendJson("POST", "telemetry_logs", String(logBody));

  // 2. Update directional heading and zone on the workers table (heading = Return, without resetting lap_count)
  char workerBody[250];
  if (IS_GATE_STATION) {
    snprintf(workerBody, sizeof(workerBody),
      "{\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"beacon_rssi\":%d,"
      "\"directional_heading\":\"%s\",\"lap_count\":%d,\"lap_duration_sec\":%.2f}",
      ZONE, BEACON_ID, rssi, "Forward", completedLaps, durationSec);
  } else {
    snprintf(workerBody, sizeof(workerBody),
      "{\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"beacon_rssi\":%d,"
      "\"directional_heading\":\"%s\"}",
      ZONE, BEACON_ID, rssi, "Return");
  }
  sendJson("PATCH", String("workers?worker_id=eq.") + WORKER_ID, String(workerBody));
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("[WiFi] Reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) delay(250);
  if (WiFi.status() == WL_CONNECTED) Serial.println(" Connected!");
}

uint32_t lastBeat = 0, lastLive = 0, lastDebug = 0;

void setup() {
  Serial.begin(115200);
  delay(300);

  if (LED_PIN >= 0) { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
  if (RESET_PIN >= 0) pinMode(RESET_PIN, INPUT_PULLUP);

  Serial.printf("\n--- Booting Beacon %s (Peer: %s) ---\n", BEACON_ID, PEER_ID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  ensureWifi();

  BLEDevice::init(BEACON_ID);
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  // Advertise identity for peer inter-beacon ranging
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  BLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setName(BEACON_ID);
  adv->setAdvertisementData(ad);
  adv->setMinInterval(160);
  adv->setMaxInterval(160);
  BLEDevice::startAdvertising();

  pScan = BLEDevice::getScan();
  pScan->setAdvertisedDeviceCallbacks(new ScanCallback(), true);
  pScan->setActiveScan(true);
  pScan->setInterval(100);
  pScan->setWindow(90);

  sendHeartbeat();

  // STAGGER NETWORK TIMERS TO PREVENT SIMULTANEOUS TRANSMISSIONS
  // Beacon 2 (B4) fires at 1200ms offset to avoid network collisions with Beacon 1
  uint32_t desyncOffset = IS_GATE_STATION ? 0 : 1200;
  lastBeat = millis() + desyncOffset;
  lastLive = millis() + desyncOffset + 600;
}

void loop() {
  ensureWifi();
  uint32_t now = millis();

  // 1. Process Checkpoint Proximity Touches
  if (touchPending) {
    int r;
    portENTER_CRITICAL(&mux);
    touchPending = false;
    r = touchRssi;
    portEXIT_CRITICAL(&mux);

    if (LED_PIN >= 0) {
      digitalWrite(LED_PIN, HIGH);
      delay(80);
      digitalWrite(LED_PIN, LOW);
    }
    processTouch(r);
  }

  // Release touch latch if the band departs or drops out of range
  if (touched && lastBandMs != 0 && (now - lastBandMs > BAND_TIMEOUT_MS)) {
    portENTER_CRITICAL(&mux); touched = false; portEXIT_CRITICAL(&mux);
  }

  // 2. Periodic Network Tasks
  if (now - lastBeat >= HEARTBEAT_MS) {
    lastBeat = now;
    sendHeartbeat();
  }

  if (now - lastLive >= LIVE_MS) {
    lastLive = now;
    sendLiveState();
  }

  // 3. Continuous Scan Slice
  if (!netBusy) {
    pScan->start(1, false);
    pScan->clearResults();
  }

  // 4. Physical BOOT Button Reset
  if (RESET_PIN >= 0 && digitalRead(RESET_PIN) == LOW) {
    delay(50);
    if (digitalRead(RESET_PIN) == LOW) {
      completedLaps = 0;
      lapStartMs = 0;
      isOutbound = false;
      Serial.println("\n[RESET] Patrol counters reset.");
      sendJson("PATCH", String("workers?worker_id=eq.") + WORKER_ID,
               "{\"lap_count\":0,\"lap_duration_sec\":0,\"directional_heading\":\"Stationary\"}");
      while (digitalRead(RESET_PIN) == LOW) delay(10);
    }
  }

  if (now - lastDebug >= 1500) {
    lastDebug = now;
    bool heard = (lastBandMs != 0 && now - lastBandMs < BAND_TIMEOUT_MS);
    bool peer  = (lastPeerMs != 0 && now - lastPeerMs < PEER_TIMEOUT_MS);
    Serial.printf("[STATUS] Band: %s (%d dBm) | Peer %s: %s (%d dBm)\n",
                  heard ? "HEARD" : "AWAY", (int)bandRssi,
                  PEER_ID, peer ? "LINKED" : "LOST", (int)peerRssi);
  }
}
