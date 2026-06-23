import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { Timestamping } from './system';
import { UserInfo } from './users';
/**
 * Interface for location data
 */
export interface Location {
    /** Latitude coordinate */
    latitude: number;
    /** Longitude coordinate */
    longitude: number;
    /** Human-readable address (optional) */
    address?: string;
}
/**
 * Interface for trip-related settings
 */
export interface RidesharingSettings extends Timestamping {
    /** User ID */
    userId: string;
    /** Settings for matching */
    matching: {
        /** Whether to match only with same gender */
        sameGenderOnly: boolean;
        /** Maximum pickup distance in meters */
        maxPickupDistance: number;
        /** Maximum dropoff distance in meters */
        maxDropoffDistance: number;
        /** Maximum trip time extension in seconds */
        maxTripTimeExtension: number;
    };
    /** Settings for notifications */
    notifications: {
        /** Whether in-app notifications are enabled */
        inAppEnabled: boolean;
        /** Whether SMS notifications are enabled */
        smsEnabled: boolean;
        /** Whether voice call notifications are enabled */
        voiceCallEnabled: boolean;
    };
}
/**
 * Statuses for driver trips
 */
export declare enum DriverTripStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
/**
 * Statuses for passenger trips
 */
export declare enum PassengerTripStatus {
    REQUESTED = "requested",
    MATCHED = "matched",
    IN_PROGRESS = "inProgress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
/**
 * Interface for driver trips
 */
export interface DriverTrip extends Timestamping {
    /** Unique trip identifier */
    id: string;
    /** User ID of the driver */
    userId: string;
    /** Trip destination */
    destination: Location;
    /** Current driver location (updated in real-time) */
    currentLocation?: Location;
    /** Timestamp when the trip was created */
    timestamp: string;
    /** Current status of the trip */
    status: DriverTripStatus;
    /** IDs of passenger trips assigned to this driver */
    assignedPassengers: string[];
    /** Maximum number of passengers that can be accommodated */
    maxPassengers: number;
    /** Current number of passengers in the vehicle */
    currentPassengerCount: number;
    /** Vehicle information */
    vehicle?: {
        /** Type of vehicle */
        type: string;
        /** Vehicle make */
        make: string;
        /** Vehicle model */
        model: string;
        /** License plate number */
        licensePlate: string;
        /** Vehicle color */
        color: string;
    };
    /** Driver preferences */
    preferences?: {
        /** Whether to allow smoking */
        allowSmoking: boolean;
        /** Whether to allow pets */
        allowPets: boolean;
        /** Whether to allow luggage */
        allowLuggage: boolean;
        /** Preferred music genre */
        musicPreference: string;
        /** Maximum acceptable total detour in meters */
        maxTotalDetourDistance?: number;
        /** Maximum acceptable total detour in seconds */
        maxTotalDetourTime?: number;
        /** Any additional preference properties */
        [key: string]: any;
    };
    /** Route information (waypoints, ETA, etc.) */
    route?: {
        /** Calculated path as array of coordinates */
        path: Location[];
        /** Array of waypoints for multiple passengers */
        waypoints: {
            /** Location of waypoint */
            location: Location;
            /** Type of waypoint (pickup or dropoff) */
            type: 'pickup' | 'dropoff';
            /** ID of the passenger associated with this waypoint */
            passengerId: string;
            /** Estimated time of arrival */
            eta: string;
        }[];
        /** Estimated time of arrival */
        eta: string;
        /** Estimated distance in meters */
        distance: number;
        /** Estimated duration in seconds */
        duration: number;
        /** Optimization status */
        optimized: boolean;
    };
}
/**
 * Interface for passenger trips
 */
export interface PassengerTrip extends Timestamping {
    /** Unique trip identifier */
    id: string;
    /** User ID of the passenger */
    userId: string;
    /** Passenger pickup location */
    pickupLocation?: Location;
    /** Trip destination */
    destination: Location;
    /** Timestamp when the trip was created */
    timestamp: string;
    /** Current status of the trip */
    status: PassengerTripStatus;
    /** IDs of driver trips assigned to this passenger */
    assignedDrivers: string[];
    /** Passenger preferences */
    preferences?: {
        /** Whether passenger is willing to share ride */
        willingToShare: boolean;
        /** Maximum number of other passengers acceptable */
        maxOtherPassengers: number;
        /** Whether smoking is acceptable */
        smokingAcceptable: boolean;
        /** Whether pets are acceptable */
        petsAcceptable: boolean;
        /** Granular detour preferences */
        detourPreferences?: {
            /** Pickup detour settings */
            pickupDetour?: {
                /** Max additional distance for pickup (meters) */
                maxDistance?: number;
                /** Max additional time for pickup (seconds) */
                maxTime?: number;
            };
            /** Dropoff detour settings */
            dropoffDetour?: {
                /** Max additional distance for dropoff (meters) */
                maxDistance?: number;
                /** Max additional time for dropoff (seconds) */
                maxTime?: number;
            };
            /** Total trip detour settings */
            totalTripDetour?: {
                /** Max total additional distance (meters) */
                maxDistance?: number;
                /** Max total additional time (seconds) */
                maxTime?: number;
            };
            /** The environment setting used for these preferences */
            environment?: 'urban' | 'suburban' | 'rural';
        };
    };
    /** Transaction safety info */
    payment?: {
        /** Payment method ID */
        paymentMethodId?: string;
        /** Transaction ID */
        transactionId?: string;
        /** Payment status */
        status: 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';
        /** Estimated fare */
        estimatedFare: number;
        /** Actual fare */
        actualFare?: number;
        /** Currency code */
        currency: string;
    };
    /** Route information */
    route?: {
        /** Calculated path as array of coordinates */
        path: Location[];
        /** Estimated time of arrival */
        eta: string;
        /** Estimated distance in meters */
        distance: number;
        /** Estimated duration in seconds */
        duration: number;
        /** Position in pickup/dropoff sequence */
        sequencePosition?: number;
    };
    /** Number of match attempts made for this trip */
    matchAttempts: number;
    /** Timestamp of the last match attempt */
    lastMatchAttempt: FirestoreTimestamp | null;
    /** IDs of drivers that have rejected this trip */
    rejectedDrivers: string[];
}
/**
 * Interface for notifications related to ridesharing
 */
export interface RidesharingNotification extends Timestamping {
    /** Unique notification ID */
    id: string;
    /** User ID of the recipient */
    userId: string;
    /** Type of notification */
    type: 'driver_match' | 'passenger_match' | 'driver_arrival' | 'trip_cancelled' | 'trip_updated';
    /** Notification message */
    message: string;
    /** Additional data related to the notification */
    data: {
        /** ID of the related passenger trip (if applicable) */
        passengerTripId?: string;
        /** ID of the related driver trip (if applicable) */
        driverTripId?: string;
        /** ID of the trip that was cancelled (if applicable) */
        tripId?: string;
    };
    /** Whether the notification has been read */
    read: boolean;
}
/**
 * Interface for trip rating and feedback
 */
export interface TripFeedback extends Timestamping {
    /** Unique feedback ID */
    id: string;
    /** ID of the trip being rated */
    tripId: string;
    /** User ID of the person giving feedback */
    userId: string;
    /** Role of the user giving feedback */
    userRole: 'driver' | 'passenger';
    /** Rating from 1 to 5 */
    rating: number;
    /** Text comment/feedback */
    comment?: string;
    /** Specific aspects being rated */
    aspects?: {
        /** Timeliness rating */
        timeliness?: number;
        /** Comfort rating */
        comfort?: number;
        /** Safety rating */
        safety?: number;
        /** Communication rating */
        communication?: number;
    };
}
/**
 * Interface for trip history analytics
 */
export interface RidesharingUserStats extends Timestamping {
    /** User ID */
    userId: string;
    /** Driver statistics */
    driverStats: {
        /** Total trips as driver */
        totalTrips: number;
        /** Total distance driven in meters */
        totalDistance: number;
        /** Total driving time in minutes */
        totalTime: number;
        /** Average rating as driver */
        averageRating: number;
        /** Total passenger trips */
        totalPassengers: number;
    };
    /** Passenger statistics */
    passengerStats: {
        /** Total trips as passenger */
        totalTrips: number;
        /** Total distance traveled in meters */
        totalDistance: number;
        /** Total travel time in minutes */
        totalTime: number;
        /** Average rating as passenger */
        averageRating: number;
        /** Most frequent destinations */
        frequentDestinations: {
            /** Location */
            location: Location;
            /** Number of times visited */
            count: number;
        }[];
    };
}
/**
 * Expanded notification types enum
 */
export declare enum NotificationType {
    RIDE_MATCH = "ride_match",
    DRIVER_ARRIVED = "driver_arrived",
    RIDE_COMPLETED = "ride_completed",
    RIDE_CANCELLED = "ride_cancelled",
    ETA_UPDATE = "eta_update",
    CONGESTION_ALERT = "congestion_alert",
    TRIP_STATUS_CHANGE = "trip_status_change"
}
/**
 * Extended ridesharing settings with additional fields for internal use
 */
export interface ExtendedRidesharingSettings extends RidesharingSettings {
    /** Any additional properties */
    [key: string]: any;
}
/**
 * Interface for matching attempt results
 */
export interface MatchAttemptResult {
    /** Whether the match was successful */
    matched: boolean;
    /** ID of the driver if matched */
    driverId?: string;
    /** Reason for the result */
    reason?: string;
}
/**
 * Interface for congestion hotspots
 */
export interface CongestionHotspot {
    /** Unique hotspot ID */
    id?: string;
    /** Hotspot location */
    location: Location;
    /** Radius of the hotspot in meters */
    radius: number;
    /** Count of pickups in this area */
    pickupCount: number;
    /** Count of dropoffs in this area */
    dropoffCount: number;
    /** Total count of operations */
    totalCount: number;
    /** Congestion level */
    congestionLevel: number | 'low' | 'moderate' | 'high' | 'severe';
    /** Last update timestamp */
    lastUpdate?: FirestoreTimestamp;
    /** Last updated timestamp */
    lastUpdated?: FirestoreTimestamp;
    /** Last redistribution timestamp */
    lastRedistribution?: FirestoreTimestamp;
    /** Count of redistributions */
    redistributionCount?: number;
    /** Scheduled operations in this hotspot */
    scheduledOperations?: Array<{
        /** Trip ID */
        tripId: string;
        /** Type of operation */
        type: 'pickup' | 'dropoff';
        /** Scheduled time */
        scheduledTime: FirestoreTimestamp;
        /** User ID */
        userId: string;
    }>;
    /** Expiration timestamp */
    expiresAt?: FirestoreTimestamp;
}
/**
 * Interface for an alternative location
 */
export interface LocationAlternative extends Location {
    /** Distance from original location in meters */
    distance?: number;
    /** Congestion level at this location */
    congestionLevel?: number | 'low' | 'moderate' | 'high' | 'severe';
    /** Score for ranking alternatives */
    score?: number;
}
/**
 * Interface for location alternatives due to congestion
 */
export interface LocationAlternatives {
    /** Original requested location */
    original: Location;
    /** Array of alternative locations */
    alternatives: LocationAlternative[];
    /** Congestion level at the original location */
    congestionLevel: number | 'low' | 'moderate' | 'high' | 'severe';
    /** Recommended alternative location */
    recommendedAlternative?: LocationAlternative;
    /** Suggested staggered time */
    staggeredTime?: Date;
}
/**
 * Interface for an enhanced alternative location with walking information
 */
export interface EnhancedLocationAlternative extends LocationAlternative {
    /** Walking distance in meters */
    walkingDistance: number;
    /** Walking time in seconds */
    walkingTime: number;
    /** Walking time in human-readable format */
    walkingTimeText: string;
    /** Encoded polyline for the walking route */
    walkingRoutePolyline?: string;
    /** Congestion level at this location */
    congestionLevel?: number | 'low' | 'moderate' | 'high' | 'severe';
    /** Score for ranking alternatives */
    score?: number;
}
/**
 * Interface for location alternatives with walking information
 */
export interface EnhancedLocationAlternatives {
    /** Original requested location */
    original: Location;
    /** Array of enhanced alternative locations */
    alternatives: EnhancedLocationAlternative[];
    /** Congestion level at the original location */
    congestionLevel: number | 'low' | 'moderate' | 'high' | 'severe';
    /** Recommended alternative location */
    recommendedAlternative?: EnhancedLocationAlternative;
    /** Suggested staggered time */
    staggeredTime?: Date;
}
/**
 * Interface for optimized pickup point
 */
export interface OptimizedPickupPoint {
    /** Optimized pickup location */
    location: Location;
    /** Walking distance in meters */
    walkingDistance: number;
    /** Walking duration in seconds */
    walkingDuration: number;
    /** Additional distance for driver in meters */
    driverDetourDistance: number;
    /** Additional time for driver in seconds */
    driverDetourDuration: number;
    /** Overall score for this pickup point */
    score: number;
}
/**
 * Enhanced driver trip with additional fields for route buffer matching
 */
export interface EnhancedDriverTrip extends DriverTrip {
    /** Encoded polyline for the route */
    routePolyline?: string;
    /** Unix timestamp of planned departure */
    departureTime?: number;
    /** Whether this driver has been matched at least once */
    hasBeenMatched?: boolean;
    /** Timestamp of last match attempt */
    lastMatchAttempt?: Date;
}
/**
 * Extended passenger trip with additional fields for spatial matching
 */
export interface ExtendedPassengerTrip extends PassengerTrip {
    /** Current location of user (may differ from pickup) */
    userCurrentLocation?: Location;
    /** Final destination (may differ from dropoff) */
    userFinalDestination?: Location;
    /** Maximum walking distance in meters */
    walkingRadius?: number;
    /** Maximum wait time in seconds */
    maxWaitTime?: number;
    /** Unix timestamp of trip creation time */
    createTime?: number;
}
/**
 * Extended user profile with ridesharing-specific preferences
 */
export interface RidesharingUserProfile extends UserInfo {
    /** User gender */
    gender?: string;
    /** Ridesharing-specific preferences */
    preferences?: {
        /** Maximum walking distance in meters */
        maxWalkingDistance?: number;
        /** Maximum wait time in seconds */
        maxWaitTime?: number;
        /** Maximum detour distance in meters */
        maxTotalDetourDistance?: number;
        /** Maximum detour time in seconds */
        maxTotalDetourTime?: number;
        /** Any other custom preferences */
        [key: string]: any;
    };
}
