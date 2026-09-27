/**
 * ============================================================================
 * AIRSENSE - FIREBASE & SENSOR CONFIGURATION MODULE
 * ============================================================================
 * 
 * Instructions:
 * 1. Replace the firebaseConfig values below with your Firebase Web App credentials.
 *    (Firebase Console -> Project Settings -> General -> Your apps -> Web app)
 * 2. Select your database type: "rtdb" (Realtime Database) or "firestore" (Cloud Firestore).
 * 3. Adjust FIREBASE_PATHS and SENSOR_FIELDS if your Arduino writes to different paths.
 */

// STEP 1: Paste your Firebase Web SDK configuration here
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// STEP 2: Database selection: "rtdb" for Realtime Database, "firestore" for Cloud Firestore
export const DATABASE_TYPE = "rtdb"; // "rtdb" | "firestore"

// STEP 3: Configure Database Paths
// Modify these if your Arduino/ESP32 uploads data to different paths or collections
export const FIREBASE_PATHS = {
  current: "airQuality/current",
  history: "airQuality/history"
};

// STEP 4: Sensor Field Mapping
// If your Arduino JSON keys are different, map them here to match your device payload
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

// STEP 5: Device Information & Preferences
export const DEVICE_CONFIG = {
  defaultDeviceName: "AirSense-01",
  expectedUpdateIntervalSeconds: 10,
  offlineThresholdSeconds: 35, // Flag as offline if no packet received within 35s
  temperatureUnit: "°C", // "°C" or "°F"
  maxHistoryPoints: 200 // Max points to keep in memory for live charts
};

/**
 * Checks whether Firebase configuration has been populated with valid keys.
 * Returns false if still containing placeholder strings.
 */
export function isFirebaseConfigured() {
  if (!firebaseConfig || !firebaseConfig.apiKey) return false;
  const isPlaceholder = 
    firebaseConfig.apiKey.includes("YOUR_") ||
    firebaseConfig.projectId.includes("YOUR_") ||
    firebaseConfig.databaseURL.includes("YOUR_");
  return !isPlaceholder;
}
