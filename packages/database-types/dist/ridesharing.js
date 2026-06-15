"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = exports.PassengerTripStatus = exports.DriverTripStatus = void 0;
/**
 * Statuses for driver trips
 */
var DriverTripStatus;
(function (DriverTripStatus) {
    DriverTripStatus["ACTIVE"] = "active";
    DriverTripStatus["COMPLETED"] = "completed";
    DriverTripStatus["CANCELLED"] = "cancelled";
})(DriverTripStatus || (exports.DriverTripStatus = DriverTripStatus = {}));
/**
 * Statuses for passenger trips
 */
var PassengerTripStatus;
(function (PassengerTripStatus) {
    PassengerTripStatus["REQUESTED"] = "requested";
    PassengerTripStatus["MATCHED"] = "matched";
    PassengerTripStatus["IN_PROGRESS"] = "inProgress";
    PassengerTripStatus["COMPLETED"] = "completed";
    PassengerTripStatus["CANCELLED"] = "cancelled";
})(PassengerTripStatus || (exports.PassengerTripStatus = PassengerTripStatus = {}));
/**
 * Expanded notification types enum
 */
var NotificationType;
(function (NotificationType) {
    NotificationType["RIDE_MATCH"] = "ride_match";
    NotificationType["DRIVER_ARRIVED"] = "driver_arrived";
    NotificationType["RIDE_COMPLETED"] = "ride_completed";
    NotificationType["RIDE_CANCELLED"] = "ride_cancelled";
    NotificationType["ETA_UPDATE"] = "eta_update";
    NotificationType["CONGESTION_ALERT"] = "congestion_alert";
    NotificationType["TRIP_STATUS_CHANGE"] = "trip_status_change";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
