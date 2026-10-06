// ============================================================
// Patrol Station Firmware v10 (Custom Serial Monitor Format)
// Hardware: ESP32 DevKit / ESP32-C3
// Station 2: Midpoint Checkpoint (M1-B4)
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
const char* STATION_ID    = "M1-B4";      // Station 2: "M1-B4"
const char* PEER_ID       = "M1-A1";      // Station 1: "M1-A1"
const char* ZONE          = "Side B";     // Station 2: "Side B"
const bool  IS_GATE       = false;        // Station 2: false (Midpoint)
const uint32_t STAGGER_MS = 1500;         // Station 2: 1500ms stagger to prevent collision
// -------------------------------------------------

const char* MACHINE_ID    = "M1";
const char* WORKER_NAME   = "WRISTBAND_01";
const char* WORKER_DEVICE = "WRISTBAND_01";

const int LED_PIN   = 2;  // GPIO 8 on ESP32-C3 SuperMini
const int RESET_PIN = -1; // -1 to disable accidental resets. (Set to 0 on DevKit or 9 on C3 if physical button wired)

// 1-Metre Touch Calibration (Matched to Wristband @ +9 dBm)
const float TX_POWER_1M       = -50.0;    // Measured RSSI at 1 metre
const float PATH_LOSS_N       = 2.0;

const int      TOUCH_ENTER_RSSI  = -52;   // Filtered RSSI >= -52 dBm = inside 1 metre
const int      TOUCH_EXIT_RSSI   = -58;   // Exit release boundary (~1.8 metres)
const uint32_t TOUCH_COOLDOWN_MS = 5000;  // 5 seconds delay before next touch can count
const int      NEAR_RSSI         = -52;   // Strictly ~1 metre live reporting zone

// Motion Calculation
const float    MOVE_DB       = 4.0;
const uint32_t IDLE_AFTER_MS = 5000;      // 5 seconds stationary = idle

// System Timers
const uint32_t HEARTBEAT_MS      = 5000;
const uint32_t LIVE_MS           = 2000;
const uint32_t WORKER_TIMEOUT_MS = 3000;
const uint32_t PEER_TIMEOUT_MS   = 10000;
// =====================================================

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// Shared volatile states
volatile uint32_t lastWorkerMs  = 0;
volatile uint8_t  workerMotion  = 0;
volatile uint8_t  workerIdleSec = 0;
volatile int      workerRssi    = -100;
volatile bool     touched       = false;
volatile bool     touchPending  = false;
volatile int      touchRssi     = 0;
volatile float    touchDistCm   = 0;
volatile uint32_t lastTouchMs   = 0;

volatile int      peerRssi      = -100;
volatile uint32_t lastPeerMs    = 0;

int rb[3]; int rbCount = 0; int rbIdx = 0;
float emaRssi = -100;
int   baseRssi = -100;
uint32_t lastMoveMs = 0;

// Local round display toggle (Gate station only)
bool localRoundActive = false;

BLEScan* pScan;
volatile bool netBusy = false;

int median3(int a, int b, int c) {
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

float distCm(int rssi) {
  if (rssi >= 0 || rssi <= -100) return 999.0f;
  return 100.0f * powf(10.0f, (TX_POWER_1M - (float)rssi) / (10.0f * PATH_LOSS_N));
}

String getDistStr(int rssi) {
  if (rssi >= 0 || rssi <= -100) return String("---");
  float m = distCm(rssi) / 100.0f;
  char buf[32];
  snprintf(buf, sizeof(buf), "%.2fm (%.0fcm)", m, m * 100.0f);
  return String(buf);
}

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveName()) return;
    int rssi = dev.getRSSI();
    uint32_t now = millis();

    // 1. Peer station inter-beacon link
    if (dev.getName() == PEER_ID) {
      portENTER_CRITICAL(&mux);
      if (now - lastPeerMs > PEER_TIMEOUT_MS) peerRssi = rssi;
      else peerRssi = (peerRssi * 3 + rssi) / 4;
      lastPeerMs = now;
      portEXIT_CRITICAL(&mux);
      return;
    }

    // 2. Worker Wristband
    if (dev.getName() != WORKER_NAME) return;

    portENTER_CRITICAL(&mux);
    bool stale = (now - lastWorkerMs > 2000);
    if (stale) rbCount = 0;
    rb[rbIdx] = rssi;
    rbIdx = (rbIdx + 1) % 3;
    if (rbCount < 3) rbCount++;
    lastWorkerMs = now;

    // Movement evaluation
    if (stale) {
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

    // Zero-delay touch entry with 5-second cooldown lockout
    if (rbCount >= 3) {
      int f = median3(rb[0], rb[1], rb[2]);
      workerRssi = f;

      if (!touched) {
        if (f >= TOUCH_ENTER_RSSI && (now - lastTouchMs > TOUCH_COOLDOWN_MS)) {
          touched = true;
          lastTouchMs = now;
          touchPending = true;
          touchRssi = f;
          touchDistCm = distCm(f);
        }
      } else {
        if (f <= TOUCH_EXIT_RSSI && (now - lastTouchMs > TOUCH_COOLDOWN_MS)) {
          touched = false;
        }
      }
    }
    portEXIT_CRITICAL(&mux);
  }
};

