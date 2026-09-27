/**
 * AirSense Web Application Entry Point
 */

import './styles.css';
import { DashboardApp } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = new DashboardApp();
  app.init();
  window.AirSenseApp = app; // Expose for debugging if needed
});
