// ============================================================
// Patrol Station Firmware - FINAL  -  ESP32 DevKit / ESP32-C3
// Station 2: Midpoint Station (M1-B4)
//
// Change ONLY the block marked CONFIG between Station 1 & 2:
//   Station 1:  STATION_ID "M1-A1" | PEER_ID "M1-B4" | ZONE "Side A"
//               SHOW_CM true | STAGGER_MS 0
//   Station 2:  STATION_ID "M1-B4" | PEER_ID "M1-A1" | ZONE "Side B"
//               SHOW_CM false | STAGGER_MS 2500
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
const char* SUPABASE_URL  = "YOUR_SUPABASE_URL"; // No trailing slash
const char* SUPABASE_KEY  = "YOUR_SUPABASE_ANON_KEY";

// ---- STATION 2 (MIDPOINT STATION) ----
const char*    STATION_ID = "M1-B4";      // Station 2: "M1-B4"  | Station 1: "M1-A1"
const char*    PEER_ID    = "M1-A1";      // Station 2: "M1-A1"  | Station 1: "M1-B4"
const char*    ZONE       = "Side B";     // Station 2: "Side B" | Station 1: "Side A"
const bool     SHOW_CM    = false;        // Station 2: false (m only) | Station 1: true (m+cm)
const uint32_t STAGGER_MS = 2500;         // Station 2: 2500 | Station 1: 0
// --------------------------------------------------

const char* MACHINE_ID    = "M1";
const char* WORKER_NAME   = "WRISTBAND_01";   // BLE name the worker's band advertises
const char* WORKER_DEVICE = "WRISTBAND_01";   // workers.device_id in Supabase

const int LED_PIN   = 2;     // -1 to disable   (ESP32-C3 SuperMini: GPIO 8)
const int RESET_PIN = -1;    // -1 to disable   (BOOT button: GPIO 0 on DevKit, GPIO 9 on ESP32-C3)

// ---- 1.5 m touch zone ----
// TX_POWER_1M is the RSSI YOUR wristband measures at exactly 1 m, at its
// transmit power. -50 was measured for this band at +9 dBm TX power.
const float TX_POWER_1M = -50.0;
const float PATH_LOSS_N = 2.0;

// Below computed from the formula for ~1.5 m with TX_POWER_1M=-50.
const int      TOUCH_ENTER_RSSI  = -54;   // filtered RSSI >= this = inside ~1.5 m
const int      TOUCH_EXIT_RSSI   = -60;   // must drop to this (~2 m) before touch clears
const uint32_t TOUCH_CONFIRM_MS  = 400;   // must stay inside the zone this long to confirm
const uint32_t TOUCH_COOLDOWN_MS = 5000;  // this station won't count another touch for this long
const int      NEAR_RSSI         = TOUCH_ENTER_RSSI;  // live-state reporting = same ~1.5 m zone

// Motion estimate from RSSI (tune on real walking)
const float    MOVE_DB       = 4.0;    // RSSI change (dB) that counts as movement
const uint32_t IDLE_AFTER_MS = 5000;   // worker stays in the same place this long = idle

const uint32_t HEARTBEAT_MS      = 5000;
const uint32_t LIVE_MS           = 2000;
const uint32_t WORKER_TIMEOUT_MS = 3000;
const uint32_t PEER_TIMEOUT_MS   = 10000;
const uint32_t MIN_REQUEST_GAP_MS = 2000;  // never start two requests from THIS station closer than this
// =====================================================

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// ---- shared with the scan task ----
volatile uint32_t lastWorkerMs  = 0;
volatile uint8_t  workerMotion  = 0;
volatile uint8_t  workerIdleSec = 0;
volatile int      workerRssi    = -100;
volatile bool     touched       = false;
volatile uint32_t touchEnterMs  = 0;
volatile bool     touchPending  = false;
volatile int      touchRssi     = 0;
volatile float    touchDistCm   = 0;
volatile uint32_t lastTouchMs   = 0;

volatile int      peerRssi      = -100;
volatile uint32_t lastPeerMs    = 0;

int rb[3]; int rbCount = 0; int rbIdx = 0;
float    emaRssi = -100;
int      baseRssi = -100;
uint32_t lastMoveMs = 0;

