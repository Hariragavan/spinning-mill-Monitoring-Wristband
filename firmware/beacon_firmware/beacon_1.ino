/*
  Beacon 1 Gateway Firmware - ESP32 Gateway & Scanner (Supabase REST API Version)
  --------------------------------------------------
  Device: Beacon 1 (Station 1 / Start-Finish Station)
  ID: M1-A1
  Monitors: WRISTBAND_01
  
  Features:
  - Connects to Wi-Fi
  - Scans for WRISTBAND_01 BLE advertisement
  - Tracks live range (meters/cm & dBm)
  - Detects ~10cm touch check-ins
  - Asynchronously pushes check-in events to Supabase REST API (/rest/v1/telemetry_logs)
  - Asynchronously updates live worker state in Supabase REST API (/rest/v1/workers)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <math.h>

// =================== CONFIGURATION SETTINGS ===================
// 1. Wi-Fi Credentials
const char* WIFI_SSID         = "Redmi Note 11T 5G";
const char* WIFI_PASSWORD     = "hari1234";

// 2. Supabase Project Credentials
// Replace with your Supabase Project URL (e.g., https://your-project.supabase.co)
const char* SUPABASE_URL      = "https://your-project.supabase.co";

// Replace with your Supabase anon/public key
const char* SUPABASE_KEY      = "your-anon-key-here";

// 3. Hardware & Network Tuning
#define STATION_ID            "M1-A1"
#define TARGET_BAND_NAME      "WRISTBAND_01"
#define WORKER_ID             "worker_1"
#define STATUS_LED_PIN        2
#define RESET_BUTTON_PIN      0

#define TOUCH_RSSI_THRESHOLD -38  // ~10 cm boundary
#define LIVE_RSSI_THRESHOLD  -85  // Room-wide tracking boundary

const int MEASURED_POWER_1M = -59;
const float PATH_LOSS_EXPONENT = 2.0;

// =================== GLOBAL STATE VARIABLES ===================
enum PatrolState { IDLE, OUTBOUND, RETURNING, COMPLETED };
PatrolState currentPatrolState = IDLE;

unsigned long lapStartTime = 0;
unsigned long lastTransitionTime = 0;
int completedLapCount = 0;
BLEScan* pBLEScan;

// Thread-safe Asynchronous Queue Flags
volatile bool pendingUpload = false;
String queuedEvent = "";
float queuedDuration = 0.0;
int queuedRssi = 0;
float queuedDistance = 0.0;
String queuedHeading = "Forward";

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

// =================== SUPABASE HTTPS UPLOADER (RUNS IN LOOP) ===================
void handleSupabaseUpload() {
  if (!pendingUpload) return;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SUPABASE ERROR] Wi-Fi disconnected. Skipping push.");
    pendingUpload = false;
    return;
  }

  Serial.println("[SUPABASE] Pushing telemetry document & updating live dashboard in Supabase...");

  WiFiClientSecure client;
  client.setInsecure();  // Bypass CA validation on ESP32
  client.setTimeout(5);  // 5-second timeout

  HTTPClient https;
  https.setTimeout(5000);

  // 1. Post to Historical Logs (/rest/v1/telemetry_logs)
  String logUrl = String(SUPABASE_URL) + "/rest/v1/telemetry_logs";

  if (https.begin(client, logUrl)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    https.addHeader("Prefer", "return=minimal");

    String payload = "{";
    payload += "\"station_id\":\"" + String(STATION_ID) + "\",";
    payload += "\"target_device\":\"" + String(TARGET_BAND_NAME) + "\",";
    payload += "\"event\":\"" + queuedEvent + "\",";
    payload += "\"lap_duration_sec\":" + String(queuedDuration, 2) + ",";
    payload += "\"signal_rssi\":" + String(queuedRssi) + ",";
    payload += "\"est_distance_cm\":" + String(queuedDistance, 2) + ",";
    payload += "\"uptime_ms\":" + String(millis());
    payload += "}";

    int httpCode = https.POST(payload);
    if (httpCode == 200 || httpCode == 201) {
      Serial.printf("[SUPABASE LOG SUCCESS] HTTP %d | Log Saved!\n", httpCode);
    } else {
      Serial.printf("[SUPABASE LOG ERROR] HTTP %d | %s\n", httpCode, https.errorToString(httpCode).c_str());
    }
    https.end();
  }

  // 2. Upsert Live Worker State for Dashboard (/rest/v1/workers)
  String liveUrl = String(SUPABASE_URL) + "/rest/v1/workers?on_conflict=worker_id";

  if (https.begin(client, liveUrl)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_KEY);
    https.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    https.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

    String livePayload = "{";
    livePayload += "\"worker_id\":\"" + String(WORKER_ID) + "\",";
    livePayload += "\"device_id\":\"" + String(TARGET_BAND_NAME) + "\",";
    livePayload += "\"current_zone\":\"Side A\",";
    livePayload += "\"last_beacon_id\":\"" + String(STATION_ID) + "\",";
    livePayload += "\"beacon_rssi\":" + String(queuedRssi) + ",";
    livePayload += "\"current_machine\":\"M1\",";
    livePayload += "\"lap_count\":" + String(completedLapCount) + ",";
    livePayload += "\"lap_duration_sec\":" + String(queuedDuration, 2) + ",";
    livePayload += "\"directional_heading\":\"" + queuedHeading + "\",";
    livePayload += "\"motion_state\":\"walking\",";
    livePayload += "\"idle_duration_sec\":0,";
    livePayload += "\"walking_speed_ms\":1.20,";
    livePayload += "\"shift_status\":\"login\",";
    livePayload += "\"incident_type\":\"none\",";
    livePayload += "\"assistance_request_flag\":false,";
    livePayload += "\"wristband_battery_pct\":100,";
    livePayload += "\"beacon_battery_pct\":100";
    livePayload += "}";

    int httpCode = https.POST(livePayload);
    if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
      Serial.printf("[SUPABASE LIVE DASHBOARD SUCCESS] HTTP %d | Dashboard Updated!\n", httpCode);
    } else {
      Serial.printf("[SUPABASE LIVE ERROR] HTTP %d | %s\n", httpCode, https.errorToString(httpCode).c_str());
    }
    https.end();
  }

  pendingUpload = false; // Reset queue
}

// =================== BLE SCAN CALLBACK ===================
class Beacon1ScannerCallback: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName()) return;

    if (advertisedDevice.getName() == TARGET_BAND_NAME) {
      int rssi = advertisedDevice.getRSSI();
      float distM = calculateDistance(rssi);
      float distCm = distM * 100.0;

      // 1. Live Room Tracking Stream
      if (rssi >= LIVE_RSSI_THRESHOLD && rssi < TOUCH_RSSI_THRESHOLD) {
        Serial.printf("[B1 LIVE] Band: %.2fm (%.1fcm) | RSSI: %d dBm | State: %d\n", 
                      distM, distCm, rssi, currentPatrolState);
      }

      // 2. 10cm Proximity Touch Event
      if (rssi >= TOUCH_RSSI_THRESHOLD) {
        if (millis() - lastTransitionTime < 2500) return; // Debounce

        // START LAP
        if (currentPatrolState == IDLE) {
          currentPatrolState = OUTBOUND;
          lapStartTime = millis();
          lastTransitionTime = millis();
          triggerBlink(4);

          Serial.println("\n***************************************************");
          Serial.println("  >>> [BEACON 1] 10cm TOUCH: LAP STARTED! <<<     ");
          Serial.printf ("  Signal: %d dBm | Est Distance: %.2f cm\n", rssi, distCm);
          Serial.println("***************************************************\n");

          // Queue event safely for loop execution
          queuedEvent = "LAP_STARTED";
          queuedDuration = 0.00;
          queuedRssi = rssi;
          queuedDistance = distCm;
          queuedHeading = "Forward";
          pendingUpload = true;
        }
        // FINISH LAP
        else if (currentPatrolState == RETURNING || currentPatrolState == OUTBOUND) {
          currentPatrolState = COMPLETED;
          completedLapCount++;
          float durationSec = (millis() - lapStartTime) / 1000.0;
          lastTransitionTime = millis();
          triggerBlink(8);

          Serial.println("\n===================================================");
          Serial.println("  >>> [BEACON 1] 10cm TOUCH: ROUND COMPLETED! <<<  ");
          Serial.printf ("  Total Round Duration: %.2f seconds\n", durationSec);
          Serial.printf ("  Touch Signal: %d dBm | Distance: %.2f cm\n", rssi, distCm);
          Serial.println("===================================================\n");

          // Queue event safely for loop execution
          queuedEvent = "ROUND_COMPLETED";
          queuedDuration = durationSec;
          queuedRssi = rssi;
          queuedDistance = distCm;
          queuedHeading = "Return";
          pendingUpload = true;
        }
      }
    }
  }
};

// =================== SETUP & LOOP ===================
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(1000);

  Serial.println("\n=========================================");
  Serial.println("   BEACON 1 (SUPABASE GATEWAY) BOOT      ");
  Serial.println("=========================================");

  // 1. Initial 5-Second Delay
  Serial.println("Starting in 5 seconds...");
  for (int i = 5; i > 0; i--) {
    Serial.printf("%d...\n", i);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(100);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(900);
  }

  // 2. Connect to Wi-Fi
  Serial.printf("Connecting to Wi-Fi: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 25) {
    delay(500);
    Serial.print(".");
    retryCount++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ Wi-Fi Connected!");
    Serial.printf("  IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n✗ Wi-Fi Connection Failed. Running BLE locally.");
  }

  // 3. Initialize BLE Scanner
  BLEDevice::init("BEACON_M1_A1");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new Beacon1ScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  Serial.println("✓ BLE Scanner ACTIVE & listening for WRISTBAND_01");
  Serial.println("=========================================\n");
}

void loop() {
  // 1. Process any pending Supabase uploads outside the BLE callback
  handleSupabaseUpload();

  // 2. Run continuous non-blocking BLE scan
  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 3. Handle non-blocking LED animation
  updateBlinkEngine();

  // 4. Check BOOT button (GPIO 0) to reset state
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      currentPatrolState = IDLE;
      Serial.println("\n[RESET] Patrol state reset to IDLE. Ready for new lap.\n");
      triggerBlink(2);
      while (digitalRead(RESET_BUTTON_PIN) == LOW);
    }
  }
}
