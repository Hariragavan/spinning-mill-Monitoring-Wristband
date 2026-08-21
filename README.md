# IoT Worker Patrol Monitoring System

A full-stack IoT worker patrol monitoring system for a textile spinning mill. The system tracks workers wearing BLE wristbands, detects movement and idle status, and counts completed patrol rounds across multiple machines.

## Project Structure

- `/dashboard`: React + Vite frontend application displaying the live factory floor map and worker statistics.
- `/simulator`: Node.js script to generate realistic mock IoT data for testing the dashboard.
- `/firmware`: Arduino sketches (C++) for the hardware (Wristbands, Beacons, and Gateway).

## 1. Firebase Setup

This project uses Firebase Realtime Database. 
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Navigate to **Build > Realtime Database** and click **Create Database**.
3. Set the rules to `true` for testing:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Go to Project Settings and find your **Web API Key**, **Database URL**, and **Project ID**.

## 2. Running the Simulator

Before hardware arrives, you can use the Node.js simulator to test the dashboard.

1. Navigate to the `simulator` directory:
   ```bash
   cd simulator
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `simulator` directory with your Firebase config:
   ```env
   FIREBASE_API_KEY="your_api_key"
   FIREBASE_AUTH_DOMAIN="your_project_id.firebaseapp.com"
   FIREBASE_DATABASE_URL="https://your_project_id.firebaseio.com"
   FIREBASE_PROJECT_ID="your_project_id"
   FIREBASE_STORAGE_BUCKET="your_project_id.appspot.com"
   FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
   FIREBASE_APP_ID="your_app_id"
   ```
4. Start the simulator:
   ```bash
   npm start
   ```

## 3. Running the React Dashboard

1. Navigate to the `dashboard` directory:
   ```bash
   cd dashboard
   ```
2. Create a `.env` file in the `dashboard` directory with your Firebase config (prefix variables with `VITE_`):
   ```env
   VITE_FIREBASE_API_KEY="your_api_key"
   VITE_FIREBASE_AUTH_DOMAIN="your_project_id.firebaseapp.com"
   VITE_FIREBASE_DATABASE_URL="https://your_project_id.firebaseio.com"
   VITE_FIREBASE_PROJECT_ID="your_project_id"
   VITE_FIREBASE_STORAGE_BUCKET="your_project_id.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
   VITE_FIREBASE_APP_ID="your_app_id"
   ```
3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

## 4. Hardware Firmware (ESP32)

Once hardware is available, you will flash 3 different sketches using the Arduino IDE:

1. **Beacons (`firmware/beacon_firmware`)**: Flash to ESP32-C3 modules. They act as passive BLE broadcasters. Assign a unique ID (e.g., "M1-A1") to each one before flashing.
2. **Wristband (`firmware/wristband_firmware`)**: Flash to ESP32-C3 modules with an MPU6050 attached. They scan for beacons, track motion, and send data to the gateway.
3. **Gateway (`firmware/gateway_firmware`)**: Flash to a standard ESP32. Set your WiFi and Firebase credentials in the code. It acts as the bridge connecting BLE data to the internet.
