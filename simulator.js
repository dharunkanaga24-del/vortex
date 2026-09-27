/**
 * Hardware / Live Packet Simulator
 * Used for live testing & UI demonstration before physical Arduino/ESP32 is connected.
 */

import { calculateAqiFromPm25 } from './aqi-calculator.js';

export class DeviceSimulator {
  constructor(onDataCallback) {
    this.onDataCallback = onDataCallback;
    this.timerId = null;
    this.currentValues = {
      pm25: 28.4,
      pm10: 42.1,
      co2: 685,
      temperature: 26.8,
      humidity: 58.2,
      aqi: 68,
      timestamp: Date.now(),
      deviceId: "ESP32-DEMO"
    };
  }

  /**
   * Generates a realistic historical dataset for past 24 hours.
   */
  generateHistory(points = 60) {
    const records = [];
    const now = Date.now();
    const intervalMs = (24 * 60 * 60 * 1000) / points;

    let basePm25 = 25;
    let baseCo2 = 600;
    let baseTemp = 25.0;
    let baseHum = 55.0;

    for (let i = points; i >= 0; i--) {
      const time = now - i * intervalMs;
      // Add slight diurnal variations and noise
      const hourOfDay = new Date(time).getHours();
      const diurnalFactor = Math.sin((hourOfDay - 6) * (Math.PI / 12));

      const pm25 = Math.max(5, Number((basePm25 + diurnalFactor * 12 + (Math.random() * 8 - 4)).toFixed(1)));
      const pm10 = Math.max(pm25 + 5, Number((pm25 * 1.5 + (Math.random() * 6 - 3)).toFixed(1)));
      const co2 = Math.max(400, Math.round(baseCo2 + diurnalFactor * 120 + (Math.random() * 60 - 30)));
      const temp = Number((baseTemp + diurnalFactor * 3.5 + (Math.random() * 1.2 - 0.6)).toFixed(1));
      const hum = Number((baseHum - diurnalFactor * 8.0 + (Math.random() * 3.0 - 1.5)).toFixed(1));
      const aqi = calculateAqiFromPm25(pm25) || Math.round(pm25 * 1.8);

      records.push({
        pm25,
        pm10,
        co2,
        temperature: temp,
        humidity: hum,
        aqi,
        timestamp: new Date(time),
        deviceId: "ESP32-DEMO"
      });
    }

    return records;
  }

  /**
   * Starts periodic simulation updates every `intervalMs` ms.
   */
  start(intervalMs = 4000) {
    if (this.timerId) return;

    this.timerId = setInterval(() => {
      // Drift values slightly
      const pm25 = Math.max(8, Number((this.currentValues.pm25 + (Math.random() * 4 - 2)).toFixed(1)));
      const pm10 = Math.max(pm25 + 5, Number((pm25 * 1.45 + (Math.random() * 4 - 2)).toFixed(1)));
      const co2 = Math.max(420, Math.round(this.currentValues.co2 + (Math.random() * 20 - 10)));
      const temp = Number((this.currentValues.temperature + (Math.random() * 0.4 - 0.2)).toFixed(1));
      const hum = Math.min(95, Math.max(20, Number((this.currentValues.humidity + (Math.random() * 0.8 - 0.4)).toFixed(1))));
      const aqi = calculateAqiFromPm25(pm25) || Math.round(pm25 * 1.8);

      this.currentValues = {
        pm25,
        pm10,
        co2,
        temperature: temp,
        humidity: hum,
        aqi,
        timestamp: Date.now(),
        deviceId: "ESP32-DEMO"
      };

      if (this.onDataCallback) {
        this.onDataCallback(this.currentValues);
      }
    }, intervalMs);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
