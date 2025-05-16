// This file is being gradually refactored into a domain-driven architecture
// For now, we're re-exporting everything from the new main.ts file using CommonJS
const main = require('./main');

// Import Ridesharing domain functions
import {
  calculateMatchScore,
  optimizeRoute,
  // ... other existing imports
  
  // Import the new Radar.io webhook and geofence matching functions
  radarWebhook,
  processGeofenceMatch
} from './domains/ridesharing';

// Re-export all functions from main module
module.exports = main;

// Export Ridesharing functions
exports.calculateMatchScore = calculateMatchScore;
exports.optimizeRoute = optimizeRoute;
// ... other existing exports

// Export the new Radar.io webhook and geofence match processor functions
exports.radarWebhook = radarWebhook;
exports.processGeofenceMatch = processGeofenceMatch;