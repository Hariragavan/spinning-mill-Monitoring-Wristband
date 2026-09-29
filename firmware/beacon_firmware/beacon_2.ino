// ============================================================
// Patrol Beacon v2  -  ESP32 / ESP32-C3
// Beacon 2 Configuration
//
//   BEACON_ID: "M1-B4"
//   PEER_ID:   "M1-A1"
//   ZONE:      "Side B"
//   MACHINE:   "M1"
//
// What it does
//  - Advertises its own name so the other beacon can measure range to it
//  - Scans continuously (own task, duplicates ON) for WRISTBAND_01 and peer beacon
//  - NO accelerometer: walking / idle is estimated from how the band's RSSI changes
//    (RSSI moves by MOVE_DB or more = moving; no change for 3 s = idle)
//  - Median-of-3 RSSI filter + hysteresis + cooldown for the 10 cm touch
//  - Sends to Supabase:
//      beacons        heartbeat every 5 s (+ peer range)
//      workers        band moving / idle every 2 s (only while the band is heard)
//      telemetry_logs event = 'TOUCH' (database trigger computes half-round / heading)
//  - Optional: BOOT button resets the lap counters in the database
// ============================================================
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <math.h>

// ---------------- CONFIG ----------------
const char* WIFI_SSID    = "Redmi11T";
const char* WIFI_PASS    = "hari1234";
const char* SUPABASE_URL = "https://vldhjpvyphzxofmwqmys.supabase.co";   // no trailing slash
const char* SUPABASE_KEY = "sb_publishable_UxA-HekCjNWcPPBTmlbyJg_RVErZCmK";

const char* BEACON_ID    = "M1-B4";
const char* PEER_ID      = "M1-A1";
const char* ZONE         = "Side B";
const char* MACHINE_ID   = "M1";
const char* BAND_NAME    = "WRISTBAND_01";   // BLE name of the band
const char* BAND_DEVICE  = "WRISTBAND_01";   // workers.device_id

const int LED_PIN   = 2;     // -1 to disable   (ESP32-C3 boards: use your LED pin)
const int RESET_PIN = 0;     // -1 to disable   (BOOT button; ESP32-C3 uses GPIO 9)

// Touch detection: CALIBRATE with the Serial Monitor (see the [BAND] lines)
const int      TOUCH_ENTER_RSSI  = -45;   // filtered RSSI at/above this = touch (~10 cm)
const int      TOUCH_EXIT_RSSI   = -55;   // must drop to this before the next touch counts
const int      NEAR_RSSI         = -65;   // band is "near this beacon" (owns zone fields)
const uint32_t TOUCH_COOLDOWN_MS = 5000;

const float TX_POWER_1M = -59.0;          // RSSI of the band at 1 m (calibrate)
const float PATH_LOSS_N = 2.0;

// Motion estimate from RSSI (tune on real walking)
const float    MOVE_DB       = 4.0;    // RSSI change (dB) that counts as movement
const uint32_t IDLE_AFTER_MS = 3000;   // no movement for 3 s = idle

const uint32_t HEARTBEAT_MS    = 5000;
const uint32_t LIVE_MS         = 2000;
const uint32_t BAND_TIMEOUT_MS = 3000;
const uint32_t PEER_TIMEOUT_MS = 10000;
// =====================================================

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// ---- shared with the scan task ----
volatile uint32_t lastBandMs   = 0;
volatile uint8_t  bandMotion   = 0;
volatile uint8_t  bandIdleSec  = 0;
volatile int      bandRssi     = -100;   // filtered
volatile bool     touched      = false;
volatile bool     touchPending = false;
volatile int      touchRssi    = 0;
volatile float    touchDistCm  = 0;
volatile uint32_t lastTouchMs  = 0;

volatile int      peerRssi     = -100;
volatile uint32_t lastPeerMs   = 0;

int rb[3]; int rbCount = 0; int rbIdx = 0;

// motion estimator (only touched inside the scan callback)
float    emaRssi = -100;
int      baseRssi = -100;
uint32_t lastMoveMs = 0;

