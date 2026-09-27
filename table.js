/**
 * Historical Data Table Component
 * Displays sensor logs with pagination, latest-first sorting, status badges, and mobile responsiveness.
 */

import { formatDateTime, safeNumber, escapeHtml } from './utils.js';
import { getAqiLevel } from './aqi-calculator.js';

export class HistoryTable {
  constructor(tableBodyEl, paginationEl) {
    this.tableBody = tableBodyEl;
    this.paginationContainer = paginationEl;
    this.data = [];
    this.currentPage = 1;
    this.pageSize = 10;
  }

  /**
   * Updates table dataset and resets to page 1 if data count changed.
   * @param {Array<object>} records 
   */
  setData(records = []) {
    // Sort newest first
    this.data = [...records].sort((a, b) => {
      const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
      const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    const maxPages = Math.ceil(this.data.length / this.pageSize) || 1;
    if (this.currentPage > maxPages) {
      this.currentPage = 1;
    }

    this.render();
  }

  setPage(pageNumber) {
    const maxPages = Math.ceil(this.data.length / this.pageSize) || 1;
    if (pageNumber < 1 || pageNumber > maxPages) return;
    this.currentPage = pageNumber;
    this.render();
  }

  setPageSize(newSize) {
    this.pageSize = Number(newSize) || 10;
    this.currentPage = 1;
    this.render();
  }

  render() {
    if (!this.tableBody) return;

    if (this.data.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty-message">
            <div class="empty-state-box">
              <span class="empty-icon">📊</span>
              <p>No historical readings found.</p>
              <small>Readings will appear here automatically when sent by your Arduino/ESP32.</small>
            </div>
          </td>
        </tr>
      `;
      if (this.paginationContainer) {
        this.paginationContainer.innerHTML = '';
      }
      return;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.data.length);
    const pageRecords = this.data.slice(startIndex, endIndex);

    let rowsHtml = '';
    pageRecords.forEach((item, index) => {
      const aqiNum = safeNumber(item.aqi, 0);
      const aqiInfo = getAqiLevel(aqiNum);
      const pm25 = safeNumber(item.pm25, 1);
      const pm10 = safeNumber(item.pm10, 1);
      const co2 = safeNumber(item.co2, 0);
      const temp = safeNumber(item.temperature, 1);
      const hum = safeNumber(item.humidity, 1);

      rowsHtml += `
        <tr class="table-row ${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="col-time" data-label="Time">
            <span class="time-formatted">${formatDateTime(item.timestamp)}</span>
          </td>
          <td class="col-aqi" data-label="AQI">
            <span class="aqi-badge ${aqiInfo.levelClass}" style="background-color: ${aqiInfo.bgLight}; color: ${aqiInfo.textColor}; border: 1px solid ${aqiInfo.color}">
              <strong>${aqiNum !== null ? aqiNum : '--'}</strong> ${escapeHtml(aqiInfo.shortCategory || aqiInfo.category)}
            </span>
          </td>
          <td class="col-pm25" data-label="PM2.5">
            ${pm25 !== null ? `${pm25} <span class="unit">µg/m³</span>` : '<span class="nodata">--</span>'}
          </td>
          <td class="col-pm10" data-label="PM10">
            ${pm10 !== null ? `${pm10} <span class="unit">µg/m³</span>` : '<span class="nodata">--</span>'}
          </td>
          <td class="col-co2" data-label="CO₂">
            ${co2 !== null ? `${co2} <span class="unit">ppm</span>` : '<span class="nodata">--</span>'}
          </td>
          <td class="col-temp" data-label="Temperature">
            ${temp !== null ? `${temp} <span class="unit">°C</span>` : '<span class="nodata">--</span>'}
          </td>
          <td class="col-humidity" data-label="Humidity">
            ${hum !== null ? `${hum} <span class="unit">%</span>` : '<span class="nodata">--</span>'}
          </td>
          <td class="col-status" data-label="Status">
            <span class="status-indicator-dot ${aqiNum && aqiNum > 150 ? 'dot-warning' : 'dot-good'}"></span>
            ${aqiNum && aqiNum > 150 ? 'Elevated' : 'Normal'}
          </td>
        </tr>
      `;
    });

    this.tableBody.innerHTML = rowsHtml;
    this.renderPagination();
  }

  renderPagination() {
    if (!this.paginationContainer) return;
    const totalPages = Math.ceil(this.data.length / this.pageSize) || 1;
    const current = this.currentPage;

    let paginationHtml = `
      <div class="pagination-info">
        Showing <strong>${(current - 1) * this.pageSize + 1}</strong> - 
        <strong>${Math.min(current * this.pageSize, this.data.length)}</strong> of 
        <strong>${this.data.length}</strong> readings
      </div>
      <div class="pagination-controls">
        <button class="btn-page btn-prev" id="btn-page-prev" ${current === 1 ? 'disabled' : ''}>
          &laquo; Prev
        </button>
        <span class="page-indicator">Page <strong>${current}</strong> of ${totalPages}</span>
        <button class="btn-page btn-next" id="btn-page-next" ${current === totalPages ? 'disabled' : ''}>
          Next &raquo;
        </button>
      </div>
    `;

    this.paginationContainer.innerHTML = paginationHtml;

    // Attach button listeners
    const prevBtn = document.getElementById('btn-page-prev');
    const nextBtn = document.getElementById('btn-page-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.setPage(this.currentPage - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.setPage(this.currentPage + 1));
    }
  }
}
