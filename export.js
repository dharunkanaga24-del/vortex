/**
 * CSV Exporter for Historical Air Quality Data
 * Generates and triggers browser download of RFC4180-compliant CSV files.
 */

import { formatDateTime, safeNumber, showToast } from './utils.js';

/**
 * Converts readings dataset into CSV and downloads it.
 * @param {Array<object>} records 
 * @param {string} filenamePrefix 
 */
export function exportToCsv(records = [], filenamePrefix = "airsense_air_quality_data") {
  if (!records || records.length === 0) {
    showToast("No historical data available to export.", "warning");
    return;
  }

  // CSV Header
  const headers = [
    "Timestamp (ISO)",
    "Local Date Time",
    "AQI",
    "PM2.5 (ug/m3)",
    "PM10 (ug/m3)",
    "CO2 (ppm)",
    "Temperature (C)",
    "Humidity (%)",
    "Device ID"
  ];

  // CSV Rows
  const rows = records.map(item => {
    const rawDate = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp || Date.now());
    const isoString = isNaN(rawDate.getTime()) ? 'N/A' : rawDate.toISOString();
    const localFormatted = formatDateTime(rawDate);

    const aqi = safeNumber(item.aqi, 0) ?? '';
    const pm25 = safeNumber(item.pm25, 2) ?? '';
    const pm10 = safeNumber(item.pm10, 2) ?? '';
    const co2 = safeNumber(item.co2, 0) ?? '';
    const temp = safeNumber(item.temperature, 2) ?? '';
    const hum = safeNumber(item.humidity, 2) ?? '';
    const deviceId = item.deviceId ? `"${String(item.deviceId).replace(/"/g, '""')}"` : '"AirSense-01"';

    return [
      `"${isoString}"`,
      `"${localFormatted.replace(/"/g, '""')}"`,
      aqi,
      pm25,
      pm10,
      co2,
      temp,
      hum,
      deviceId
    ].join(',');
  });

  const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exported ${records.length} readings to CSV!`, "success");
}
