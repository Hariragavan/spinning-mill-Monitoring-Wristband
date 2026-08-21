/*
  Wristband Firmware - ESP32-C3
  --------------------------------------------------
  1. Continuously scans BLE to find the nearest beacon (strongest RSSI).
  2. Tracks motion via accelerometer (MPU6050) variance.
  3. Evaluates if worker is walking or stationary and updates idle duration.
  4. Packages data into a JSON string and sends it via BLE (as a peripheral or broadcasting) 
     or sends it via UART/BLE to a Gateway ESP32.
     
  Dependencies:
  - ArduinoBLE (or ESP32 BLE Arduino)
  - Adafruit MPU6050
  - ArduinoJson
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>

Adafruit_MPU6050 mpu;

// BLE Variables
BLEScan* pBLEScan;
const int scanTime = 2; // In seconds
String nearestBeaconId = "unknown";
int nearestBeaconRssi = -100;

// Motion Variables
String motionState = "stationary";
unsigned long stationaryStartTime = 0;
int idleDurationSec = 0;
int totalSteps = 0; 
float armMotionIntensity = 0.0;

// Device info
const String workerId = "worker_1";
const String deviceId = "ESP32-C3-1";
int batteryPct = 100;

// Gateway BLE Service / Characteristic UUIDs to send data (Mock UUIDs)
#define GATEWAY_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define GATEWAY_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      // Look for our specific beacons (e.g. name starts with "M")
      if (advertisedDevice.haveName()) {
        String devName = advertisedDevice.getName().c_str();
        if (devName.startsWith("M1-") || devName.startsWith("M2-") || devName.startsWith("M3-")) {
          int rssi = advertisedDevice.getRSSI();
          if (rssi > nearestBeaconRssi) {
            nearestBeaconRssi = rssi;
            nearestBeaconId = devName;
          }
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  // Initialize MPU6050
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // Initialize BLE Scanner
  BLEDevice::init(deviceId.c_str());
  pBLEScan = BLEDevice::getScan(); //create new scan
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); 
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99); 
}

void loop() {
  // 1. Scan for nearest beacon
  nearestBeaconRssi = -100; // Reset
  BLEScanResults foundDevices = pBLEScan->start(scanTime, false);
  pBLEScan->clearResults(); 

  // 2. Read IMU Data & Calculate Motion
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  // Simple variance calculation for motion intensity
  float totalAccel = sqrt(a.acceleration.x * a.acceleration.x + 
                          a.acceleration.y * a.acceleration.y + 
                          a.acceleration.z * a.acceleration.z);
                          
  // Baseline gravity is ~9.8 m/s^2. Any significant deviation implies movement.
  float deviation = abs(totalAccel - 9.8);
  armMotionIntensity = deviation * 10; // Simple scaling

  if (deviation > 1.5) {
    motionState = "walking";
    stationaryStartTime = 0;
    idleDurationSec = 0;
    totalSteps += random(1, 4); // Simulate step count based on movement
  } else {
    if (motionState == "walking") {
      stationaryStartTime = millis();
    }
    motionState = "stationary";
    idleDurationSec = (millis() - stationaryStartTime) / 1000;
  }

  // 3. Prepare JSON Payload
  StaticJsonDocument<512> doc;
  doc["worker_id"] = workerId;
  doc["last_beacon_id"] = nearestBeaconId;
  doc["beacon_rssi"] = nearestBeaconRssi;
  doc["motion_state"] = motionState;
  doc["idle_duration_sec"] = idleDurationSec;
  doc["total_steps"] = totalSteps;
  doc["arm_motion_intensity"] = armMotionIntensity;
  doc["wristband_battery_pct"] = batteryPct;

  String payload;
  serializeJson(doc, payload);

  // 4. Send payload to Gateway
  // (In a real implementation, this would connect to the Gateway as a BLE Client 
  // and write to the characteristic, or broadcast it as Manufacturer Data)
  Serial.print("Payload to send to Gateway: ");
  Serial.println(payload);

  delay(10000); // Send updates roughly every 10 seconds (scanTime + delay)
}
