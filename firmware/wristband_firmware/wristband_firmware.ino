/*
  Worker Wristband Firmware - ESP32 (Pure BLE Transmitter)
  ---------------------------------------------------------------
  Device: WRISTBAND_01
  Role: Ultra-low latency BLE Broadcaster (+9 dBm, 100ms interval)
  Zero Wi-Fi overhead = no heap fragmentation, no BLE/Wi-Fi co-ex crashes.
  The stations (M1-A1, M1-B4) do all the listening and all the Supabase work.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define WORKER_NAME             "WRISTBAND_01"
#define PATROL_SERVICE_UUID     "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define STATUS_LED_PIN          2  // Use GPIO 8 if on ESP32-C3 SuperMini

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(500);

  Serial.println("\n=========================================");
  Serial.println("  WORKER WRISTBAND (WRISTBAND_01) STARTING");
  Serial.println("=========================================");

  BLEDevice::init(WORKER_NAME);
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  // Fast 100 ms advertising so the stations can confirm a touch within ~1 second
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setCompleteServices(BLEUUID(PATROL_SERVICE_UUID));
  advData.setName(WORKER_NAME);
  pAdvertising->setAdvertisementData(advData);

  pAdvertising->setMinInterval(160); // 160 * 0.625 ms = 100 ms
  pAdvertising->setMaxInterval(160);
  pAdvertising->setMinPreferred(0x06);

  BLEDevice::startAdvertising();

  Serial.println("Worker wristband broadcasting");
  Serial.println("=========================================\n");
}

void loop() {
  // Status heartbeat blink every 2 seconds
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(25);
  digitalWrite(STATUS_LED_PIN, LOW);
  delay(1975);
}
