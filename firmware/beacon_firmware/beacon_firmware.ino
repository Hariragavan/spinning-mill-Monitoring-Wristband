/*
  Beacon Firmware - ESP32-C3
  --------------------------------------------------
  1. Low power, minimal code.
  2. Broadcasts a fixed BLE advertisement with its own unique ID.
     (e.g., "M1-A1")
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// CHANGE THIS ID for each physical beacon deployed!
const String BEACON_ID = "M1-A1"; 

void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE Beacon: " + BEACON_ID);

  // Initialize BLE with the beacon ID as the device name
  BLEDevice::init(BEACON_ID.c_str());
  
  // Setup the advertising packet
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID("180F"); // Optional: dummy service UUID to structure the packet
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // helps with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);

  // Start broadcasting
  BLEDevice::startAdvertising();
  Serial.println("Beacon is now advertising!");
}

void loop() {
  // Deep sleep could be implemented here to save battery, 
  // waking up periodically to advertise, but ESP32 handles BLE advertising 
  // in the background even if loop() is just delaying.
  delay(2000);
}
