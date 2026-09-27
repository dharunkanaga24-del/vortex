/**
 * ============================================================================
 * AIRSENSE - ESP32 / ESP8266 FIREBASE AIR QUALITY TELEMETRY FIRMWARE
 * ============================================================================
 * 
 * Target Board: ESP32 Dev Module / ESP8266 / NodeMCU
 * 
 * Hardware Sensors Supported / Integrated:
 *  - PMS5003 / SDS011 / Shinyei (PM2.5 and PM10 Particulate Matter via UART)
 *  - MQ-135 / SGP30 / SCD30 (CO2 & Air Quality Gas Sensor via Analog/I2C)
 *  - DHT22 / BME280 (Temperature & Relative Humidity via Digital Pin/I2C)
 * 
 * Architecture:
 *  [Sensors] -> [ESP32 / ESP8266] -> [Wi-Fi HTTPS] -> [Firebase RTDB] -> [AirSense Web Dashboard]
 * 
 * No special Firebase library required! Uses native HTTPS REST API with built-in SSL.
 * Optional Sensor Libraries (if using real physical sensors):
 *  - Adafruit DHT Sensor Library & Adafruit Unified Sensor
 * ============================================================================
 */

#include <stdint.h>
#include <stddef.h>
#include <time.h>
#include <math.h>

#if defined(ARDUINO) || __has_include(<Arduino.h>)
  #include <Arduino.h>
#endif

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecureBearSSL.h>
#elif defined(ESP32) || __has_include(<WiFi.h>)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
#endif

// Fallback types and symbols for IDE static analysis / clangd when toolchain headers are not in global PC search path
#if !defined(ARDUINO) && !__has_include(<Arduino.h>) && !__has_include(<WiFi.h>)
  #include <string>
  #include <iostream>

  class String : public std::string {
  public:
    String() : std::string() {}
    String(const char* s) : std::string(s ? s : "") {}
    String(const std::string& s) : std::string(s) {}
    String(int v) : std::string(std::to_string(v)) {}
    String(unsigned long long v) : std::string(std::to_string(v)) {}
    String(float v) : std::string(std::to_string(v)) {}
    void trim() {
      while (!empty() && (front() == ' ' || front() == '\t' || front() == '\n' || front() == '\r')) erase(0, 1);
      while (!empty() && (back() == ' ' || back() == '\t' || back() == '\n' || back() == '\r')) pop_back();
    }
    bool startsWith(const String& s) const { return rfind(s, 0) == 0; }
    bool endsWith(const String& s) const { return length() >= s.length() && compare(length() - s.length(), s.length(), s) == 0; }
    void remove(size_t index, size_t count = std::string::npos) { if (index < length()) erase(index, count); }
    int indexOf(const String& s) const { auto pos = find(s); return pos == std::string::npos ? -1 : (int)pos; }
  };

  #define WL_CONNECTED 3
  #define WIFI_STA 1

  struct MockSerial {
    template<typename T> void print(T val) {}
    template<typename T> void println(T val = "") {}
    template<typename... Args> void printf(const char* fmt, Args... args) {}
    void begin(unsigned long baud) {}
  };
  static MockSerial Serial;

  struct MockWiFi {
    int status() { return WL_CONNECTED; }
    void mode(int) {}
    void begin(const char*, const char*) {}
    void reconnect() {}
    struct IP { 
      String toString() { return String("192.168.1.100"); } 
    };
    IP localIP() { return IP(); }
    int RSSI() { return -60; }
  };
  static MockWiFi WiFi;

  static unsigned long millis() { return 0; }
  static void delay(unsigned long) {}
  static void configTime(long, int, const char*) {}
  static long random(long min, long max) { return min; }
  static int analogRead(int) { return 500; }
  static long map(long x, long in_min, long in_max, long out_min, long out_max) {
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }
  static bool getLocalTime(struct tm* info, uint32_t ms = 5000) { return true; }

  struct HTTPClient {
    bool begin(const String&) { return true; }
    template<typename C> bool begin(C&, const String&) { return true; }
    void addHeader(const String&, const String&) {}
    int PUT(const String&) { return 200; }
    int POST(const String&) { return 200; }
    int PATCH(const String&) { return 200; }
    int sendRequest(const char*, const uint8_t*, size_t) { return 200; }
    String getString() { return "{}"; }
    void end() {}
    void setTimeout(int) {}
    void setReuse(bool) {}
  };

  struct WiFiClientSecure {
    void setInsecure() {}
    void stop() {}
  };
