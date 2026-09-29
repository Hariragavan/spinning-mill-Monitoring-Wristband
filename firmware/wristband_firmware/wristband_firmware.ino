// ============================================================
// Wristband v3  (WRISTBAND_01)  -  plain ESP32 dev board, NO sensors
// It only advertises its name every 50 ms.
// The beacons measure signal strength and work out touch / walking / idle.
// No libraries, no wiring: just power it (power bank or USB).
// ============================================================
#include <BLEDevice.h>
#include <BLEUtils.h>

#define DEVICE_NAME "WRISTBAND_01"

void setup() {
  Serial.begin(115200);
  delay(500);

  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setPower(ESP_PWR_LVL_N0);    // 0 dBm: repeatable RSSI at 10 cm

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  BLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setName(DEVICE_NAME);
  adv->setAdvertisementData(ad);
  adv->setMinInterval(80);                // 80 * 0.625 ms = 50 ms
  adv->setMaxInterval(80);
  BLEDevice::startAdvertising();

  Serial.println("WRISTBAND_01 advertising (50 ms interval)");
}

void loop() {
  delay(1000);
}
