/**
 * Circular AQI Gauge with Smooth Dynamic Animations
 * High-DPI Canvas-based radial gauge with easing and glow effects.
 */

import { getAqiLevel } from './aqi-calculator.js';

export class AqiGauge {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {object} options 
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      maxVal: 500,
      startAngle: 0.75 * Math.PI, // 135 deg
      endAngle: 2.25 * Math.PI,   // 405 deg (270 deg sweep)
      lineWidth: 18,
      animationDuration: 850, // ms
      ...options
    };

    this.currentAqi = null;
    this.displayAqi = 0;
    this.targetAqi = 0;
    this.animationStart = 0;
    this.initialAqi = 0;
    this.animating = false;

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual canvas pixel size
    this.canvas.width = (rect.width || 280) * dpr;
    this.canvas.height = (rect.height || 280) * dpr;
    
    this.dpr = dpr;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    this.draw(this.displayAqi);
  }

  /**
   * Updates gauge to a new AQI target value with smooth tweening.
   * @param {number|null} newAqi 
   */
  setAqi(newAqi) {
    if (newAqi === null || newAqi === undefined || isNaN(newAqi)) {
      this.currentAqi = null;
      this.targetAqi = 0;
      this.draw(null);
      return;
    }

    const clamped = Math.max(0, Math.min(this.options.maxVal, Number(newAqi)));
    this.currentAqi = clamped;
    this.initialAqi = this.displayAqi;
    this.targetAqi = clamped;
    this.animationStart = performance.now();

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(this.animate.bind(this));
    }
  }

  animate(currentTime) {
    const elapsed = currentTime - this.animationStart;
    const progress = Math.min(1, elapsed / this.options.animationDuration);
    
    // Cubic ease out
    const ease = 1 - Math.pow(1 - progress, 3);
    this.displayAqi = this.initialAqi + (this.targetAqi - this.initialAqi) * ease;

    this.draw(this.displayAqi);

    if (progress < 1) {
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.displayAqi = this.targetAqi;
      this.draw(this.displayAqi);
      this.animating = false;
    }
  }

  draw(val) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr || 1;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2 + 10 * dpr;
    const radius = Math.min(w, h) / 2 - (this.options.lineWidth * dpr * 1.5);
    const startAngle = this.options.startAngle;
    const endAngle = this.options.endAngle;
    const totalSweep = endAngle - startAngle;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const trackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    // 1. Draw Background Track Arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = this.options.lineWidth * dpr;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // If no data
    if (val === null || val === undefined) {
      // Draw dashed empty state
      return;
    }

    // 2. Draw Active Value Arc
    const aqiRatio = Math.min(1, Math.max(0, val / this.options.maxVal));
    const activeSweep = totalSweep * aqiRatio;
    const currentAngle = startAngle + activeSweep;

    const aqiInfo = getAqiLevel(val);
    const arcColor = aqiInfo.color;

    if (activeSweep > 0.001) {
      ctx.save();
      // Add subtle glow
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 12 * dpr;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, currentAngle, false);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = this.options.lineWidth * dpr;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // 3. Draw glowing tip marker
      const tipX = centerX + Math.cos(currentAngle) * radius;
      const tipY = centerY + Math.sin(currentAngle) * radius;

      ctx.save();
      ctx.beginPath();
      ctx.arc(tipX, tipY, (this.options.lineWidth * dpr) / 2.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 14 * dpr;
      ctx.fill();
      ctx.restore();
    }

    // 4. Subtle scale tick marks
    const ticks = [0, 50, 100, 150, 200, 300, 500];
    ctx.save();
    ticks.forEach(tVal => {
      const tRatio = tVal / this.options.maxVal;
      const tAngle = startAngle + totalSweep * tRatio;
      const innerR = radius - (this.options.lineWidth * dpr * 0.9);
      const outerR = radius - (this.options.lineWidth * dpr * 0.6);

      const x1 = centerX + Math.cos(tAngle) * innerR;
      const y1 = centerY + Math.sin(tAngle) * innerR;
      const x2 = centerX + Math.cos(tAngle) * outerR;
      const y2 = centerY + Math.sin(tAngle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    });
    ctx.restore();
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}
