/*
  Wristband Firmware - ESP32-C3
  --------------------------------------------------
  Device: Wearable Patrol Band
  ID: WRISTBAND_01
  Role: Continuous BLE Transmitter (Low latency 100ms) + Proximity Scanner
  
  Features:
  - Fast BLE Advertising: Broadcasts 'WRISTBAND_01' so Beacon 1 and Beacon 2 detect 10cm touch instantly
  - Mutual Beacon Scanner: Scans for Beacon 1 (M1-A1) and Beacon 2 (M1-B4) to monitor nearest station & range
  - Motion Engine: Uses MPU6050 accelerometer to detect walking vs 3-second stationary idle
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
unsigned long lastMovementTime = 0;
int idleDurationSec = 0;

float calculateDistance(int rssi) {
  if (rssi == 0) return -1.0;
  float ratio = (float)(-59 - rssi) / (10.0 * 2.0);
  return pow(10.0, ratio);
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
    Serial.println("⚠ MPU6050 not detected. Running motion simulation based on timer.");
  }

  // 2. Initialize BLE Broadcaster
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setPower(ESP_PWR_LVL_P9); // Max power for clean detection

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(DEVICE_NAME);
  pAdvertising->setAdvertisementData(advData);

  // 100ms fast advertising interval (160 * 0.625ms = 100ms)
  pAdvertising->setMinInterval(160);
  pAdvertising->setMaxInterval(160);
  BLEDevice::startAdvertising();

  // 3. Initialize BLE Scanner
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new WristbandScannerCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(120);
  pBLEScan->setWindow(80);

  lastMovementTime = millis();
  Serial.println("✓ BLE Broadcaster ACTIVE: 'WRISTBAND_01' (100ms interval)");
  Serial.println("✓ BLE Scanner ACTIVE: Monitoring M1-A1 & M1-B4");
  Serial.println("=========================================\n");
}

void loop() {
  // 1. Scan for nearest beacons
  pBLEScan->start(1, false);
  pBLEScan->clearResults();

  // 2. Read Accelerometer Motion
  if (mpuAvailable) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    float totalAccel = sqrt(a.acceleration.x * a.acceleration.x +
                            a.acceleration.y * a.acceleration.y +
                            a.acceleration.z * a.acceleration.z);

    // Gravity baseline ~9.8 m/s^2. Any deviation > 1.2 indicates arm walking motion
    if (abs(totalAccel - 9.8) > 1.2) {
      lastMovementTime = millis();
      motionState = "walking";
      idleDurationSec = 0;
    }
  }

  // 3-Second Idle Engine
  if (millis() - lastMovementTime >= 3000) {
    motionState = "stationary";
    idleDurationSec = (millis() - lastMovementTime) / 1000;
  }

  // 3. Print Local Range Telemetry
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
}
