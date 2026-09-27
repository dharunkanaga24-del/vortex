/**
 * Firebase Integration Module
 * Supports both Firebase Realtime Database (RTDB) and Cloud Firestore
 * with real-time listeners, network health monitoring, and data normalization.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  off,
  query as rtdbQuery,
  limitToLast as rtdbLimitToLast,
  orderByChild as rtdbOrderByChild
} from 'firebase/database';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  query as fsQuery,
  orderBy as fsOrderBy,
  limit as fsLimit
} from 'firebase/firestore';

import {
  firebaseConfig,
  DATABASE_TYPE,
  FIREBASE_PATHS,
  SENSOR_FIELDS,
  isFirebaseConfigured
} from './config.js';

import { safeNumber, parseTimestamp } from './utils.js';
import { calculateAqiFromPm25 } from './aqi-calculator.js';

export class FirebaseService {
  constructor(callbacks = {}) {
    this.onConnectionChange = callbacks.onConnectionChange || (() => {});
    this.onCurrentReading = callbacks.onCurrentReading || (() => {});
    this.onHistoryReadings = callbacks.onHistoryReadings || (() => {});
    this.onError = callbacks.onError || (() => {});

    this.app = null;
    this.rtdb = null;
    this.firestore = null;
    this.isConnected = false;
    this.activeListeners = [];
  }

  /**
   * Initializes Firebase and starts realtime listeners.
   */
  async init() {
    if (!isFirebaseConfigured()) {
      this.onConnectionChange(false, "CONFIG_MISSING");
      return false;
    }

    try {
      this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

      if (DATABASE_TYPE === 'firestore') {
        this.firestore = getFirestore(this.app);
        this.startFirestoreListeners();
      } else {
        // Default to Realtime Database
        this.rtdb = getDatabase(this.app);
        this.startRtdbListeners();
      }

      return true;
    } catch (err) {
      console.error("[AirSense Firebase Init Error]", err);
      this.onConnectionChange(false, "INIT_ERROR");
      this.onError(err);
      return false;
    }
  }

  /**
   * Normalizes arbitrary database payload into standard AirSense model
   * using configurable SENSOR_FIELDS mappings.
   */
  normalizeSensorData(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const pm25Val = raw[SENSOR_FIELDS.pm25] ?? raw.pm25 ?? raw.pm2_5;
    const pm10Val = raw[SENSOR_FIELDS.pm10] ?? raw.pm10;
    const co2Val = raw[SENSOR_FIELDS.co2] ?? raw.co2 ?? raw.eco2;
    const tempVal = raw[SENSOR_FIELDS.temperature] ?? raw.temperature ?? raw.temp;
    const humVal = raw[SENSOR_FIELDS.humidity] ?? raw.humidity ?? raw.hum;
    const aqiVal = raw[SENSOR_FIELDS.aqi] ?? raw.aqi;
    const rawTime = raw[SENSOR_FIELDS.timestamp] ?? raw.timestamp ?? raw.time ?? raw.createdAt;
    const deviceId = raw[SENSOR_FIELDS.deviceId] ?? raw.deviceId ?? raw.device_id ?? "AirSense-01";

    const pm25 = safeNumber(pm25Val, 1);
    const pm10 = safeNumber(pm10Val, 1);
    const co2 = safeNumber(co2Val, 0);
    const temperature = safeNumber(tempVal, 1);
    const humidity = safeNumber(humVal, 1);
    let aqi = safeNumber(aqiVal, 0);

    // If device did not send AQI but PM2.5 is available, calculate EPA AQI automatically
    if (aqi === null && pm25 !== null) {
      aqi = calculateAqiFromPm25(pm25);
    }

    const timestamp = parseTimestamp(rawTime) || new Date();

    return {
      pm25,
      pm10,
      co2,
      temperature,
      humidity,
      aqi,
      timestamp,
      deviceId: String(deviceId || 'AirSense-01')
    };
  }

  /**
   * Setup Realtime Database (RTDB) listeners
   */
  startRtdbListeners() {
    if (!this.rtdb) return;

    // 1. Monitor socket connection status (.info/connected)
    const connectedRef = ref(this.rtdb, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      const connected = snap.val() === true;
      this.isConnected = connected;
      this.onConnectionChange(connected, connected ? "CONNECTED" : "DISCONNECTED");
    }, (err) => {
      console.warn("[RTDB Connection Status Error]", err);
      this.onConnectionChange(false, "DISCONNECTED");
    });
    this.activeListeners.push(() => off(connectedRef));

    // 2. Realtime listener for Current Reading
    const currentRef = ref(this.rtdb, FIREBASE_PATHS.current);
    const unsubscribeCurrent = onValue(currentRef, (snap) => {
      if (snap.exists()) {
        const raw = snap.val();
        const normalized = this.normalizeSensorData(raw);
        if (normalized) {
          this.onCurrentReading(normalized);
        }
      } else {
        this.onCurrentReading(null);
      }
    }, (err) => {
      console.error("[RTDB Current Reading Error]", err);
      this.onError(err);
    });
    this.activeListeners.push(() => off(currentRef));

    // 3. Listener for Historical Logs
    const historyRef = ref(this.rtdb, FIREBASE_PATHS.history);
    const historyQuery = rtdbQuery(historyRef, rtdbLimitToLast(200));
    const unsubscribeHistory = onValue(historyQuery, (snap) => {
      if (snap.exists()) {
        const rawObj = snap.val();
        const records = [];
        
        if (Array.isArray(rawObj)) {
          rawObj.forEach(item => {
            const norm = this.normalizeSensorData(item);
            if (norm) records.push(norm);
          });
        } else if (typeof rawObj === 'object') {
          Object.keys(rawObj).forEach(key => {
            const item = rawObj[key];
            const norm = this.normalizeSensorData(item);
            if (norm) {
              norm._id = key;
              records.push(norm);
            }
          });
        }
        this.onHistoryReadings(records);
      } else {
        this.onHistoryReadings([]);
      }
    }, (err) => {
      console.error("[RTDB History Reading Error]", err);
      this.onError(err);
    });
    this.activeListeners.push(() => off(historyRef));
  }

  /**
   * Setup Cloud Firestore listeners
   */
  startFirestoreListeners() {
    if (!this.firestore) return;

    // 1. Current reading document listener
    try {
      const currentDocRef = doc(this.firestore, FIREBASE_PATHS.current);
      const unsubCurrent = onSnapshot(currentDocRef, (snap) => {
        this.isConnected = true;
        this.onConnectionChange(true, "CONNECTED");

        if (snap.exists()) {
          const raw = snap.data();
          const norm = this.normalizeSensorData(raw);
          this.onCurrentReading(norm);
        } else {
          this.onCurrentReading(null);
        }
      }, (err) => {
        console.error("[Firestore Current Doc Error]", err);
        this.isConnected = false;
        this.onConnectionChange(false, "DISCONNECTED");
        this.onError(err);
      });
      this.activeListeners.push(unsubCurrent);

      // 2. History collection listener
      const historyColRef = collection(this.firestore, FIREBASE_PATHS.history);
      const historyQuery = fsQuery(
        historyColRef,
        fsOrderBy(SENSOR_FIELDS.timestamp, 'desc'),
        fsLimit(200)
      );

      const unsubHistory = onSnapshot(historyQuery, (snap) => {
        const records = [];
        snap.forEach(docSnap => {
          const raw = docSnap.data();
          const norm = this.normalizeSensorData(raw);
          if (norm) {
            norm._id = docSnap.id;
            records.push(norm);
          }
        });
        this.onHistoryReadings(records);
      }, (err) => {
        console.error("[Firestore History Col Error]", err);
        this.onError(err);
      });
      this.activeListeners.push(unsubHistory);
    } catch (err) {
      console.error("[Firestore Listener Init Error]", err);
      this.onError(err);
    }
  }

  /**
   * Clean up all active listeners.
   */
  cleanup() {
    this.activeListeners.forEach(unsub => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.warn("Error cleaning up listener", e);
      }
    });
    this.activeListeners = [];
  }
}
