# 🌬️ AirSense — Real-Time Air Quality Monitoring System

A production-ready, high-performance web dashboard that connects your **Arduino / ESP32 air-quality sensor device** to a **Firebase backend** in real time.

---

## 📐 System Architecture

The dashboard does **not** connect directly to the microcontroller over USB. Instead, telemetry travels through a robust cloud pipeline:

```
┌──────────────────────────┐
│   Arduino / ESP32 Node   │
│ (DHT22, MQ-135, PMS5003) │
└─────────────┬────────────┘
              │ Wi-Fi / HTTPS
              ▼
┌──────────────────────────┐
│     Firebase Backend     │
│  (Realtime DB / Firestore│
└─────────────┬────────────┘
              │ WebSocket / Real-time Listener
              ▼
┌──────────────────────────┐
│  AirSense Web Dashboard  │
│ (Live Gauge, Charts, CSV)│
└──────────────────────────┘
```

1. **Hardware Node (Arduino / ESP32)**: Reads sensor values (PM2.5, PM10, CO₂, Temperature, Humidity), calculates AQI, timestamps the packet, and transmits JSON over Wi-Fi to Firebase via HTTPS REST.
2. **Firebase Backend**: Realtime Database or Cloud Firestore stores current state and appends to historical log.
3. **AirSense Dashboard**: Subscribes to real-time Firebase listeners to instantly render live telemetry, animate the AQI circular gauge, update Chart.js trend graphs, and append to the historical readings table without page refreshes.

---

## ✨ Features

- **⚡ Real-Time Firebase Synchronization**: Instant UI updates via Firebase Realtime Database (`onValue`) or Cloud Firestore (`onSnapshot`).
- **🎯 Dynamic Circular AQI Gauge**: High-DPI canvas-based radial gauge with smooth animations and dynamic EPA color thresholds (Good, Moderate, Sensitive, Unhealthy, Very Unhealthy, Hazardous).
- **📊 4 Interactive Chart.js Graphs**:
  - **AQI History**
  - **Particulates History (PM2.5 & PM10)**
  - **CO₂ Concentration (ppm)**
  - **Temperature & Humidity (Dual Y-Axis)**
- **⏱️ Time Range Filtering**: Toggle historical trends for `1 Hour`, `6 Hours`, `24 Hours`, `7 Days`, `30 Days`, or `All`.
- **📋 Historical Data Table**: Paginated, sortable tabular logs with status pills and responsive mobile layouts.
- **💾 CSV Telemetry Export**: One-click RFC4180-compliant `.csv` download with ISO timestamps and calibrated sensor units.
- **🎨 Dark / Light Mode**: Sleek environmental IoT color palette with persistent theme choice in `localStorage`.
- **🛡️ Data Validation & Fault Tolerance**: Robust `safeNumber()` parsing to prevent `NaN` or crashes from missing fields.
- **🧪 Built-in Hardware Simulator**: Interactive demo mode to test UI and charts immediately before powering on physical hardware.

---

## 📁 Project Structure

```
air-quality-dashboard/
│
├── index.html                             # Main dashboard HTML5 markup
├── package.json                           # Dependencies (Firebase, Chart.js, Lucide, Vite)
├── vite.config.js                         # Vite dev & build configuration
├── database.rules.json                    # Firebase Realtime Database security rules
├── firestore.rules                        # Cloud Firestore security rules
├── README.md                              # Complete setup & deployment guide
│
├── arduino/
│   └── AirSense_ESP32_Firebase.ino        # Ready-to-flash ESP32/Arduino firmware
│
├── public/
│   └── favicon.svg                        # AirSense favicon
│
└── src/
    ├── main.js                            # App entry point
    ├── config.js                          # Firebase credentials, paths & field mapping
    ├── firebase.js                        # Modular Firebase SDK v11 integration
    ├── aqi-calculator.js                  # EPA standard AQI calculations & health advice
    ├── gauge.js                           # Smooth animated circular AQI gauge
    ├── charts.js                          # Chart.js instances & time filters
    ├── table.js                           # Historical data table & pagination
    ├── export.js                          # CSV generation & export
    ├── simulator.js                       # Hardware simulation for instant testing
    ├── utils.js                           # Number validation, timestamps & toast notifications
    └── styles.css                         # Modern IoT styling & theme tokens
```

---

## 🚀 Step-by-Step Setup Guide

### Step 1 — Create / Open Your Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your existing Firebase project (or create a new one).

### Step 2 — Get Your Firebase Web App Configuration
1. In your Firebase Console, click the **Gear icon (Project Settings)** in the sidebar.
2. Under the **General** tab, scroll down to the **"Your apps"** section.
3. Click the **Web (`</>`)** icon to register a web app.
4. Copy the `firebaseConfig` credentials object shown on screen.

### Step 3 — Add Configuration to `src/config.js`
Open `src/config.js` and paste your credentials into the `firebaseConfig` object:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyYourActualApiKeyHere",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Step 4 — Configure Database Paths & Fields
If your Arduino uses a different JSON structure, customize the paths in `src/config.js`:

```javascript
export const DATABASE_TYPE = "rtdb"; // "rtdb" for Realtime Database or "firestore" for Firestore

export const FIREBASE_PATHS = {
  current: "airQuality/current",
  history: "airQuality/history"
};

export const SENSOR_FIELDS = {
  pm25: "pm25",
  pm10: "pm10",
  co2: "co2",
  temperature: "temperature",
  humidity: "humidity",
  aqi: "aqi",
  timestamp: "timestamp",
  deviceId: "deviceId"
};
```

### Step 5 — Run the Web Dashboard Locally
In your terminal, execute:

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit the local server address (default: `http://localhost:3000`) in your browser.

### Step 6 — Production Build
To create an optimized production bundle:

```bash
npm run build
```
The deployable static files will be placed in the `dist/` directory.

---

## 🔌 Arduino / ESP32 Hardware Integration

### 1. Sensor Wiring Reference
| Sensor | Measurement | ESP32 Pin | Protocol / Type |
| :--- | :--- | :--- | :--- |
| **PMS5003** | PM2.5 & PM10 | GPIO 16 (RX2), GPIO 17 (TX2) | UART Serial |
| **MQ-135** | CO₂ / Air Quality | GPIO 34 (ADC1) | Analog |
| **DHT22** | Temp & Humidity | GPIO 4 | 1-Wire Digital |

### 2. Flashing the Firmware
1. Open [`arduino/AirSense_ESP32_Firebase.ino`](file:///d:/3/arduino/AirSense_ESP32_Firebase.ino) in Arduino IDE.
2. Enter your Wi-Fi credentials (`WIFI_SSID` & `WIFI_PASSWORD`).
3. Set your Firebase URL (`FIREBASE_HOST`).
4. Select board **ESP32 Dev Module** and click **Upload**.

---

## 🔒 Firebase Security Rules

### Realtime Database (`database.rules.json`)
```json
{
  "rules": {
    "airQuality": {
      ".read": true,
      ".write": "auth != null",
      "history": {
        ".indexOn": ["timestamp"]
      }
    }
  }
}
```

> **Security Note**: Never hardcode service account private keys or Firebase Admin credentials in frontend client code. Web API keys identify your project but do not grant administrative bypass; protect your database with the security rules above.
