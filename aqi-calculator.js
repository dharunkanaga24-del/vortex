/**
 * AQI Calculator and Categorizer
 * Standard AQI ranges, color codes, health descriptions, and standard US-EPA fallback calculation.
 */

export const AQI_LEVELS = [
  {
    min: 0,
    max: 50,
    category: "Good",
    levelClass: "aqi-good",
    color: "#22C55E", // Green
    bgLight: "rgba(34, 197, 94, 0.12)",
    textColor: "#15803d",
    description: "Air quality is satisfactory, and air pollution poses little or no risk.",
    recommendation: "Great day for outdoor activities, sports, and fresh air ventilation."
  },
  {
    min: 51,
    max: 100,
    category: "Moderate",
    levelClass: "aqi-moderate",
    color: "#EAB308", // Yellow
    bgLight: "rgba(234, 179, 8, 0.12)",
    textColor: "#a16207",
    description: "Air quality is acceptable. However, there may be some risk for sensitive people.",
    recommendation: "Unusually sensitive individuals should consider limiting prolonged outdoor exertion."
  },
  {
    min: 101,
    max: 150,
    category: "Unhealthy for Sensitive Groups",
    shortCategory: "Unhealthy (Sensitive)",
    levelClass: "aqi-sensitive",
    color: "#F97316", // Orange
    bgLight: "rgba(249, 115, 22, 0.12)",
    textColor: "#c2410c",
    description: "Members of sensitive groups may experience health effects. The general public is less likely to be affected.",
    recommendation: "Children, elderly, and people with respiratory or heart conditions should reduce outdoor exertion."
  },
  {
    min: 151,
    max: 200,
    category: "Unhealthy",
    levelClass: "aqi-unhealthy",
    color: "#EF4444", // Red
    bgLight: "rgba(239, 68, 68, 0.12)",
    textColor: "#b91c1c",
    description: "Everyone may begin to experience health effects; sensitive groups may experience more serious effects.",
    recommendation: "Wear a mask outdoors. Sensitive groups should avoid outdoor activities. Keep windows closed."
  },
  {
    min: 201,
    max: 300,
    category: "Very Unhealthy",
    levelClass: "aqi-very-unhealthy",
    color: "#8B5CF6", // Purple
    bgLight: "rgba(139, 92, 246, 0.12)",
    textColor: "#6d28d9",
    description: "Health alert: The risk of health effects is increased for everyone.",
    recommendation: "Avoid prolonged outdoor exertion. Use air purifiers indoors and keep doors/windows sealed."
  },
  {
    min: 301,
    max: 9999,
    category: "Hazardous",
    levelClass: "aqi-hazardous",
    color: "#881337", // Maroon / Dark Purple
    bgLight: "rgba(136, 19, 55, 0.15)",
    textColor: "#881337",
    description: "Health warning of emergency conditions: The entire population is more likely to be affected.",
    recommendation: "Stay indoors with air filtration on high. Strictly avoid all outdoor exertion."
  }
];

/**
 * Returns AQI Level meta information for a given numerical AQI.
 * 
 * @param {number|null} aqi 
 * @returns {object}
 */
export function getAqiLevel(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) {
    return {
      category: "No Data",
      shortCategory: "No Data",
      levelClass: "aqi-nodata",
      color: "#94A3B8",
      bgLight: "rgba(148, 163, 184, 0.1)",
      textColor: "#64748B",
      description: "Waiting for sensor readings from Arduino/Firebase...",
      recommendation: "Ensure your hardware device is powered and connected to Wi-Fi."
    };
  }

  const val = Math.max(0, Math.round(aqi));
  const level = AQI_LEVELS.find(lvl => val >= lvl.min && val <= lvl.max);
  return level || AQI_LEVELS[AQI_LEVELS.length - 1];
}

/**
 * Optional EPA standard formula to calculate AQI from PM2.5 if device does not provide raw AQI.
 * 
 * @param {number} pm25 in ug/m3
 * @returns {number|null}
 */
export function calculateAqiFromPm25(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) return null;
  const c = Math.max(0, Number(pm25));

  const breakpoints = [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 }
  ];

  for (const bp of breakpoints) {
    if (c >= bp.cLow && c <= bp.cHigh) {
      const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  if (c > 500.4) return 500;
  return 0;
}
