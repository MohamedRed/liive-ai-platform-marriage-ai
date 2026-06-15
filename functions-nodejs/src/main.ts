import { initializeApp } from 'firebase-admin/app';
import { LEGACY_COLLECTIONS } from '@livve-1/database-types';

// We re-export these constants for backward compatibility
// during the transition to domain-specific databases
export { LEGACY_COLLECTIONS };

// Import domain-specific functions
import * as users from './domains/users';
import * as marriage from './domains/marriage';
import * as identityVerification from './domains/identity-verification';
// Import meal planning functions using CommonJS require
const mealPlanning = require('./domains/meal-planning/meal-plan');
// Import test function
const testFunction = require('./domains/meal-planning/test-function');
// Import super minimal test function
const superMinimalTest = require('./domains/meal-planning/super-minimal-test');
// Import ridesharing functions
// const ridesharing = require('./domains/ridesharing/ridesharing');

// Import Radar.io webhook and geofence matching functions
import { radarWebhook as radarWebhookHandler } from './domains/ridesharing/functions/radar-webhook';
import { processGeofenceMatch as processGeofenceMatchHandler } from './domains/ridesharing/functions/geofence-match-processor';
import { onNewPassengerTrip as onNewPassengerTripTrigger } from './domains/ridesharing/triggers/passenger-triggers';
import { createIsochronesForActiveTrips } from './domains/ridesharing/scripts/create-isochrones-for-active-trips';

// Import city domain modules directly to avoid circular dependencies
import * as cityCore from './domains/city';
const cityPlaces = require('./domains/city/places');
const cityEvents = require('./domains/city/events');
const cityOrders = require('./domains/city/orders');
const cityBookings = require('./domains/city/bookings');
const citySearch = require('./domains/city/search');
const cityUserPreferences = require('./domains/city/user-preferences');

// Initialize Firebase
initializeApp();

// Export domain function objects
export const userFunctions = users;
export const marriageFunctions = marriage;
export const identityVerificationFunctions = identityVerification;
export const cityFunctions = {
  ...cityCore,
  ...cityPlaces,
  ...cityEvents,
  ...cityOrders,
  ...cityBookings,
  ...citySearch,
  ...cityUserPreferences
};

// Re-export meal planning functions directly using CommonJS exports
exports.generateMealPlan = mealPlanning.generateMealPlan;
exports.getUserMealPlans = mealPlanning.getUserMealPlans;
exports.updateMeal = mealPlanning.updateMeal;
exports.shareMealPlan = mealPlanning.shareMealPlan;

// Export test function using CommonJS exports
exports.testMealPlanningFunction = testFunction.testMealPlanningFunction;
exports.minimalTestFunction = testFunction.minimalTestFunction;
// Export super minimal test function
exports.superMinimalTest = superMinimalTest.superMinimalTest;

// Export Radar.io integration functions
exports['radar-webhook'] = radarWebhookHandler;
exports['process-geofence-match'] = processGeofenceMatchHandler;
exports['on-new-passenger-trip'] = onNewPassengerTripTrigger;

// Export migration scripts
exports['create-isochrones-for-active-trips'] = createIsochronesForActiveTrips;

// Export city functions
exports['city-getPlaces'] = cityPlaces.getPlaces;
exports['city-getPlace'] = cityPlaces.getPlace;
exports['city-createPlace'] = cityPlaces.createPlace;
exports['city-updatePlace'] = cityPlaces.updatePlace;
exports['city-addReview'] = cityPlaces.addReview;

exports['city-getEvents'] = cityEvents.getEvents;
exports['city-getEvent'] = cityEvents.getEvent;
exports['city-createEvent'] = cityEvents.createEvent;
exports['city-updateEvent'] = cityEvents.updateEvent;
exports['city-cancelEvent'] = cityEvents.cancelEvent;
exports['city-getUpcomingEventsForPlace'] = cityEvents.getUpcomingEventsForPlace;
exports['city-getPopularEvents'] = cityEvents.getPopularEvents;

exports['city-createOrder'] = cityOrders.createOrder;
exports['city-getUserOrders'] = cityOrders.getUserOrders;
exports['city-getOrder'] = cityOrders.getOrder;
exports['city-updateOrderStatus'] = cityOrders.updateOrderStatus;
exports['city-cancelOrder'] = cityOrders.cancelOrder;
exports['city-handleStripePaymentWebhook'] = cityOrders.handleStripePaymentWebhook;

exports['city-createBooking'] = cityBookings.createBooking;
exports['city-getUserBookings'] = cityBookings.getUserBookings;
exports['city-getBooking'] = cityBookings.getBooking;
exports['city-updateBookingStatus'] = cityBookings.updateBookingStatus;
exports['city-cancelBooking'] = cityBookings.cancelBooking;

exports['city-search'] = citySearch.search;
exports['city-getNearbyPlaces'] = citySearch.getNearbyPlaces;
exports['city-getPopularSearches'] = citySearch.getPopularSearches;
exports['city-saveSearch'] = citySearch.saveSearch;
exports['city-getRecentSearches'] = citySearch.getRecentSearches;
exports['city-clearRecentSearches'] = citySearch.clearRecentSearches;

exports['city-getUserPreferences'] = cityUserPreferences.getUserPreferences;
exports['city-toggleFavoritePlace'] = cityUserPreferences.toggleFavoritePlace;
exports['city-toggleFavoriteEvent'] = cityUserPreferences.toggleFavoriteEvent;
exports['city-toggleFavoriteProduct'] = cityUserPreferences.toggleFavoriteProduct;
exports['city-getFavoritePlaces'] = cityUserPreferences.getFavoritePlaces;
exports['city-getFavoriteEvents'] = cityUserPreferences.getFavoriteEvents;
exports['city-saveDeliveryAddress'] = cityUserPreferences.saveDeliveryAddress;
exports['city-deleteDeliveryAddress'] = cityUserPreferences.deleteDeliveryAddress;
exports['city-recordRecentlyViewed'] = cityUserPreferences.recordRecentlyViewed;
exports['city-getRecentlyViewed'] = cityUserPreferences.getRecentlyViewed;

exports['city-getCityStatistics'] = cityCore.getCityStatistics; 