int median3(int a, int b, int c) {
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

float distCm(int rssi) {
  return 100.0f * powf(10.0f, (TX_POWER_1M - rssi) / (10.0f * PATH_LOSS_N));
}

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveName()) return;
    int rssi = dev.getRSSI();
    uint32_t now = millis();

    // ---- other beacon: range between the two beacons ----
    if (dev.getName() == PEER_ID) {
      portENTER_CRITICAL(&mux);
      if (now - lastPeerMs > PEER_TIMEOUT_MS) peerRssi = rssi;
      else peerRssi = (peerRssi * 3 + rssi) / 4;
      lastPeerMs = now;
      portEXIT_CRITICAL(&mux);
      return;
    }

    // ---- the wristband ----
    if (!(dev.getName() == BAND_NAME)) return;

    portENTER_CRITICAL(&mux);
    bool stale = (now - lastBandMs > 2000);
    if (stale) rbCount = 0;
    rb[rbIdx] = rssi;
    rbIdx = (rbIdx + 1) % 3;
    if (rbCount < 3) rbCount++;

    lastBandMs = now;

    // ---- walking / idle from RSSI change ----
    if (stale) {                       // band just (re)appeared: start fresh
      emaRssi = rssi; baseRssi = rssi; lastMoveMs = now;
    } else {
      emaRssi = 0.5f * emaRssi + 0.5f * rssi;
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

    if (rbCount >= 3) {
      int f = median3(rb[0], rb[1], rb[2]);
      bandRssi = f;
      if (!touched && f >= TOUCH_ENTER_RSSI && (now - lastTouchMs) > TOUCH_COOLDOWN_MS) {
        touched = true;
        lastTouchMs = now;
        touchPending = true;
        touchRssi = f;
        touchDistCm = distCm(f);
      } else if (touched && f <= TOUCH_EXIT_RSSI) {
        touched = false;
      }
    }
    portEXIT_CRITICAL(&mux);
  }
};

BLEScan* pScan;

void scanTask(void*) {
  for (;;) {
    pScan->start(1, false);
    pScan->clearResults();
    vTaskDelay(5 / portTICK_PERIOD_MS);
  }
}

// ---------------- Supabase ----------------
WiFiClientSecure secureClient;

bool sendJson(const char* method, const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/" + path);
  http.setReuse(true);
  http.setTimeout(5000);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");
  int code = http.sendRequest(method, body);
  http.end();
  secureClient.stop(); // Clean TLS buffer release
  if (code < 200 || code >= 300) {
    Serial.printf("[HTTP] %s %s -> %d\n", method, path.c_str(), code);
    return false;
  }
  return true;
}

void sendHeartbeat() {
  int pr; uint32_t pm;
  portENTER_CRITICAL(&mux); pr = peerRssi; pm = lastPeerMs; portEXIT_CRITICAL(&mux);

  char body[220];
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
  Serial.printf("[HB] %s\n", ok ? "ok" : "FAILED");
}

void sendLiveState() {
  uint32_t heard; uint8_t motion, idle; int f;
  portENTER_CRITICAL(&mux);
  heard = lastBandMs; motion = bandMotion; idle = bandIdleSec; f = bandRssi;
  portEXIT_CRITICAL(&mux);
  if (heard == 0 || millis() - heard > BAND_TIMEOUT_MS) return;   // not heard: stay silent

  char body[380];
  int n = snprintf(body, sizeof(body),
    "{\"band_status\":\"online\",\"motion_state\":\"%s\",\"idle_duration_sec\":%u,"
    "\"walking_speed_ms\":%.2f,\"beacon_battery_pct\":100",
    motion ? "walking" : "stationary", idle, motion ? 1.20 : 0.00);

  // only claim zone / last beacon when the band is near THIS beacon
  if (f >= NEAR_RSSI) {
    snprintf(body + n, sizeof(body) - n,
      ",\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"current_machine\":\"%s\","
      "\"beacon_rssi\":%d}", ZONE, BEACON_ID, MACHINE_ID, f);
  } else {
    snprintf(body + n, sizeof(body) - n, "}");
  }
  bool ok = sendJson("PATCH", String("workers?device_id=eq.") + BAND_DEVICE, String(body));
  Serial.printf("[LIVE] %s idle=%us rssi=%d -> %s\n", motion ? "walking" : "stationary", idle, f, ok ? "ok" : "FAILED");
}

