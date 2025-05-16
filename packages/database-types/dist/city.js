"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CITY_COLLECTIONS = exports.AdditionalCityEntityType = exports.CityPlaceType = void 0;
// Types of places in the city
var CityPlaceType;
(function (CityPlaceType) {
    CityPlaceType["STORE"] = "store";
    CityPlaceType["RESTAURANT"] = "restaurant";
    CityPlaceType["CAFE"] = "cafe";
    CityPlaceType["MEDICAL"] = "medical";
    CityPlaceType["SALON"] = "salon";
    CityPlaceType["SERVICES"] = "services";
    CityPlaceType["WORSHIP"] = "worship";
    CityPlaceType["EDUCATION"] = "education";
    CityPlaceType["ENTERTAINMENT"] = "entertainment";
    CityPlaceType["EVENT_VENUE"] = "event_venue";
    CityPlaceType["GYM"] = "gym";
    CityPlaceType["GOVERNMENT"] = "government";
    CityPlaceType["TRANSPORTATION"] = "transportation";
    CityPlaceType["ACCOMMODATION"] = "accommodation";
    CityPlaceType["PARKING"] = "parking";
    CityPlaceType["OTHER"] = "other";
})(CityPlaceType || (exports.CityPlaceType = CityPlaceType = {}));
// Additional city entity types
var AdditionalCityEntityType;
(function (AdditionalCityEntityType) {
    AdditionalCityEntityType["PUBLIC_TRANSIT"] = "public_transit";
    AdditionalCityEntityType["EMERGENCY_SERVICE"] = "emergency_service";
    AdditionalCityEntityType["GOVERNMENT_SERVICE"] = "government_service";
    AdditionalCityEntityType["PARK"] = "park";
    AdditionalCityEntityType["LIBRARY"] = "library";
    AdditionalCityEntityType["PARKING_FACILITY"] = "parking_facility";
    AdditionalCityEntityType["UTILITY"] = "utility";
    AdditionalCityEntityType["SCHOOL"] = "school";
    AdditionalCityEntityType["TOURISM"] = "tourism";
})(AdditionalCityEntityType || (exports.AdditionalCityEntityType = AdditionalCityEntityType = {}));
// Extended Collection Types
exports.CITY_COLLECTIONS = {
    PLACES: 'PLACES',
    PRODUCTS: 'PRODUCTS',
    MENU_CATEGORIES: 'MENU_CATEGORIES',
    EVENTS: 'EVENTS',
    REVIEWS: 'REVIEWS',
    BOOKINGS: 'BOOKINGS',
    ORDERS: 'ORDERS',
    USER_PREFERENCES: 'USER_PREFERENCES',
    ANALYTICS: 'ANALYTICS',
    // New collections
    TRANSIT_ROUTES: 'TRANSIT_ROUTES',
    TRANSIT_STOPS: 'TRANSIT_STOPS',
    TRANSIT_SCHEDULES: 'TRANSIT_SCHEDULES',
    TRANSIT_ALERTS: 'TRANSIT_ALERTS',
    GOVERNMENT_SERVICES: 'GOVERNMENT_SERVICES',
    GOVERNMENT_APPOINTMENTS: 'GOVERNMENT_APPOINTMENTS',
    PARKS: 'PARKS',
    PARK_FACILITIES: 'PARK_FACILITIES',
    LIBRARIES: 'LIBRARIES',
    PARKING_FACILITIES: 'PARKING_FACILITIES',
    EMERGENCY_SERVICES: 'EMERGENCY_SERVICES',
    COMMUNITY_POSTS: 'COMMUNITY_POSTS',
    COMMUNITY_COMMENTS: 'COMMUNITY_COMMENTS',
    ISSUE_REPORTS: 'ISSUE_REPORTS',
    ISSUE_UPDATES: 'ISSUE_UPDATES'
};