// Continuous background scanner (50% duty cycle prevents Wi-Fi starvation)
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

// ---------------- Supabase HTTPS ----------------
bool sendJson(const char* method, const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Aborted: Wi-Fi offline");
    return false;
  }

  netBusy = true;
  if (pScan != nullptr) pScan->stop(); // Force stop scan to yield radio
  delay(50);                          // Radio synthesizer stabilization

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(6000);

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/" + path);
  http.setTimeout(6000);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  int code = http.sendRequest(method, body);
  String errStr = (code < 0) ? http.errorToString(code) : "OK";
  http.end();
  client.stop(); // Socket cleanup
  netBusy = false;

  if (code < 200 || code >= 300) {
    Serial.printf("[HTTP] %s %s -> %d (%s) | Free Heap: %u\n", 
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

  if (heard == 0 || millis() - heard > WORKER_TIMEOUT_MS) return;
  if (f < NEAR_RSSI) return;

  char body[380];
  snprintf(body, sizeof(body),
    "{\"band_status\":\"online\",\"motion_state\":\"%s\",\"idle_duration_sec\":%u,"
    "\"walking_speed_ms\":%.2f,\"beacon_battery_pct\":100,"
    "\"current_zone\":\"%s\",\"last_beacon_id\":\"%s\",\"current_machine\":\"%s\","
    "\"beacon_rssi\":%d}",
    motion ? "walking" : "stationary", idle, motion ? 1.20 : 0.00,
    ZONE, STATION_ID, MACHINE_ID, f);

  sendJson("PATCH", String("workers?device_id=eq.") + WORKER_DEVICE, String(body));
}

bool sendTouch(int rssi, float cm) {
  char body[300];
  snprintf(body, sizeof(body),
    "{\"station_id\":\"%s\",\"target_device\":\"%s\",\"event\":\"TOUCH\","
    "\"signal_rssi\":%d,\"est_distance_cm\":%.2f,\"uptime_ms\":%lu}",
    STATION_ID, WORKER_DEVICE, rssi, cm, (unsigned long)millis());
  bool ok = sendJson("POST", "telemetry_logs", String(body));
  Serial.printf("[DB SYNC] Event TOUCH recorded -> %s\n", ok ? "ok" : "FAILED");
  return ok;
}

void sendTouchWithRetry(int rssi, float cm) {
  for (int attempt = 1; attempt <= 3; attempt++) {
    if (sendTouch(rssi, cm)) return;
    if (attempt < 3) {
      Serial.printf("[TOUCH] retry %d/3 in 400ms...\n", attempt + 1);
      delay(400);
    }
  }
  Serial.println("[TOUCH] Failed after 3 attempts - event not recorded");
}

void resetLaps() {
  localRoundActive = false;
  bool ok = sendJson("PATCH", String("workers?device_id=eq.") + WORKER_DEVICE,
    "{\"lap_count\":0,\"lap_duration_sec\":0,\"lap_started_at\":null,\"half_round_done\":false,"
    "\"directional_heading\":\"Stationary\"}");
  Serial.printf("[RESET] Laps reset in database -> %s\n", ok ? "ok" : "FAILED");
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("[WiFi] Connecting to hotspot...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 12000) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" Connected! IP: %s (Signal: %d dBm)\n", 
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println(" Failed! Check hotspot.");
  }
}

uint32_t lastBeat = 0, lastLive = 0, lastDebug = 0, ledOffAt = 0;
uint32_t lastRequestMs = 0;
const uint32_t MIN_REQUEST_GAP_MS = 1500;

void setup() {
  Serial.begin(115200);
  delay(400);
  if (LED_PIN >= 0) { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
  if (RESET_PIN >= 0) pinMode(RESET_PIN, INPUT_PULLUP);
  Serial.printf("\nStation %s Starting (Peer: %s)\n", STATION_ID, PEER_ID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  ensureWifi();

  BLEDevice::init(STATION_ID);
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  // BLE Broadcast
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  BLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setName(STATION_ID);
  adv->setAdvertisementData(ad);
  adv->setMinInterval(160);
  adv->setMaxInterval(160);
  BLEDevice::startAdvertising();

  // BLE Scanner
  pScan = BLEDevice::getScan();
  pScan->setAdvertisedDeviceCallbacks(new ScanCallback(), true);
  pScan->setActiveScan(true);
  pScan->setInterval(160);
  pScan->setWindow(80);
  xTaskCreate(scanTask, "scan", 8192, nullptr, 1, nullptr);

  delay(STAGGER_MS);
  sendHeartbeat();
  lastBeat = millis();
  lastLive = millis() + 1000;
  lastRequestMs = millis();
}

void loop() {
  ensureWifi();
  uint32_t now = millis();

  // 1. Process Instant 1-Metre Touch Events
  if (touchPending) {
    int r; float d;
    portENTER_CRITICAL(&mux);
    touchPending = false;
    r = touchRssi; d = touchDistCm;
    portEXIT_CRITICAL(&mux);

    if (LED_PIN >= 0) { digitalWrite(LED_PIN, HIGH); ledOffAt = now + 400; }

    // Custom Serial Output on Touch
    if (IS_GATE) {
      if (!localRoundActive) {
        localRoundActive = true;
        Serial.println("\n*******************************************************");
        Serial.printf ("  >>> [w1] TOUCH DETECTED (dist = %s) -> ROUND STARTED <<<\n", getDistStr(r).c_str());
        Serial.println("*******************************************************\n");
      } else {
        localRoundActive = false;
        Serial.println("\n********************************************************");
        Serial.printf ("  >>> [w1] TOUCH DETECTED (dist = %s) -> ROUND FINISHED <<<\n", getDistStr(r).c_str());
        Serial.println("********************************************************\n");
      }
    } else {
      Serial.println("\n**************************************************************");
      Serial.printf ("  >>> [w1] TOUCH DETECTED (dist = %s) -> HALF ROUND COMPLETED <<<\n", getDistStr(r).c_str());
      Serial.println("**************************************************************\n");
    }

    sendTouchWithRetry(r, d);
    lastRequestMs = millis();
  }
  if (LED_PIN >= 0 && ledOffAt && now >= ledOffAt) { digitalWrite(LED_PIN, LOW); ledOffAt = 0; }

  // Clear touch flag if worker walks completely out of range
  if (touched && lastWorkerMs != 0 && now - lastWorkerMs > WORKER_TIMEOUT_MS) {
    portENTER_CRITICAL(&mux); touched = false; portEXIT_CRITICAL(&mux);
  }

  // 2. Periodic Network Tasks
  bool canSend = (now - lastRequestMs) >= MIN_REQUEST_GAP_MS;
  if (canSend && now - lastBeat >= HEARTBEAT_MS) {
    lastBeat = now; sendHeartbeat(); lastRequestMs = millis();
  } else if (canSend && now - lastLive >= LIVE_MS) {
    lastLive = now; sendLiveState(); lastRequestMs = millis();
  }

  // 3. Physical Reset Button (Safe Debounce: 2.5s Long Press required if pin configured)
  if (RESET_PIN >= 0 && digitalRead(RESET_PIN) == LOW) {
    uint32_t pressStart = millis();
    while (digitalRead(RESET_PIN) == LOW && (millis() - pressStart < 2500)) {
      delay(50);
    }
    if (digitalRead(RESET_PIN) == LOW && (millis() - pressStart >= 2500)) {
      Serial.println("[RESET] Long press detected. Resetting laps...");
      resetLaps();
      while (digitalRead(RESET_PIN) == LOW) delay(20);
    }
  }

  // 4. Custom Serial Monitor Diagnostics
  if (now - lastDebug >= 500) {
    lastDebug = now;
    bool wHeard = (lastWorkerMs != 0 && now - lastWorkerMs < WORKER_TIMEOUT_MS);
    bool pHeard = (lastPeerMs != 0 && now - lastPeerMs < PEER_TIMEOUT_MS);
    const char* peerTag = IS_GATE ? "S-2" : "S-1";

    // Worker status string
    char wBuf[80];
    if (wHeard) {
      snprintf(wBuf, sizeof(wBuf), "[w1] range dist = %s, rssi(%d) touch = %d", 
               getDistStr((int)workerRssi).c_str(), (int)workerRssi, touched ? 1 : 0);
    } else {
      snprintf(wBuf, sizeof(wBuf), "[w1] no range, touch = %d", touched ? 1 : 0);
    }

    // Peer station status string
    char pBuf[80];
    if (pHeard) {
      snprintf(pBuf, sizeof(pBuf), "[%s] range dist = %s, rssi(%d)", 
               peerTag, getDistStr((int)peerRssi).c_str(), (int)peerRssi);
    } else {
      snprintf(pBuf, sizeof(pBuf), "[%s] no range", peerTag);
    }

    Serial.printf("%s | %s\n", wBuf, pBuf);
  }
  delay(20);
}