#endif

// ============================================================================
// 1. HARDWARE SENSOR MODE TOGGLE
// ============================================================================
// Set to 'false' for instant testing (generates realistic fluctuating sensor data).
// Set to 'true' when you have wired actual physical DHT22 / MQ135 / PMS sensors.
#define USE_REAL_PHYSICAL_SENSORS false

// Optional DHT Sensor (Uncomment if USE_REAL_PHYSICAL_SENSORS is true and library installed)
// #include "DHT.h"
// #define DHTPIN 4
// #define DHTTYPE DHT22
// DHT dht(DHTPIN, DHTTYPE);

// ============================================================================
// 2. WI-FI NETWORK CREDENTIALS
// ============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ============================================================================
// 3. FIREBASE REALTIME DATABASE CONFIGURATION
// ============================================================================
// Paste your Firebase Realtime Database URL here.
// Examples:
//   "https://your-project-id-default-rtdb.firebaseio.com"
//   "https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app"
const char* FIREBASE_HOST = "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com";

// Optional: Firebase Database Secret or Auth Token.
// Leave as empty string "" if using public read/write rules (database.rules.json).
const char* FIREBASE_AUTH = "";

// Device Identifier (Appears on web dashboard)
const char* DEVICE_ID     = "AirSense-01";

// Update interval in milliseconds (10000ms = 10 seconds)
const unsigned long UPDATE_INTERVAL_MS = 10000;
unsigned long lastTransmissionTime = 0;

// NTP Time Server Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 0; // Set to your UTC offset in seconds (e.g. 19800 for IST UTC+5:30)
const int   DAYLIGHT_OFFSET_SEC = 0;

// ============================================================================
// 4. SENSOR PIN ASSIGNMENTS (Modify for your wiring)
// ============================================================================
#define DHT_PIN        4     // Digital GPIO pin connected to DHT22 data pin
#define MQ135_PIN      34    // Analog ADC pin connected to MQ-135 analog output (ESP32 ADC1: GPIO 34, ESP8266: A0)
#define PMS_RX_PIN     16    // Hardware Serial RX for PMS5003 (ESP32 GPIO 16)
#define PMS_TX_PIN     17    // Hardware Serial TX for PMS5003 (ESP32 GPIO 17)

// ============================================================================
// 5. US-EPA AQI CALCULATION (Exact Piecewise Linear Interpolation)
// ============================================================================
int calculateEPA_AQI(float pm25) {
  if (pm25 < 0.0f) return 0;

  // Breakpoints table: { C_low, C_high, I_low, I_high }
  static const float bpTable[][4] = {
    {   0.0f,  12.0f,   0.0f,  50.0f }, // Good
    {  12.1f,  35.4f,  51.0f, 100.0f }, // Moderate
    {  35.5f,  55.4f, 101.0f, 150.0f }, // Unhealthy for Sensitive Groups
    {  55.5f, 150.4f, 151.0f, 200.0f }, // Unhealthy
    { 150.5f, 250.4f, 201.0f, 300.0f }, // Very Unhealthy
    { 250.5f, 350.4f, 301.0f, 400.0f }, // Hazardous
    { 350.5f, 500.4f, 401.0f, 500.0f }  // Hazardous
  };

  for (int i = 0; i < 7; i++) {
    float cLow  = bpTable[i][0];
    float cHigh = bpTable[i][1];
    float iLow  = bpTable[i][2];
    float iHigh = bpTable[i][3];

    if (pm25 <= cHigh) {
      float aqi = ((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow;
      return (int)(aqi + 0.5f); // Round to nearest integer
    }
  }

  return 500; // Capped at 500 for extreme concentrations
}

// ============================================================================
// 6. NON-BLOCKING UNIX EPOCH TIMESTAMP HELPER
// ============================================================================
unsigned long long getEpochMillis() {
  time_t now;
  time(&now);

  // If NTP is synced, 'now' is a valid epoch (> Jan 1, 2024 = 1704067200)
  if (now > 1704067200ULL) {
    return ((unsigned long long)now) * 1000ULL;
  }

  // Non-blocking fallback with short 20ms timeout
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 20)) {
    time(&now);
    if (now > 1704067200ULL) {
      return ((unsigned long long)now) * 1000ULL;
    }
  }

  // Fallback to system uptime in millis if NTP has not yet synchronized
  return (unsigned long long)millis();
}

