/**
 * Dashboard UI Controller for AirSense
 * Coordinates Firebase realtime stream, Gauge, Charts, History Table, and Themes.
 */

import { createIcons, icons } from 'lucide';
import { AqiGauge } from './gauge.js';
import { DashboardCharts } from './charts.js';
import { HistoryTable } from './table.js';
import { exportToCsv } from './export.js';
import { getAqiLevel } from './aqi-calculator.js';
import {
  safeNumber,
  formatTime,
  formatRelativeTime,
  showToast,
  escapeHtml
} from './utils.js';
import { DEVICE_CONFIG, isFirebaseConfigured, DATABASE_TYPE } from './config.js';
import { FirebaseService } from './firebase.js';
import { DeviceSimulator } from './simulator.js';

export class DashboardApp {
  constructor() {
    this.firebaseService = null;
    this.simulator = null;
    this.isSimulating = false;
    this.currentData = null;
    this.historyData = [];
    this.lastPacketTime = null;
    this.heartbeatTimer = null;

    this.initTheme();
  }

  init() {
    this.initElements();
    this.initIcons();
    this.initSubcomponents();
    this.bindEvents();
    this.startHeartbeatMonitor();
    this.bootstrapDataService();
  }

  initTheme() {
    const saved = localStorage.getItem('airsense_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('airsense_theme', next);

    if (this.charts) {
      this.charts.updateTheme();
    }
    if (this.gauge) {
      this.gauge.draw(this.currentData?.aqi ?? null);
    }
    this.initIcons();
  }

  initElements() {
    // Header status elements
    this.elConnectionDot = document.getElementById('conn-status-dot');
    this.elConnectionText = document.getElementById('conn-status-text');
    this.elDeviceDot = document.getElementById('device-status-dot');
    this.elDeviceText = document.getElementById('device-status-text');
    this.elLastUpdatedTime = document.getElementById('last-updated-time');
    this.elRelativeUpdated = document.getElementById('last-updated-relative');

    // Action buttons
    this.btnRefresh = document.getElementById('btn-refresh');
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnSetupGuide = document.getElementById('btn-setup-guide');
    this.btnToggleSim = document.getElementById('btn-toggle-sim');
    this.bannerNotice = document.getElementById('banner-notice');

    // Gauge and hero card
    this.gaugeCanvas = document.getElementById('aqi-gauge-canvas');
    this.elHeroAqiNumber = document.getElementById('hero-aqi-number');
    this.elHeroAqiStatus = document.getElementById('hero-aqi-status');
    this.elAdvisoryText = document.getElementById('aqi-advisory-text');

    // Sensor metric cards
    this.cardAqi = document.getElementById('card-aqi');
    this.cardPm25 = document.getElementById('card-pm25');
    this.cardPm10 = document.getElementById('card-pm10');
    this.cardCo2 = document.getElementById('card-co2');
    this.cardTemp = document.getElementById('card-temp');
    this.cardHum = document.getElementById('card-hum');

    this.valPm25 = document.getElementById('val-pm25');
    this.valPm10 = document.getElementById('val-pm10');
    this.valCo2 = document.getElementById('val-co2');
    this.valTemp = document.getElementById('val-temp');
    this.valHum = document.getElementById('val-hum');

    // Device details bar
    this.elDeviceName = document.getElementById('info-device-name');
    this.elDeviceInterval = document.getElementById('info-update-interval');
    this.elDeviceDb = document.getElementById('info-db-type');
    this.elDeviceLastSeen = document.getElementById('info-last-seen');

    // Setup Modal
    this.setupModal = document.getElementById('setup-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
  }

  initIcons() {
    createIcons({ icons });
  }

  initSubcomponents() {
    // 1. Initialize AQI Gauge
    if (this.gaugeCanvas) {
      this.gauge = new AqiGauge(this.gaugeCanvas);
    }

    // 2. Initialize Charts
    this.charts = new DashboardCharts();
    this.charts.init({
      aqiCanvas: document.getElementById('chart-aqi'),
      particulatesCanvas: document.getElementById('chart-particulates'),
      co2Canvas: document.getElementById('chart-co2'),
      climateCanvas: document.getElementById('chart-climate')
    });

    // 3. Initialize History Table
    const tableBody = document.getElementById('history-table-body');
    const paginationEl = document.getElementById('table-pagination');
    this.table = new HistoryTable(tableBody, paginationEl);

    // Initial Device Info
    if (this.elDeviceName) this.elDeviceName.textContent = DEVICE_CONFIG.defaultDeviceName;
    if (this.elDeviceInterval) this.elDeviceInterval.textContent = `${DEVICE_CONFIG.expectedUpdateIntervalSeconds}s`;
    if (this.elDeviceDb) this.elDeviceDb.textContent = DATABASE_TYPE.toUpperCase();
  }

  bindEvents() {
    // Theme Toggle
    if (this.btnThemeToggle) {
      this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Manual Refresh
    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', () => {
        this.btnRefresh.classList.add('rotating');
        setTimeout(() => this.btnRefresh.classList.remove('rotating'), 600);
        showToast("Refreshing Firebase listeners...", "info");
        this.bootstrapDataService();
      });
    }

    // CSV Export
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        exportToCsv(this.historyData);
      });
    }

    // Setup Guide Modal
    if (this.btnSetupGuide) {
      this.btnSetupGuide.addEventListener('click', () => this.openModal());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.closeModal());
    }
    if (this.setupModal) {
      this.setupModal.addEventListener('click', (e) => {
        if (e.target === this.setupModal) this.closeModal();
      });
    }

    // Simulator Toggle
    if (this.btnToggleSim) {
      this.btnToggleSim.addEventListener('click', () => this.toggleSimulation());
    }

    // Time filter buttons
    const filterButtons = document.querySelectorAll('.btn-filter');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterKey = btn.getAttribute('data-filter') || '24h';
        this.charts.setTimeFilter(filterKey);
      });
    });

    // Table page size selector if present
    const pageSizeSelect = document.getElementById('table-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.table.setPageSize(e.target.value);
      });
    }
  }

  openModal() {
    if (this.setupModal) {
      this.setupModal.classList.add('open');
    }
  }

  closeModal() {
    if (this.setupModal) {
      this.setupModal.classList.remove('open');
    }
  }

  /**
   * Main data service initiator: Real Firebase vs Simulated Hardware
   */
  bootstrapDataService() {
    const isConfigured = isFirebaseConfigured();

    if (!isConfigured) {
      this.showConfigNotice(true);
      // Auto-start simulation so user can view live charts immediately until keys are pasted
      this.startSimulation(true);
      return;
    }

    this.showConfigNotice(false);
    this.stopSimulation();
    this.initFirebase();
  }

  initFirebase() {
    if (this.firebaseService) {
      this.firebaseService.cleanup();
    }

    this.setConnectionStatus('connecting', 'Connecting to Firebase...');

    this.firebaseService = new FirebaseService({
      onConnectionChange: (connected, statusKey) => {
        if (connected) {
          this.setConnectionStatus('connected', 'Firebase Connected');
        } else {
          this.setConnectionStatus('disconnected', 'Firebase Disconnected');
        }
      },
      onCurrentReading: (reading) => {
        this.handleNewCurrentReading(reading);
      },
      onHistoryReadings: (records) => {
        this.handleHistoryReadings(records);
      },
      onError: (err) => {
        showToast("Firebase Error: " + (err?.message || "Check connection"), "error");
      }
    });

    this.firebaseService.init();
  }

  toggleSimulation() {
    if (this.isSimulating) {
      this.stopSimulation();
      showToast("Simulation stopped. Listening for real Firebase data.", "info");
      this.bootstrapDataService();
    } else {
      this.startSimulation(false);
      showToast("Demo Mode Active: Simulating live Arduino sensor telemetry.", "success");
    }
  }

  startSimulation(isAutoDemo = false) {
    if (this.isSimulating) return;
    this.isSimulating = true;

    if (this.firebaseService) {
      this.firebaseService.cleanup();
    }

    this.setConnectionStatus('connected', 'Demo / Simulator Active');

    if (!this.simulator) {
      this.simulator = new DeviceSimulator((newData) => {
        this.handleNewCurrentReading(newData);
        // Append to local history trace
        this.historyData.push(newData);
        if (this.historyData.length > 200) this.historyData.shift();
        this.charts.renderHistory(this.historyData);
        this.table.setData(this.historyData);
      });
    }

    // Seed 24h history
    this.historyData = this.simulator.generateHistory(48);
    this.charts.renderHistory(this.historyData);
    this.table.setData(this.historyData);

    // Initial current
    const latest = this.historyData[this.historyData.length - 1];
    this.handleNewCurrentReading(latest);

    // Start 4s tick
    this.simulator.start(4000);

    if (this.btnToggleSim) {
      this.btnToggleSim.textContent = "Stop Demo Mode";
      this.btnToggleSim.classList.add('btn-primary');
    }
  }

  stopSimulation() {
    if (!this.isSimulating) return;
    this.isSimulating = false;
    if (this.simulator) {
      this.simulator.stop();
    }
    if (this.btnToggleSim) {
      this.btnToggleSim.textContent = "Preview Demo Data";
      this.btnToggleSim.classList.remove('btn-primary');
    }
  }

  showConfigNotice(show) {
    if (this.bannerNotice) {
      if (show) {
        this.bannerNotice.classList.remove('hidden');
      } else {
        this.bannerNotice.classList.add('hidden');
      }
    }
  }

  setConnectionStatus(state, label) {
    if (this.elConnectionDot) {
      this.elConnectionDot.className = 'status-dot ' + (
        state === 'connected' ? 'connected' : state === 'connecting' ? 'warning' : 'disconnected'
      );
    }
    if (this.elConnectionText) {
      this.elConnectionText.textContent = label;
    }
  }

  setDeviceStatus(isOnline, label = null) {
    if (this.elDeviceDot) {
      this.elDeviceDot.className = 'status-dot ' + (isOnline ? 'connected' : 'disconnected');
    }
    if (this.elDeviceText) {
      this.elDeviceText.textContent = label || (isOnline ? 'Device Online' : 'Device Offline');
    }
  }

  /**
   * Handles incoming live sensor packet from Arduino/Firebase.
   */
  handleNewCurrentReading(data) {
    this.currentData = data;
    this.lastPacketTime = data && data.timestamp ? new Date(data.timestamp) : new Date();

    if (!data) {
      this.renderEmptyCurrentState();
      return;
    }

    // Trigger subtle card pulse animation
    this.triggerCardPulses();

    // 1. Update AQI & Hero Gauge
    const aqiVal = safeNumber(data.aqi, 0);
    const aqiInfo = getAqiLevel(aqiVal);

    if (this.gauge) {
      this.gauge.setAqi(aqiVal);
    }

    if (this.elHeroAqiNumber) {
      this.elHeroAqiNumber.textContent = aqiVal !== null ? aqiVal : '--';
      this.elHeroAqiNumber.style.color = aqiInfo.color;
    }

    if (this.elHeroAqiStatus) {
      this.elHeroAqiStatus.textContent = aqiInfo.category;
      this.elHeroAqiStatus.style.backgroundColor = aqiInfo.bgLight;
      this.elHeroAqiStatus.style.color = aqiInfo.textColor;
      this.elHeroAqiStatus.style.border = `1px solid ${aqiInfo.color}`;
    }

    if (this.elAdvisoryText) {
      this.elAdvisoryText.textContent = aqiInfo.recommendation;
    }

    // 2. Update Sensor Tiles
    const pm25 = safeNumber(data.pm25, 1);
    const pm10 = safeNumber(data.pm10, 1);
    const co2 = safeNumber(data.co2, 0);
    const temp = safeNumber(data.temperature, 1);
    const hum = safeNumber(data.humidity, 1);

    if (this.valPm25) this.valPm25.textContent = pm25 !== null ? pm25 : '--';
    if (this.valPm10) this.valPm10.textContent = pm10 !== null ? pm10 : '--';
    if (this.valCo2) this.valCo2.textContent = co2 !== null ? co2 : '--';
    if (this.valTemp) this.valTemp.textContent = temp !== null ? temp : '--';
    if (this.valHum) this.valHum.textContent = hum !== null ? hum : '--';

    // 3. Update Device Bar Info
    if (data.deviceId && this.elDeviceName) {
      this.elDeviceName.textContent = data.deviceId;
    }
    if (this.elDeviceLastSeen) {
      this.elDeviceLastSeen.textContent = formatTime(this.lastPacketTime);
    }

    this.updateTimestamps();
    this.setDeviceStatus(true, "Device Online");
  }

  renderEmptyCurrentState() {
    if (this.gauge) this.gauge.setAqi(null);
    if (this.elHeroAqiNumber) this.elHeroAqiNumber.textContent = '--';
    if (this.elHeroAqiStatus) {
      this.elHeroAqiStatus.textContent = 'Waiting for Data';
      this.elHeroAqiStatus.style.backgroundColor = 'rgba(148, 163, 184, 0.1)';
      this.elHeroAqiStatus.style.color = '#94A3B8';
      this.elHeroAqiStatus.style.border = '1px solid #94A3B8';
    }
    if (this.elAdvisoryText) {
      this.elAdvisoryText.textContent = 'Waiting for sensor data... Make sure your Arduino/ESP32 is connected and writing to Firebase.';
    }

    if (this.valPm25) this.valPm25.textContent = '--';
    if (this.valPm10) this.valPm10.textContent = '--';
    if (this.valCo2) this.valCo2.textContent = '--';
    if (this.valTemp) this.valTemp.textContent = '--';
    if (this.valHum) this.valHum.textContent = '--';
  }

  handleHistoryReadings(records) {
    this.historyData = records || [];
    this.charts.renderHistory(this.historyData);
    this.table.setData(this.historyData);
  }

  triggerCardPulses() {
    const cards = document.querySelectorAll('.sensor-card, .aqi-hero-card');
    cards.forEach(c => {
      c.classList.remove('data-updated');
      // Trigger reflow
      void c.offsetWidth;
      c.classList.add('data-updated');
    });
  }

  startHeartbeatMonitor() {
    // Update relative time display and heartbeat every second
    this.heartbeatTimer = setInterval(() => {
      this.updateTimestamps();
      this.checkDeviceHeartbeat();
    }, 1000);
  }

  updateTimestamps() {
    if (!this.lastPacketTime) {
      if (this.elLastUpdatedTime) this.elLastUpdatedTime.textContent = '--:--:--';
      if (this.elRelativeUpdated) this.elRelativeUpdated.textContent = 'Never';
      return;
    }

    if (this.elLastUpdatedTime) {
      this.elLastUpdatedTime.textContent = formatTime(this.lastPacketTime);
    }
    if (this.elRelativeUpdated) {
      this.elRelativeUpdated.textContent = formatRelativeTime(this.lastPacketTime);
    }
  }

  checkDeviceHeartbeat() {
    if (!this.lastPacketTime) {
      this.setDeviceStatus(false, "No Readings Yet");
      return;
    }

    const diffSec = (Date.now() - this.lastPacketTime.getTime()) / 1000;
    if (diffSec > DEVICE_CONFIG.offlineThresholdSeconds) {
      this.setDeviceStatus(false, `Device Offline (${Math.floor(diffSec)}s ago)`);
    } else {
      this.setDeviceStatus(true, "Device Online");
    }
  }
}
