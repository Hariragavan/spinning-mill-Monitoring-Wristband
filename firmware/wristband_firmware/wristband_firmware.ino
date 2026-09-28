/*
  Wristband Firmware - ESP32 / ESP32-C3
  --------------------------------------------------
  Device: Wearable Patrol Band
  ID: WRISTBAND_01
  Role: Continuous BLE Transmitter (Low latency 100ms) + Proximity Scanner
  
  Features:
  - Fast BLE Advertising: Broadcasts 'WRISTBAND_01' (100ms interval) for instant 10cm touch check-in
  - Hardware Motion Broadcasting: Encodes MPU6050 walking/idle state in BLE manufacturer payload
  - Non-blocking Background Scanner: Monitors Beacon 1 (M1-A1) and Beacon 2 (M1-B4) with zero CPU lag
  - 3-Second Idle Engine: Detects stationary idle if no arm swing is measured for >= 3 seconds
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

// Device Identification
#define DEVICE_NAME "WRISTBAND_01"

// Stations to track
#define BEACON_1_NAME "M1-A1"
#define BEACON_2_NAME "M1-B4"

Adafruit_MPU6050 mpu;
bool mpuAvailable = false;

BLEScan* pBLEScan;
int b1Rssi = -99;
float b1DistanceM = -1.0;
int b2Rssi = -99;
float b2DistanceM = -1.0;

// Motion Variables
String motionState = "stationary";
String lastReportedMotion = "";
unsigned long lastMovementTime = 0;
int idleDurationSec = 0;
int lastReportedIdle = -1;

float calculateDistance(int rssi) {
  if (rssi == 0) return -1.0;
  float ratio = (float)(-59 - rssi) / (10.0 * 2.0);
  return pow(10.0, ratio);
}

// Dynamically updates BLE advertisement payload with live MPU6050 motion state
void updateBlePayload() {
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(DEVICE_NAME);

  // 2-byte Manufacturer Data:
  // Byte 0: 0x01 = walking, 0x00 = stationary
  // Byte 1: idle duration in seconds (capped at 255)
  std::string mfgData = "";
  mfgData += (char)(motionState == "walking" ? 0x01 : 0x00);
  mfgData += (char)(idleDurationSec > 255 ? 255 : idleDurationSec);
  advData.setManufacturerData(mfgData);

  pAdvertising->setAdvertisementData(advData);
}

// Scanner Callback: Listens for Beacon 1 and Beacon 2
class WristbandScannerCallback: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (!advertisedDevice.haveName()) return;
    String name = advertisedDevice.getName().c_str();
    int rssi = advertisedDevice.getRSSI();

    if (name == BEACON_1_NAME) {
      b1Rssi = rssi;
      b1DistanceM = calculateDistance(rssi);
    } else if (name == BEACON_2_NAME) {
      b2Rssi = rssi;
      b2DistanceM = calculateDistance(rssi);
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=========================================");
  Serial.println("   WRISTBAND PATROL BAND (WRISTBAND_01)  ");
  Serial.println("=========================================");

  // 1. Initialize MPU6050 Accelerometer
  Wire.begin();
  if (mpu.begin()) {
    mpuAvailable = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("✓ MPU6050 Accelerometer Ready");
  } else {
    Serial.println("⚠ MPU6050 not detected. Using simulated timer fallback.");
  }

  // 2. Initialize BLE Broadcaster
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setPower(ESP_PWR_LVL_P9); // Max power for clean detection

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(DEVICE_NAME);
  
  std::string mfgData = "";
  mfgData += (char)0x00; // stationary
  mfgData += (char)0x00; // 0s idle
  advData.setManufacturerData(mfgData);
  pAdvertising->setAdvertisementData(advData);

  // 100ms fast advertising interval (160 * 0.625ms = 100ms)
  pAdvertising->setMinInterval(160);
  pAdvertising->setMaxInterval(160);
  BLEDevice::startAdvertising();

  // 3. Initialize BLE Scanner (Non-blocking background scan)
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new WristbandScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(120);
  pBLEScan->setWindow(80);
  pBLEScan->start(0, nullptr, false); // Asynchronous non-blocking

  lastMovementTime = millis();
  Serial.println("✓ BLE Broadcaster ACTIVE: 'WRISTBAND_01' (100ms interval)");
  Serial.println("✓ BLE Scanner ACTIVE: Monitoring M1-A1 & M1-B4");
  Serial.println("=========================================\n");
}

void loop() {
  // 1. High-frequency MPU6050 Accelerometer Sampling
  if (mpuAvailable) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    float totalAccel = sqrt(a.acceleration.x * a.acceleration.x +
                            a.acceleration.y * a.acceleration.y +
                            a.acceleration.z * a.acceleration.z);

    // Gravity baseline ~9.8 m/s^2. Deviation > 1.2 indicates arm walking movement
    if (abs(totalAccel - 9.8) > 1.2) {
      lastMovementTime = millis();
      motionState = "walking";
      idleDurationSec = 0;
    }
  }

  // 2. 3-Second Idle Engine
  if (millis() - lastMovementTime >= 3000) {
    motionState = "stationary";
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // 3. Update BLE Advertising payload when state changes or every 1 second
  static unsigned long lastBleUpdate = 0;
  if (motionState != lastReportedMotion || abs(idleDurationSec - lastReportedIdle) >= 1 || millis() - lastBleUpdate >= 1000) {
    lastBleUpdate = millis();
    lastReportedMotion = motionState;
    lastReportedIdle = idleDurationSec;
    updateBlePayload();
  }

  // 4. Print Local Range Telemetry every 1.5 seconds
  static unsigned long lastLog = 0;
  if (millis() - lastLog >= 1500) {
    lastLog = millis();
    String nearest = (b1DistanceM > 0 && (b2DistanceM <= 0 || b1DistanceM < b2DistanceM)) ? "M1-A1" : (b2DistanceM > 0 ? "M1-B4" : "None");
    Serial.printf("[WATCH] Motion: %s (Idle: %ds) | Range to B1: %.2fm (%d dBm) | Range to B2: %.2fm (%d dBm) | Nearest: %s\n",
                  motionState.c_str(), idleDurationSec,
                  b1DistanceM, b1Rssi,
                  b2DistanceM, b2Rssi,
                  nearest.c_str());
  }

  // 5. Periodic cleanup of scan results every 10 seconds to avoid heap fragmentation
  static unsigned long lastScanClear = 0;
  if (millis() - lastScanClear >= 10000) {
    lastScanClear = millis();
    pBLEScan->clearResults();
  }

  delay(50); // Responsive 20Hz loop rate
}
