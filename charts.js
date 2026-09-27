/**
 * Chart.js Integration for AirSense Dashboard
 * Handles 4 specialized sensor graphs, responsive resizing, dark/light themes, and time range filtering.
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  CategoryScale
} from 'chart.js';

import { formatTime, formatDateTime } from './utils.js';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

export class DashboardCharts {
  constructor() {
    this.charts = {
      aqi: null,
      particulates: null,
      co2: null,
      climate: null
    };
    this.rawHistoryData = [];
    this.activeFilter = '24h'; // '1h' | '6h' | '24h' | '7d' | '30d' | 'all'
  }

  /**
   * Initializes all 4 charts with the canvas elements.
   * @param {object} canvasMap { aqiCanvas, particulatesCanvas, co2Canvas, climateCanvas }
   */
  init(canvasMap) {
    this.canvasMap = canvasMap;
    const theme = this.getThemeColors();

    // 1. AQI History Chart
    if (canvasMap.aqiCanvas) {
      this.charts.aqi = new Chart(canvasMap.aqiCanvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Air Quality Index (AQI)',
              data: [],
              borderColor: '#2563EB',
              backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 250);
                gradient.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
                gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
                return gradient;
              },
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 6,
              pointBackgroundColor: '#2563EB'
            }
          ]
        },
        options: this.getBaseOptions('AQI', theme, { min: 0 })
      });
    }

    // 2. Particulates (PM2.5 & PM10) Chart
    if (canvasMap.particulatesCanvas) {
      this.charts.particulates = new Chart(canvasMap.particulatesCanvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'PM2.5 (µg/m³)',
              data: [],
              borderColor: '#06B6D4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2,
              tension: 0.35,
              fill: false,
              pointRadius: 3,
              pointHoverRadius: 6
            },
            {
              label: 'PM10 (µg/m³)',
              data: [],
              borderColor: '#F59E0B',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 2,
              tension: 0.35,
              fill: false,
              pointRadius: 3,
              pointHoverRadius: 6
            }
          ]
        },
        options: this.getBaseOptions('µg/m³', theme, { min: 0 })
      });
    }

    // 3. CO2 History Chart
    if (canvasMap.co2Canvas) {
      this.charts.co2 = new Chart(canvasMap.co2Canvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'CO₂ Concentration (ppm)',
              data: [],
              borderColor: '#8B5CF6',
              backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 250);
                gradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
                gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
                return gradient;
              },
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 6,
              pointBackgroundColor: '#8B5CF6'
            }
          ]
        },
        options: this.getBaseOptions('ppm', theme, { min: 350 })
      });
    }

    // 4. Climate (Temperature & Humidity) Dual Axis Chart
    if (canvasMap.climateCanvas) {
      this.charts.climate = new Chart(canvasMap.climateCanvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Temperature (°C)',
              data: [],
              borderColor: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderWidth: 2,
              tension: 0.35,
              yAxisID: 'yTemp',
              pointRadius: 3,
              pointHoverRadius: 6
            },
            {
              label: 'Humidity (%)',
              data: [],
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              tension: 0.35,
              yAxisID: 'yHum',
              pointRadius: 3,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              labels: { color: theme.textColor, font: { family: "'Inter', sans-serif", size: 12 } }
            },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipTitle,
              bodyColor: theme.tooltipBody,
              borderColor: theme.borderColor,
              borderWidth: 1,
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { color: theme.gridColor },
              ticks: { color: theme.textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              grid: { color: theme.gridColor },
              ticks: {
                color: '#EF4444',
                callback: (val) => `${val} °C`
              },
              title: {
                display: true,
                text: 'Temperature (°C)',
                color: '#EF4444',
                font: { size: 11, weight: 'bold' }
              }
            },
            yHum: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false }, // Avoid duplicate grid lines
              min: 0,
              max: 100,
              ticks: {
                color: '#10B981',
                callback: (val) => `${val} %`
              },
              title: {
                display: true,
                text: 'Humidity (%)',
                color: '#10B981',
                font: { size: 11, weight: 'bold' }
              }
            }
          }
        }
      });
    }
  }

  /**
   * Generates base responsive options for single-axis charts.
   */
  getBaseOptions(unitLabel, theme, scaleOverrides = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: { color: theme.textColor, font: { family: "'Inter', sans-serif", size: 12 } }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          borderColor: theme.borderColor,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += context.parsed.y + ' ' + unitLabel;
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            callback: (val) => `${val} ${unitLabel}`
          },
          ...scaleOverrides
        }
      }
    };
  }

  /**
   * Determines color tokens based on current dark/light mode.
   */
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94A3B8' : '#64748B',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
      tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
      tooltipTitle: isDark ? '#F8FAFC' : '#0F172A',
      tooltipBody: isDark ? '#CBD5E1' : '#334155'
    };
  }

  /**
   * Refreshes chart colors when switching between dark and light modes.
   */
  updateTheme() {
    const theme = this.getThemeColors();
    Object.values(this.charts).forEach(chart => {
      if (!chart) return;
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = theme.textColor;
      }
      if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
        chart.options.plugins.tooltip.titleColor = theme.tooltipTitle;
        chart.options.plugins.tooltip.bodyColor = theme.tooltipBody;
        chart.options.plugins.tooltip.borderColor = theme.borderColor;
      }
      if (chart.options.scales?.x?.grid) chart.options.scales.x.grid.color = theme.gridColor;
      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = theme.textColor;
      if (chart.options.scales?.y?.grid) chart.options.scales.y.grid.color = theme.gridColor;
      if (chart.options.scales?.y?.ticks) chart.options.scales.y.ticks.color = theme.textColor;
      chart.update('none');
    });
  }

  /**
   * Sets time filter (1h, 6h, 24h, 7d, 30d, all) and updates charts.
   */
  setTimeFilter(filterId) {
    this.activeFilter = filterId;
    this.renderHistory(this.rawHistoryData);
  }

  /**
   * Feeds historical dataset to all charts according to active filter.
   * @param {Array<object>} historyRecords 
   */
  renderHistory(historyRecords = []) {
    this.rawHistoryData = historyRecords;
    if (!historyRecords || historyRecords.length === 0) {
      this.clearCharts();
      return;
    }

    // Filter by timestamp
    const now = Date.now();
    let cutoffMs = 0;
    switch (this.activeFilter) {
      case '1h':
        cutoffMs = now - 1 * 60 * 60 * 1000;
        break;
      case '6h':
        cutoffMs = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        cutoffMs = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        cutoffMs = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
      default:
        cutoffMs = 0;
        break;
    }

    // Filter and sort chronologically (oldest to newest for charts)
    const filtered = historyRecords
      .filter(item => {
        if (!item.timestamp) return true;
        const timeVal = item.timestamp instanceof Date ? item.timestamp.getTime() : new Date(item.timestamp).getTime();
        return timeVal >= cutoffMs;
      })
      .sort((a, b) => {
        const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return tA - tB;
      });

    // Check if we have data after filter
    const emptyNotice = document.getElementById('charts-empty-notice');
    if (filtered.length === 0) {
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      this.clearCharts();
      return;
    } else {
      if (emptyNotice) emptyNotice.classList.add('hidden');
    }

    // Extract time labels & data series
    const isLongSpan = this.activeFilter === '7d' || this.activeFilter === '30d' || this.activeFilter === 'all';
    const labels = filtered.map(d => isLongSpan ? formatDateTime(d.timestamp) : formatTime(d.timestamp, false));

    const aqiData = filtered.map(d => d.aqi ?? null);
    const pm25Data = filtered.map(d => d.pm25 ?? null);
    const pm10Data = filtered.map(d => d.pm10 ?? null);
    const co2Data = filtered.map(d => d.co2 ?? null);
    const tempData = filtered.map(d => d.temperature ?? null);
    const humData = filtered.map(d => d.humidity ?? null);

    // Update AQI Chart
    if (this.charts.aqi) {
      this.charts.aqi.data.labels = labels;
      this.charts.aqi.data.datasets[0].data = aqiData;
      this.charts.aqi.update();
    }

    // Update Particulates Chart
    if (this.charts.particulates) {
      this.charts.particulates.data.labels = labels;
      this.charts.particulates.data.datasets[0].data = pm25Data;
      this.charts.particulates.data.datasets[1].data = pm10Data;
      this.charts.particulates.update();
    }

    // Update CO2 Chart
    if (this.charts.co2) {
      this.charts.co2.data.labels = labels;
      this.charts.co2.data.datasets[0].data = co2Data;
      this.charts.co2.update();
    }

    // Update Climate Chart
    if (this.charts.climate) {
      this.charts.climate.data.labels = labels;
      this.charts.climate.data.datasets[0].data = tempData;
      this.charts.climate.data.datasets[1].data = humData;
      this.charts.climate.update();
    }
  }

  clearCharts() {
    Object.values(this.charts).forEach(chart => {
      if (!chart) return;
      chart.data.labels = [];
      chart.data.datasets.forEach(ds => ds.data = []);
      chart.update();
    });
  }
}
