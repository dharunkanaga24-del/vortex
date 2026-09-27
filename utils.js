/**
 * Utility functions for AirSense Dashboard:
 * Data validation, timestamp formatting, unit conversion, and UI alerts.
 */

/**
 * Validates and sanitizes numeric values from Firebase or sensor packets.
 * Returns formatted number or null if invalid/non-numeric.
 * 
 * @param {any} value - Raw value from database
 * @param {number|null} decimals - Optional number of decimal places to round to
 * @returns {number|null} Safe finite number or null
 */
export function safeNumber(value, decimals = null) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (decimals !== null && Number.isInteger(decimals)) {
    return Number(num.toFixed(decimals));
  }
  return num;
}

/**
 * Normalizes timestamp into a valid JavaScript Date object or null.
 * Supports Unix timestamps in seconds (10 digits), milliseconds (13 digits), or ISO string.
 * 
 * @param {any} rawTime - Timestamp from sensor
 * @returns {Date|null}
 */
export function parseTimestamp(rawTime) {
  if (!rawTime) return null;
  if (rawTime instanceof Date) return isNaN(rawTime.getTime()) ? null : rawTime;

  // If numeric
  const num = Number(rawTime);
  if (Number.isFinite(num)) {
    // Check if seconds vs milliseconds
    if (num < 10000000000) {
      return new Date(num * 1000); // Convert seconds to ms
    }
    return new Date(num);
  }

  // If string (ISO or date string)
  const parsed = new Date(rawTime);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a Date into a human-readable local time string (e.g., "20:42:31" or "08:42:31 PM").
 * 
 * @param {Date|number|string} date 
 * @param {boolean} includeSeconds
 * @returns {string}
 */
export function formatTime(date, includeSeconds = true) {
  const d = parseTimestamp(date);
  if (!d) return '--:--:--';
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false
  });
}

/**
 * Formats a Date into a full readable date and time string (e.g., "Sep 27, 2026, 20:42:31").
 * 
 * @param {Date|number|string} date 
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = parseTimestamp(date);
  if (!d) return 'N/A';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Generates relative time string (e.g., "5 seconds ago", "2 minutes ago", "Just now").
 * 
 * @param {Date|number|string} date 
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const d = parseTimestamp(date);
  if (!d) return 'Never';
  
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 3) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

/**
 * Temperature conversion from Celsius to Fahrenheit if preferred.
 * 
 * @param {number} celsius 
 * @param {string} unit "°C" or "°F"
 * @returns {number}
 */
export function convertTemperature(celsius, unit = "°C") {
  if (celsius === null || celsius === undefined) return null;
  if (unit === "°F") {
    return Number(((celsius * 9) / 5 + 32).toFixed(1));
  }
  return Number(celsius.toFixed(1));
}

/**
 * Displays a lightweight toast notification on the dashboard.
 * 
 * @param {string} message 
 * @param {"success"|"warning"|"error"|"info"} type 
 * @param {number} durationMs 
 */
export function showToast(message, type = "info", durationMs = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, durationMs);
}

/**
 * Escapes HTML characters to prevent XSS.
 * 
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