BLEScan* pScan;
volatile bool netBusy = false;   // true while an HTTP request is in flight

int median3(int a, int b, int c) {
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

float distCm(int rssi) {
  if (rssi >= 0 || rssi <= -100) return 999.0f;   // no real reading yet
  return 100.0f * powf(10.0f, (TX_POWER_1M - (float)rssi) / (10.0f * PATH_LOSS_N));
}

// e.g. "1.42m (142cm)", or "1.42m" when SHOW_CM is false
String fmtDist(int rssi) {
  if (rssi >= 0 || rssi <= -100) return String("---");
  float m = distCm(rssi) / 100.0f;
  char buf[32];
  if (SHOW_CM) snprintf(buf, sizeof(buf), "%.2fm (%.0fcm)", m, m * 100.0f);
  else         snprintf(buf, sizeof(buf), "%.2fm", m);
  return String(buf);
}

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveName()) return;
    int rssi = dev.getRSSI();
    uint32_t now = millis();

    // ---- the other station: range between the two stations ----
    if (dev.getName() == PEER_ID) {
      portENTER_CRITICAL(&mux);
      if (now - lastPeerMs > PEER_TIMEOUT_MS) peerRssi = rssi;
      else peerRssi = (peerRssi * 3 + rssi) / 4;   // light smoothing
      lastPeerMs = now;
      portEXIT_CRITICAL(&mux);
      return;
    }

    // ---- the worker's wristband ----
    if (dev.getName() != WORKER_NAME) return;

    portENTER_CRITICAL(&mux);
    bool stale = (now - lastWorkerMs > 2000);
    if (stale) rbCount = 0;
    rb[rbIdx] = rssi;
    rbIdx = (rbIdx + 1) % 3;
    if (rbCount < 3) rbCount++;
    lastWorkerMs = now;

    // ---- walking / idle from RSSI change ----
    if (stale) {                       // worker just (re)appeared: start fresh
      emaRssi = (float)rssi; baseRssi = rssi; lastMoveMs = now;
    } else {
      emaRssi = 0.5f * emaRssi + 0.5f * (float)rssi;
      if (fabsf(emaRssi - (float)baseRssi) >= MOVE_DB) {
        baseRssi = (int)emaRssi;
        lastMoveMs = now;
      }
    }
    if (now - lastMoveMs < IDLE_AFTER_MS) {
      workerMotion = 1;
      workerIdleSec = 0;
    } else {
      workerMotion = 0;
      uint32_t sec = (now - lastMoveMs) / 1000;
      workerIdleSec = sec > 255 ? 255 : (uint8_t)sec;
    }

    // ---- ~1.5 m touch zone: must stay inside it for TOUCH_CONFIRM_MS ----
    if (rbCount >= 3) {
      int f = median3(rb[0], rb[1], rb[2]);
      workerRssi = f;

      if (!touched) {
        if (f >= TOUCH_ENTER_RSSI) {
          if (touchEnterMs == 0) touchEnterMs = now;   // just entered the zone
          if (now - touchEnterMs >= TOUCH_CONFIRM_MS && (now - lastTouchMs) > TOUCH_COOLDOWN_MS) {
            touched = true;
            lastTouchMs = now;
            touchPending = true;
            touchRssi = f;
            touchDistCm = distCm(f);
            touchEnterMs = 0;
          }
        } else {
          touchEnterMs = 0;             // left the zone before it was confirmed: reset
        }
      } else if (f <= TOUCH_EXIT_RSSI) {
        touched = false;
      }
    }
    portEXIT_CRITICAL(&mux);
  }
};

// Near-continuous background scan at a 50% radio duty cycle (set via
// setInterval/setWindow below), with a tiny yield between 1-second scan
// calls. Pausing it (netBusy) hands the radio to Wi-Fi during a request.
void scanTask(void*) {
  for (;;) {
    if (!netBusy) {
      pScan->start(1, false);
      pScan->clearResults();
      vTaskDelay(40 / portTICK_PERIOD_MS);
    } else {
      vTaskDelay(100 / portTICK_PERIOD_MS);
    }
  }
}

