/*
  Beacon 2 Firmware - ESP32 DevKit
  --------------------------------------------------
  Device: Beacon 2 (Station 2 / Midpoint Station)
  ID: M1-A2
  
  Requirements:
  1. Start delay: 5 seconds on startup.
  2. Data transmission interval: 2 seconds.
  3. Power tuned for ~10cm close-range round detection.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// Unique Identifier for Beacon 2
const String BEACON_ID = "M1-A2"; 

// Transmission Interval (2 seconds = 2000 ms)
const unsigned long TRANSMIT_INTERVAL_MS = 2000;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=========================================");
  Serial.println("   ESP32 BLE BEACON 2 (M1-A2) STARTUP    ");
  Serial.println("=========================================");
  
  // 1. Initial Start Delay of 5 seconds
  Serial.println("Applying start delay of 5 seconds...");
  for (int i = 5; i > 0; i--) {
    Serial.printf("Starting in %d seconds...\n", i);
    delay(1000);
  }

  Serial.println("Initializing BLE Device...");
  BLEDevice::init(BEACON_ID.c_str());

  /*
   * 2. Range Tuning for ~10cm Proximity Detection:
   * Setting lower TX Power (ESP_PWR_LVL_N9 ~ -9dBm) limits high RSSI signals 
   * (> -45 dBm) to within ~10cm to 15cm distance.
   */
  BLEDevice::setPower(ESP_PWR_LVL_N9);

  // Setup BLE Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID("180F"); 
  pAdvertising->setScanResponse(true);

  // 3. Set Advertising Interval to 2 seconds (3200 * 0.625 ms = 2000 ms)
  pAdvertising->setMinInterval(3200); 
  pAdvertising->setMaxInterval(3200);

  // Start broadcasting
  BLEDevice::startAdvertising();
  Serial.println("✓ Beacon 2 is ACTIVE and broadcasting every 2 seconds!");
  Serial.println("=========================================");
}

void loop() {
  static unsigned long lastLogTime = 0;
  if (millis() - lastLogTime >= TRANSMIT_INTERVAL_MS) {
    lastLogTime = millis();
    Serial.printf("[%lu ms] Beacon 2 (M1-A2) Broadcasting...\n", millis());
  }
  
  delay(100);
}