void sendTouch(int rssi, float cm) {
  char body[300];
  snprintf(body, sizeof(body),
    "{\"station_id\":\"%s\",\"target_device\":\"%s\",\"event\":\"TOUCH\","
    "\"signal_rssi\":%d,\"est_distance_cm\":%.2f,\"uptime_ms\":%lu}",
    BEACON_ID, BAND_DEVICE, rssi, cm, (unsigned long)millis());
  bool ok = sendJson("POST", "telemetry_logs", String(body));
  Serial.printf("[TOUCH] rssi=%d ~%.1fcm -> %s\n", rssi, cm, ok ? "ok" : "FAILED");
}

void resetLaps() {
  bool ok = sendJson("PATCH", String("workers?device_id=eq.") + BAND_DEVICE,
    "{\"lap_count\":0,\"lap_duration_sec\":0,\"lap_started_at\":null,\"half_round_done\":false,"
    "\"directional_heading\":\"Stationary\"}");
  Serial.printf("[RESET] laps reset -> %s\n", ok ? "ok" : "FAILED");
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("[WiFi] connecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(250);
  if (WiFi.status() == WL_CONNECTED) Serial.println("[WiFi] connected");
}

uint32_t lastBeat = 0, lastLive = 0, lastDebug = 0, ledOffAt = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  if (LED_PIN >= 0) { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
  if (RESET_PIN >= 0) pinMode(RESET_PIN, INPUT_PULLUP);
  Serial.printf("Beacon %s starting (peer %s)\n", BEACON_ID, PEER_ID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  secureClient.setInsecure();          // prototype only
  ensureWifi();

  BLEDevice::init(BEACON_ID);
  BLEDevice::setPower(ESP_PWR_LVL_P3);

  // advertise our own name so the other beacon can measure range to us
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  BLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setName(BEACON_ID);
  adv->setAdvertisementData(ad);
  adv->setMinInterval(160);
  adv->setMaxInterval(160);
  BLEDevice::startAdvertising();

  pScan = BLEDevice::getScan();
  pScan->setAdvertisedDeviceCallbacks(new ScanCallback(), true);   // true = every advert
  pScan->setActiveScan(true);
  pScan->setInterval(100);
  pScan->setWindow(90);
  xTaskCreate(scanTask, "scan", 8192, nullptr, 1, nullptr);

  sendHeartbeat();
  lastBeat = millis();
  lastLive = millis() + 1000;          // stagger the two timers
}

void loop() {
  ensureWifi();
  uint32_t now = millis();

  if (touchPending) {                  // touches first
    int r; float d;
    portENTER_CRITICAL(&mux);
    touchPending = false; r = touchRssi; d = touchDistCm;
    portEXIT_CRITICAL(&mux);
    if (LED_PIN >= 0) { digitalWrite(LED_PIN, HIGH); ledOffAt = now + 400; }
    sendTouch(r, d);
  }
  if (LED_PIN >= 0 && ledOffAt && now >= ledOffAt) { digitalWrite(LED_PIN, LOW); ledOffAt = 0; }

  if (touched && lastBandMs != 0 && now - lastBandMs > BAND_TIMEOUT_MS) {
    portENTER_CRITICAL(&mux); touched = false; portEXIT_CRITICAL(&mux);
  }

  if (now - lastBeat >= HEARTBEAT_MS) { lastBeat = now; sendHeartbeat(); }
  if (now - lastLive >= LIVE_MS)      { lastLive = now; sendLiveState(); }

  if (RESET_PIN >= 0 && digitalRead(RESET_PIN) == LOW) {
    delay(50);
    if (digitalRead(RESET_PIN) == LOW) {
      resetLaps();
      while (digitalRead(RESET_PIN) == LOW) delay(10);
    }
  }

  if (now - lastDebug >= 500) {
    lastDebug = now;
    bool heard = lastBandMs != 0 && now - lastBandMs < BAND_TIMEOUT_MS;
    bool peer  = lastPeerMs != 0 && now - lastPeerMs < PEER_TIMEOUT_MS;
    Serial.printf("[BAND] %s rssi=%d touched=%d | [PEER %s] %s rssi=%d\n",
      heard ? "heard" : "NOT heard", (int)bandRssi, (int)touched,
      PEER_ID, peer ? "heard" : "NOT heard", (int)peerRssi);
  }
  delay(20);
}
