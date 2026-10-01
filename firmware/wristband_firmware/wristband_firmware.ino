/*
  Wristband Firmware - ESP32 Smart Wearable (Pure BLE Transmitter)
  ---------------------------------------------------------------
  Device: WRISTBAND_01
  Role: Ultra-low latency BLE Broadcaster (+9 dBm, 100ms interval)
  Zero Wi-Fi overhead = No heap fragmentation, no co-ex crashes.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define BAND_NAME              "WRISTBAND_01"
#define PATROL_SERVICE_UUID    "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define STATUS_LED_PIN         2  // Use GPIO 8 if on ESP32-C3 SuperMini

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(500);

  Serial.println("\n=========================================");
  Serial.println("  WRISTBAND_01 BROADCASTER INITIALIZING  ");
  Serial.println("=========================================");

  // Initialize BLE Stack with maximum RF output power
  BLEDevice::init(BAND_NAME);
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  // Fast 100 ms advertising for reliable 10 cm touch detection
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06); // General discoverable, BR/EDR not supported
  advData.setCompleteServices(BLEUUID(PATROL_SERVICE_UUID));
  advData.setName(BAND_NAME);
  pAdvertising->setAdvertisementData(advData);

  pAdvertising->setMinInterval(160); // 160 * 0.625 ms = 100 ms
  pAdvertising->setMaxInterval(160);
  pAdvertising->setMinPreferred(0x06);

  BLEDevice::startAdvertising();

  Serial.println("✓ WRISTBAND_01 broadcasting actively!");
  Serial.println("=========================================\n");
}

void loop() {
  // Low-power status heartbeat blink every 2 seconds
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(25);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(1975);
}
