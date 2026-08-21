/*
  Gateway Firmware - ESP32
  --------------------------------------------------
  1. Connects to the local WiFi network.
  2. Sets up a BLE Server (or scans) to receive payload updates from wristbands.
  3. Uses Firebase ESP Client library (or REST API) to push the live data 
     to the Firebase Realtime Database.
     
  Dependencies:
  - WiFi
  - FirebaseClient (by Mobizt) or similar REST HTTP Client
  - ArduinoBLE (or ESP32 BLE Arduino)
  - ArduinoJson
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Firebase REST API Configuration
// E.g., https://YOUR_PROJECT_ID.firebaseio.com
const String FIREBASE_URL = "YOUR_FIREBASE_DATABASE_URL"; 
const String FIREBASE_AUTH = "YOUR_FIREBASE_DATABASE_SECRET_OR_TOKEN";

// BLE Gateway Service Setup
#define GATEWAY_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define GATEWAY_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Callback for when a wristband writes data to the Gateway's BLE characteristic
class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();

      if (rxValue.length() > 0) {
        Serial.println("Received Payload from Wristband:");
        String payload = "";
        for (int i = 0; i < rxValue.length(); i++) {
          payload += rxValue[i];
        }
        Serial.println(payload);
        
        // Parse JSON to get worker_id
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
          String workerId = doc["worker_id"].as<String>();
          
          // Add gateway timestamp and packet latency
          doc["timestamp"] = millis(); // Ideally use NTP time here
          doc["packet_latency_ms"] = random(20, 100); 
          
          // Re-serialize for Firebase
          String firebasePayload;
          serializeJson(doc, firebasePayload);
          
          // Send to Firebase
          updateFirebase(workerId, firebasePayload);
        }
      }
    }
    
    void updateFirebase(String workerId, String jsonPayload) {
      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = FIREBASE_URL + "/workers/" + workerId + "/live.json?auth=" + FIREBASE_AUTH;
        
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        
        // PUT request overwrites the specific node with our new data
        int httpResponseCode = http.PUT(jsonPayload);
        
        if (httpResponseCode > 0) {
          Serial.print("Firebase updated. HTTP Response code: ");
          Serial.println(httpResponseCode);
        } else {
          Serial.print("Error updating Firebase. Error code: ");
          Serial.println(httpResponseCode);
        }
        http.end();
      } else {
        Serial.println("WiFi Disconnected. Cannot update Firebase.");
      }
    }
};

void setup() {
  Serial.begin(115200);

  // 1. Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");

  // 2. Setup BLE Server
  BLEDevice::init("ESP32-Gateway");
  BLEServer *pServer = BLEDevice::createServer();
  
  BLEService *pService = pServer->createService(GATEWAY_SERVICE_UUID);
  
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         GATEWAY_CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
  pCharacteristic->setValue("Ready");
  
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(GATEWAY_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  
  Serial.println("Gateway BLE Server is advertising and ready to receive data.");
}

void loop() {
  // BLE handles requests in the background via callbacks.
  // We can add watchdog or reconnection logic for WiFi here if needed.
  delay(10000);
}