// ---------------- Supabase ----------------
// A fresh WiFiClientSecure per request (reusing one caused permanent -1
// failures once the server closed its end of a previous connection).
bool sendJson(const char* method, const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] aborted: Wi-Fi offline");
    return false;
  }

  netBusy = true;
  if (pScan != nullptr) pScan->stop();   // free the radio before TLS needs it
  delay(50);                             // let the radio actually switch over

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(4000);

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/" + path);
  http.setTimeout(4000);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  int code = http.sendRequest(method, body);
  String errStr = (code < 0) ? http.errorToString(code) : "OK";
  http.end();
  client.stop();
  netBusy = false;

  if (code < 200 || code >= 300) {
    Serial.printf("[HTTP] %s %s -> %d (%s) | free heap %u\n",
                  method, path.c_str(), code, errStr.c_str(), ESP.getFreeHeap());
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
  bool ok = sendJson("PATCH", String("beacons?beacon_id=eq.") + STATION_ID, String(body));
  Serial.printf("[%s HB] -> %s\n", STATION_ID, ok ? "ok" : "FAILED");
}

void sendLiveState() {
  uint32_t heard; uint8_t motion, idle; int f;
  portENTER_CRITICAL(&mux);
  heard = lastWorkerMs; motion = workerMotion; idle = workerIdleSec; f = workerRssi;
  portEXIT_CRITICAL(&mux);
  if (heard == 0 || millis() - heard > WORKER_TIMEOUT_MS) return;   // not heard at all: stay silent
  if (f < NEAR_RSSI) return;   // outside this station's ~1.5 m zone: nothing to report

  char body[380];
  snprintf(body, sizeof(body),
    "{\"band_status\":\"online\",\"motion_state\":\"%s\",\"idle_duration_sec\":%u,"
    "\"walking_speed_ms\":%.2f,\"beacon_battery_pct\":100,"
    "\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"current_machine\":\"%s\","
    "\"beacon_rssi\":%d}",
    motion ? "walking" : "stationary", idle, motion ? 1.20 : 0.00,
    ZONE, STATION_ID, MACHINE_ID, f);

  bool ok = sendJson("PATCH", String("workers?device_id=eq.") + WORKER_DEVICE, String(body));
  Serial.printf("[%s LIVE] %s (idle %us) dist=%s -> %s\n",
    STATION_ID, motion ? "walking" : "stationary", idle, fmtDist(f).c_str(), ok ? "ok" : "FAILED");
}

bool sendTouch(int rssi, float cm) {
  char body[300];
  // Only ever sends 'TOUCH' - the Supabase trigger decides what it means
  snprintf(body, sizeof(body),
    "{\"station_id\":\"%s\",\"target_device\":\"%s\",\"event\":\"TOUCH\","
    "\"signal_rssi\":%d,\"est_distance_cm\":%.2f,\"uptime_ms\":%lu}",
    STATION_ID, WORKER_DEVICE, rssi, cm, (unsigned long)millis());
  bool ok = sendJson("POST", "telemetry_logs", String(body));
  Serial.printf("[TOUCH] dist=%s -> %s\n", fmtDist(rssi).c_str(), ok ? "ok" : "FAILED");
  return ok;
}

// A touch marks a round / half-round - worth retrying rather than silently
// losing it. Jittered delay so two stations' retries don't keep colliding
// on a shared hotspot.
void sendTouchWithRetry(int rssi, float cm) {
  for (int attempt = 1; attempt <= 3; attempt++) {
    if (sendTouch(rssi, cm)) return;
    if (attempt < 3) {
      uint32_t wait = 400 + random(300);
      Serial.printf("[TOUCH] retry %d/3 in %ums...\n", attempt + 1, wait);
      delay(wait);
    }
  }
  Serial.println("[TOUCH] gave up after 3 attempts - this touch was NOT recorded");
}