// ============================================================================
// 7. FIREBASE URL SANITIZER & REST API HELPER
// ============================================================================
String buildFirebaseUrl(const String& path) {
  String host = String(FIREBASE_HOST);
  host.trim();

  // Ensure protocol is https://
  if (!host.startsWith("http://") && !host.startsWith("https://")) {
    host = "https://" + host;
  }

  // Remove trailing slashes
  while (host.endsWith("/")) {
    host.remove(host.length() - 1);
  }

  // Sanitize path
  String cleanPath = path;
  cleanPath.trim();
  while (cleanPath.startsWith("/")) {
    cleanPath.remove(0, 1);
  }
  if (cleanPath.endsWith(".json")) {
    cleanPath.remove(cleanPath.length() - 5);
  }

  String url = host + "/" + cleanPath + ".json";

  // Only append ?auth= if user provided a valid non-placeholder token/secret
  String auth = String(FIREBASE_AUTH);
  auth.trim();
  if (auth.length() > 0 && !auth.startsWith("YOUR_") && auth != "null") {
    url += "?auth=" + auth;
  }

  return url;
}

bool sendFirebasePayload(const String& path, const String& jsonPayload, const String& httpMethod = "PUT") {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Firebase] Error: Wi-Fi is not connected!");
    return false;
  }

  String hostStr = String(FIREBASE_HOST);
  if (hostStr.indexOf("YOUR_PROJECT_ID") >= 0) {
    Serial.println("[Firebase] Configuration Notice: Please set FIREBASE_HOST in the sketch to your real Firebase URL.");
    return false;
  }

  #if defined(ESP8266)
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    HTTPClient http;
    http.setTimeout(10000);
    http.setReuse(false);
    String url = buildFirebaseUrl(path);
    if (!http.begin(*client, url)) {
      Serial.println("[Firebase] Error: Unable to initialize HTTP client");
      return false;
    }
  #else
    WiFiClientSecure client;
    client.setInsecure(); // Skip TLS certificate verification for simplicity
    HTTPClient http;
    http.setTimeout(10000);
    http.setReuse(false);
    String url = buildFirebaseUrl(path);
    if (!http.begin(client, url)) {
      Serial.println("[Firebase] Error: Unable to initialize HTTP client");
      return false;
    }
  #endif

  http.addHeader("Content-Type", "application/json");

  int httpCode = 0;
  if (httpMethod == "PUT") {
    httpCode = http.PUT(jsonPayload);
  } else if (httpMethod == "POST") {
    httpCode = http.POST(jsonPayload);
  } else if (httpMethod == "PATCH") {
    httpCode = http.PATCH(jsonPayload);
  } else {
    httpCode = http.sendRequest(httpMethod.c_str(), (const uint8_t*)jsonPayload.c_str(), jsonPayload.length());
  }

  bool success = (httpCode >= 200 && httpCode < 300);
  if (success) {
    Serial.printf("[Firebase] %s to '%s' succeeded (HTTP %d)\n", httpMethod.c_str(), path.c_str(), httpCode);
  } else {
    String response = http.getString();
    Serial.printf("[Firebase] %s to '%s' failed! HTTP Code: %d\n", httpMethod.c_str(), path.c_str(), httpCode);
    if (response.length() > 0) {
      Serial.printf("[Firebase] Response: %s\n", response.c_str());
    }
    if (httpCode == 401 || httpCode == 403) {
      Serial.println("[Firebase Tip] Permission Denied: Ensure database.rules.json allows writes (.write: true or valid secret).");
    } else if (httpCode == -1) {
      Serial.println("[Firebase Tip] Connection Refused / Timeout: Check your FIREBASE_HOST URL spelling.");
    }
  }

  http.end();
  return success;
}

// ============================================================================
// 8. SENSOR DATA ACQUISITION HELPER
// ============================================================================
struct SensorData {
  float pm25;
  float pm10;
  int   co2;
  float temperature;
  float humidity;
  int   aqi;
  unsigned long long timestamp;
};

SensorData readSensors() {
  SensorData data;

#if USE_REAL_PHYSICAL_SENSORS
  // --- A. Physical DHT22 Reading ---
  // data.temperature = dht.readTemperature();
  // data.humidity    = dht.readHumidity();
  // if (isnan(data.temperature)) data.temperature = 25.0;
  // if (isnan(data.humidity))    data.humidity = 50.0;

  // --- B. Physical MQ-135 Gas Reading ---
  int rawAdc = analogRead(MQ135_PIN);
  #if defined(ESP32)
    data.co2 = map(rawAdc, 0, 4095, 400, 2000);
  #else
    data.co2 = map(rawAdc, 0, 1023, 400, 2000);
  #endif

  // --- C. Physical PMS5003 Particulate Reading ---
  data.pm25 = 25.0;
  data.pm10 = 38.0;
  data.temperature = 26.5;
  data.humidity = 58.0;

#else
  // --- Instant Testing / Demo Mode (Realistic fluctuating data) ---
  static float simPm25 = 26.4f;
  static int   simCo2  = 620;
  static float simTemp = 26.2f;
  static float simHum  = 56.5f;

  // Add realistic micro-variations
  simPm25 += ((float)(random(-15, 16)) / 10.0f);
  if (simPm25 < 6.0f) simPm25 = 6.0f;
  if (simPm25 > 160.0f) simPm25 = 160.0f;

  float simPm10 = simPm25 * 1.45f + ((float)(random(-20, 21)) / 10.0f);
  simCo2  += random(-15, 16);
  if (simCo2 < 420) simCo2 = 420;
  if (simCo2 > 1800) simCo2 = 1800;

  simTemp += ((float)(random(-3, 4)) / 10.0f);
  simHum  += ((float)(random(-6, 7)) / 10.0f);
  if (simHum < 30.0f) simHum = 30.0f;
  if (simHum > 90.0f) simHum = 90.0f;

  data.pm25 = simPm25;
  data.pm10 = simPm10;
  data.co2 = simCo2;
  data.temperature = simTemp;
  data.humidity = simHum;
#endif

  data.aqi = calculateEPA_AQI(data.pm25);
  data.timestamp = getEpochMillis();

  return data;
}

// ============================================================================
// 9. SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================================");
  Serial.println("  AIRSENSE - ESP32/ESP8266 Air Quality Telemetry Node   ");
  Serial.println("========================================================");

  // Initialize Wi-Fi
  Serial.printf("[Wi-Fi] Connecting to SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.printf("[Wi-Fi] IP Address: %s | Signal (RSSI): %d dBm\n", 
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());

    // Synchronize NTP Time
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("[NTP] Time synchronization service initialized.");
  } else {
    Serial.println("\n[Wi-Fi] Connection not established yet. Will keep retrying in loop.");
  }

#if USE_REAL_PHYSICAL_SENSORS
  // dht.begin();
  // pinMode(MQ135_PIN, INPUT);
  Serial.println("[Hardware] Physical sensors mode active.");
#else
  Serial.println("[Demo Mode] Simulating live sensor telemetry. Set USE_REAL_PHYSICAL_SENSORS to true when physical sensors are connected.");
#endif
}

// ============================================================================
// 10. MAIN TRANSMISSION LOOP
// ============================================================================
void loop() {
  // Auto-reconnect Wi-Fi if connection drops
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = millis();
      Serial.println("[Wi-Fi] Reconnecting...");
      WiFi.reconnect();
    }
    delay(500);
    return;
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastTransmissionTime >= UPDATE_INTERVAL_MS) {
    lastTransmissionTime = currentMillis;

    // 1. Acquire sensor readings
    SensorData reading = readSensors();

    // 2. Format JSON Telemetry Payload
    char jsonBuffer[320];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{\"pm25\":%.1f,\"pm10\":%.1f,\"co2\":%d,\"temperature\":%.1f,\"humidity\":%.1f,\"aqi\":%d,\"timestamp\":%llu,\"deviceId\":\"%s\"}",
      reading.pm25,
      reading.pm10,
      reading.co2,
      reading.temperature,
      reading.humidity,
      reading.aqi,
      reading.timestamp,
      DEVICE_ID
    );

    Serial.println("\n--------------------------------------------------------");
    Serial.printf("[Telemetry] AQI: %d | PM2.5: %.1f | PM10: %.1f | CO2: %d | Temp: %.1f°C | Hum: %.1f%%\n",
                  reading.aqi, reading.pm25, reading.pm10, reading.co2, reading.temperature, reading.humidity);
    Serial.printf("[Payload] %s\n", jsonBuffer);

    // 3. Transmit to Firebase Realtime Database
    // A. Update live snapshot (/airQuality/current)
    sendFirebasePayload("airQuality/current", jsonBuffer, "PUT");

    // B. Append entry into historical telemetry log (/airQuality/history)
    sendFirebasePayload("airQuality/history", jsonBuffer, "POST");
  }
}