void resetLaps() {
  bool ok = sendJson("PATCH", String("workers?device_id=eq.") + WORKER_DEVICE,
    "{\"lap_count\":0,\"lap_duration_sec\":0,\"lap_started_at\":null,\"half_round_done\":false,"
    "\"directional_heading\":\"Stationary\"}");
  Serial.printf("[RESET] laps reset in database -> %s\n", ok ? "ok" : "FAILED");
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("[WiFi] connecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" connected! IP: %s (signal %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println(" failed - check hotspot");
  }
}

uint32_t lastBeat = 0, lastLive = 0, lastDebug = 0, ledOffAt = 0;
uint32_t lastRequestMs = 0;

void setup() {
  Serial.begin(115200);
  delay(400);
  randomSeed(esp_random());
  if (LED_PIN >= 0) { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
  if (RESET_PIN >= 0) pinMode(RESET_PIN, INPUT_PULLUP);
  Serial.printf("\nStation %s starting (peer %s)\n", STATION_ID, PEER_ID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);          // power-saving can stall a TLS handshake mid-request
  ensureWifi();

  BLEDevice::init(STATION_ID);
  BLEDevice::setPower(ESP_PWR_LVL_P9);   // stations may be several meters apart - keep this high

  // advertise our own name so the other station can measure range to us
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  BLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setName(STATION_ID);
  adv->setAdvertisementData(ad);
  adv->setMinInterval(160);
  adv->setMaxInterval(160);
  BLEDevice::startAdvertising();

  // 50% scan duty cycle (160ms interval, 80ms window): keeps airtime free for Wi-Fi
  pScan = BLEDevice::getScan();
  pScan->setAdvertisedDeviceCallbacks(new ScanCallback(), true);   // true = every advert
  pScan->setActiveScan(true);
  pScan->setInterval(160);
  pScan->setWindow(80);
  xTaskCreate(scanTask, "scan", 8192, nullptr, 1, nullptr);

  delay(STAGGER_MS);             // keep both stations from hitting Supabase at the same instant
  sendHeartbeat();
  lastBeat = millis();
  lastLive = millis() + 1000;    // stagger heartbeat vs live within this one station
  lastRequestMs = millis();
}

void loop() {
  ensureWifi();
  uint32_t now = millis();

  if (touchPending) {            // touches jump the queue: a round/half-round matters most
    int r; float d;
    portENTER_CRITICAL(&mux);
    touchPending = false; r = touchRssi; d = touchDistCm;
    portEXIT_CRITICAL(&mux);
    if (LED_PIN >= 0) { digitalWrite(LED_PIN, HIGH); ledOffAt = now + 400; }
    sendTouchWithRetry(r, d);
    lastRequestMs = millis();
  }
  if (LED_PIN >= 0 && ledOffAt && now >= ledOffAt) { digitalWrite(LED_PIN, LOW); ledOffAt = 0; }

  if (touched && lastWorkerMs != 0 && now - lastWorkerMs > WORKER_TIMEOUT_MS) {
    portENTER_CRITICAL(&mux); touched = false; portEXIT_CRITICAL(&mux);
  }

  bool canSend = (now - lastRequestMs) >= MIN_REQUEST_GAP_MS;
  if (canSend && now - lastBeat >= HEARTBEAT_MS) {
    lastBeat = now; sendHeartbeat(); lastRequestMs = millis();
  } else if (canSend && now - lastLive >= LIVE_MS) {
    lastLive = now; sendLiveState(); lastRequestMs = millis();
  }

  // Safe Debounce for Reset Button (if enabled)
  if (RESET_PIN >= 0 && digitalRead(RESET_PIN) == LOW) {
    uint32_t pressStart = millis();
    while (digitalRead(RESET_PIN) == LOW && (millis() - pressStart < 2500)) {
      delay(50);
    }
    if (digitalRead(RESET_PIN) == LOW && (millis() - pressStart >= 2500)) {
      resetLaps();
      while (digitalRead(RESET_PIN) == LOW) delay(10);
    }
  }

  if (now - lastDebug >= 500) {
    lastDebug = now;
    bool heard = lastWorkerMs != 0 && now - lastWorkerMs < WORKER_TIMEOUT_MS;
    bool peer  = lastPeerMs != 0 && now - lastPeerMs < PEER_TIMEOUT_MS;
    Serial.printf("[WORKER] %s dist=%s touched=%d | [STATION %s] %s dist=%s\n",
      heard ? "heard" : "NOT heard", fmtDist((int)workerRssi).c_str(), (int)touched,
      PEER_ID, peer ? "heard" : "LOST (out of range)", fmtDist((int)peerRssi).c_str());
  }
  delay(20);
}
