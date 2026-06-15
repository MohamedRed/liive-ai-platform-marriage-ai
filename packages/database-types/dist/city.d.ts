import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
import { Timestamping } from './index';
export interface CityLocation {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
}
export interface OpeningHours {
    monday?: {
        open: string;
        close: string;
    }[];
    tuesday?: {
        open: string;
        close: string;
    }[];
    wednesday?: {
        open: string;
        close: string;
    }[];
    thursday?: {
        open: string;
        close: string;
    }[];
    friday?: {
        open: string;
        close: string;
    }[];
    saturday?: {
        open: string;
        close: string;
    }[];
    sunday?: {
        open: string;
        close: string;
    }[];
    holidayHours?: {
        date: string;
        open: string;
        close: string;
    }[];
    isOpen24Hours?: boolean;
}
export interface Contact {
    phone?: string;
    email?: string;
    website?: string;
    socialMedia?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        tiktok?: string;
        linkedin?: string;
    };
}
export interface Review {
    userId: string;
    rating: number;
    comment?: string;
    createdAt: FirestoreTimestamp;
    updatedAt?: FirestoreTimestamp;
}
export interface CityPlace extends Timestamping {
    id: string;
    name: string;
    description?: string;
    type: CityPlaceType;
    category: string;
    subcategory?: string;
    location: CityLocation;
    contact?: Contact;
    openingHours?: OpeningHours;
    photos?: string[];
    isVerified?: boolean;
    isFeatured?: boolean;
    tags?: string[];
    averageRating?: number;
    totalReviews?: number;
    ownerId?: string;
    metadata?: {
        isActive: boolean;
        acceptsOnlineOrders?: boolean;
        acceptsReservations?: boolean;
        acceptsAppointments?: boolean;
        priceRange?: 1 | 2 | 3 | 4;
        capacity?: number;
        [key: string]: any;
    };
}
export declare enum CityPlaceType {
    STORE = "store",
    RESTAURANT = "restaurant",
    CAFE = "cafe",
    MEDICAL = "medical",
    SALON = "salon",
    SERVICES = "services",
    WORSHIP = "worship",
    EDUCATION = "education",
    ENTERTAINMENT = "entertainment",
    EVENT_VENUE = "event_venue",
    GYM = "gym",
    GOVERNMENT = "government",
    TRANSPORTATION = "transportation",
    ACCOMMODATION = "accommodation",
    PARKING = "parking",
    OTHER = "other"
}
export declare enum AdditionalCityEntityType {
    PUBLIC_TRANSIT = "public_transit",
    EMERGENCY_SERVICE = "emergency_service",
    GOVERNMENT_SERVICE = "government_service",
    PARK = "park",
    LIBRARY = "library",
    PARKING_FACILITY = "parking_facility",
    UTILITY = "utility",
    SCHOOL = "school",
    TOURISM = "tourism"
}
export interface Product extends Timestamping {
    id: string;
    placeId: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    category?: string;
    subcategory?: string;
    photos?: string[];
    isAvailable: boolean;
    stockQuantity?: number;
    attributes?: {
        [key: string]: string | number | boolean;
    };
    tags?: string[];
    metadata?: Record<string, any>;
}
export interface MenuCategory {
    id: string;
    placeId: string;
    name: string;
    description?: string;
    order?: number;
}
export interface CityEvent extends Timestamping {
    id: string;
    placeId?: string;
    name: string;
    description?: string;
    startDate: FirestoreTimestamp;
    endDate: FirestoreTimestamp;
    location: CityLocation;
    organizer?: {
        id?: string;
        name: string;
        contact?: Contact;
    };
    capacity?: number;
    ticketPrice?: {
        amount: number;
        currency: string;
    };
    isPublic: boolean;
    photos?: string[];
    category?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}
export interface Booking extends Timestamping {
    id: string;
    placeId: string;
    userId: string;
    type: 'reservation' | 'appointment' | 'ticket';
    eventId?: string;
    dateTime: FirestoreTimestamp;
    endDateTime?: FirestoreTimestamp;
    status: 'pending' | 'confirmed' | 'completed' | 'canceled' | 'rejected';
    partySize?: number;
    notes?: string;
    contact?: {
        name: string;
        phone: string;
        email: string;
    };
    paymentStatus?: 'unpaid' | 'paid' | 'refunded' | 'partial';
    paymentId?: string;
    metadata?: Record<string, any>;
}
export interface Order extends Timestamping {
    id: string;
    placeId: string;
    userId: string;
    items: OrderItem[];
    subtotal: number;
    tax?: number;
    deliveryFee?: number;
    tip?: number;
    total: number;
    currency: string;
    status: 'pending' | 'preparing' | 'ready' | 'in_delivery' | 'delivered' | 'completed' | 'canceled';
    paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'partial';
    paymentMethod?: string;
    paymentId?: string;
    stripePaymentIntentId?: string;
    deliveryAddress?: {
        address: string;
        instructions?: string;
        latitude?: number;
        longitude?: number;
    };
    pickupTime?: FirestoreTimestamp;
    deliveryTime?: FirestoreTimestamp;
    notes?: string;
    contact?: {
        name: string;
        phone: string;
    };
    metadata?: Record<string, any>;
}
export interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations?: {
        name: string;
        options: {
            name: string;
            price?: number;
        }[];
    }[];
    notes?: string;
}
export interface CityUserPreferences extends Timestamping {
    userId: string;
    favorites: {
        places?: string[];
        products?: string[];
        events?: string[];
        transitRoutes?: string[];
        governmentServices?: string[];
    };
    recentSearches?: {
        query: string;
        timestamp: FirestoreTimestamp;
    }[];
    recentlyViewed?: {
        placeId?: string;
        productId?: string;
        eventId?: string;
        timestamp: FirestoreTimestamp;
    }[];
    deliveryAddresses?: {
        id: string;
        name: string;
        address: string;
        instructions?: string;
        isDefault?: boolean;
        latitude?: number;
        longitude?: number;
    }[];
    filters?: {
        categories?: string[];
        priceRange?: number[];
        distance?: number;
        rating?: number;
    };
    paymentMethods?: {
        id: string;
        type: 'card' | 'bank' | 'digital_wallet';
        lastFour?: string;
        isDefault?: boolean;
        stripePaymentMethodId?: string;
    }[];
    notifications?: {
        transitAlerts?: boolean;
        communityUpdates?: boolean;
        issueUpdates?: boolean;
        eventReminders?: boolean;
    };
}
export interface CityAnalytics {
    placeId: string;
    views: number;
    bookings: number;
    orders: number;
    favorites: number;
    totalRevenue: number;
    currency: string;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    date: FirestoreTimestamp;
}
export interface TransitRoute extends Timestamping {
    id: string;
    name: string;
    type: 'bus' | 'train' | 'subway' | 'tram' | 'ferry';
    operatorId: string;
    description?: string;
    color?: string;
    stops: string[];
    fareInfo?: {
        base: number;
        discounted?: number;
        children?: number;
        currency: string;
    };
    schedule?: TransitSchedule[];
    mapPath?: {
        lat: number;
        lng: number;
    }[];
    accessibility?: {
        wheelchairAccessible: boolean;
        visualAidsAvailable: boolean;
        audioAnnouncements: boolean;
    };
    status: 'active' | 'scheduled' | 'detoured' | 'suspended';
    tags?: string[];
}
export interface TransitStop extends Timestamping {
    id: string;
    name: string;
    code?: string;
    location: CityLocation;
    routes: string[];
    amenities?: {
        shelter: boolean;
        bench: boolean;
        lighting: boolean;
        realtimeDisplay: boolean;
        ticketMachine: boolean;
        bikePark: boolean;
    };
    accessibility?: {
        wheelchairAccessible: boolean;
        tactilePaving: boolean;
        elevatorAccess: boolean;
    };
    zone?: string;
    connections?: {
        type: string;
        name: string;
    }[];
}
export interface TransitSchedule {
    routeId: string;
    stopId: string;
    dayType: 'weekday' | 'saturday' | 'sunday' | 'holiday';
    departureTimes: string[];
    frequency?: {
        startTime: string;
        endTime: string;
        intervalMinutes: number;
    };
    effectiveFrom?: FirestoreTimestamp;
    effectiveTo?: FirestoreTimestamp;
}
export interface TransitAlert extends Timestamping {
    id: string;
    routeIds: string[];
    stopIds?: string[];
    type: 'delay' | 'detour' | 'suspension' | 'schedule_change' | 'maintenance' | 'other';
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'severe';
    startTime: FirestoreTimestamp;
    endTime?: FirestoreTimestamp;
    affectedDirections?: string[];
    alternativeRoutes?: string[];
}
export interface GovernmentService extends Timestamping {
    id: string;
    name: string;
    type: string;
    description: string;
    department: string;
    location: CityLocation;
    contact: Contact;
    openingHours: OpeningHours;
    services: ServiceInfo[];
    documentRequirements?: DocumentRequirement[];
    appointmentRequired: boolean;
    onlineAvailability: boolean;
    fees?: {
        amount: number;
        currency: string;
        description: string;
    }[];
    languages?: string[];
    accessibility?: {
        wheelchairAccessible: boolean;
        hearingAssistance: boolean;
        visualAids: boolean;
    };
}
export interface ServiceInfo {
    id: string;
    name: string;
    description: string;
    processingTime?: string;
    requirements?: string[];
    fee?: {
        amount: number;
        currency: string;
    };
    availability: 'online' | 'in_person' | 'both';
}
export interface DocumentRequirement {
    name: string;
    description: string;
    isRequired: boolean;
    acceptedFormats?: string[];
}
export interface GovernmentAppointment extends Booking {
    serviceId: string;
    documents?: string[];
    purpose: string;
    confirmationCode: string;
    checkInTime?: FirestoreTimestamp;
    estimatedWaitTime?: number;
}
export interface Park extends Timestamping {
    id: string;
    name: string;
    description?: string;
    location: CityLocation;
    size?: {
        value: number;
        unit: 'acres' | 'sqft' | 'sqm' | 'hectares';
    };
    amenities?: {
        playground: boolean;
        restrooms: boolean;
        picnicAreas: boolean;
        sportsFacilities: boolean;
        trails: boolean;
        dogFriendly: boolean;
        parking: boolean;
        visitorCenter: boolean;
    };
    facilities?: {
        id: string;
        name: string;
        type: string;
        isReservable: boolean;
    }[];
    openingHours?: OpeningHours;
    regulations?: string[];
    photos?: string[];
    events?: string[];
    accessibility?: {
        wheelchairAccessible: boolean;
        accessibleRestrooms: boolean;
        accessiblePlayground: boolean;
        servicePets: boolean;
    };
    contact?: Contact;
}
export interface CommunityPost extends Timestamping {
    id: string;
    userId: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    location?: CityLocation;
    eventDate?: FirestoreTimestamp;
    photos?: string[];
    likes: number;
    commentCount: number;
    isOfficial: boolean;
    isPinned: boolean;
    status: 'active' | 'archived' | 'reported' | 'removed';
    visibility: 'public' | 'neighborhood';
    neighborhood?: string;
}
export interface CommunityComment extends Timestamping {
    id: string;
    postId: string;
    userId: string;
    parentCommentId?: string;
    content: string;
    likes: number;
    isEdited: boolean;
    status: 'active' | 'reported' | 'removed';
}
export interface IssueReport extends Timestamping {
    id: string;
    userId: string;
    type: string;
    title: string;
    description: string;
    location: CityLocation;
    photos?: string[];
    status: 'reported' | 'reviewing' | 'in_progress' | 'scheduled' | 'resolved' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    departmentId?: string;
    assignedTo?: string;
    publicNotes?: string;
    internalNotes?: string;
    resolution?: {
        action: string;
        date: FirestoreTimestamp;
        notes: string;
    };
    category: string;
    subcategory?: string;
    followUpRequired: boolean;
    expectedResolutionDate?: FirestoreTimestamp;
    upvotes: number;
    watchCount: number;
    relatedIssues?: string[];
}
export interface IssueUpdate extends Timestamping {
    id: string;
    issueId: string;
    userId: string;
    title: string;
    description: string;
    photos?: string[];
    status?: 'reported' | 'reviewing' | 'in_progress' | 'scheduled' | 'resolved' | 'rejected';
    isPublic: boolean;
}
export interface EmergencyService extends Timestamping {
    id: string;
    name: string;
    type: 'police' | 'fire' | 'ambulance' | 'hospital' | 'urgent_care' | 'disaster_response';
    description?: string;
    location: CityLocation;
    jurisdiction?: string;
    contact: {
        emergencyPhone: string;
        nonEmergencyPhone?: string;
        email?: string;
        website?: string;
    };
    servicesProvided: string[];
    operationalHours: OpeningHours | 'always_open';
    waitTime?: number;
    capacity?: {
        total: number;
        available: number;
        updatedAt: FirestoreTimestamp;
    };
    photos?: string[];
    status: 'operational' | 'limited' | 'overwhelmed' | 'closed';
}
export interface Library extends Timestamping {
    id: string;
    name: string;
    description?: string;
    location: CityLocation;
    contact: Contact;
    openingHours: OpeningHours;
    amenities?: {
        computers: boolean;
        wifi: boolean;
        studyRooms: boolean;
        printingServices: boolean;
        childrenArea: boolean;
        eventSpace: boolean;
        cafe: boolean;
    };
    events?: string[];
    collections?: {
        books: number;
        ebooks: number;
        audiobooks: number;
        magazines: number;
        newspapers: number;
        specialCollections?: string[];
    };
    photos?: string[];
    services?: string[];
    accessibility?: {
        wheelchairAccessible: boolean;
        hearingAssistance: boolean;
        visualAids: boolean;
    };
}
export interface ParkingFacility extends Timestamping {
    id: string;
    name: string;
    type: 'garage' | 'lot' | 'street' | 'private';
    operator?: string;
    location: CityLocation;
    capacity: {
        total: number;
        available?: number;
        handicapped?: number;
        electric?: number;
    };
    rates: {
        hourly?: number;
        daily?: number;
        monthly?: number;
        currency: string;
        specialRates?: {
            description: string;
            rate: number;
            conditions?: string;
        }[];
    };
    openingHours: OpeningHours | 'always_open';
    features?: {
        covered: boolean;
        valet: boolean;
        security: boolean;
        evCharging: boolean;
        heightLimit?: number;
        carWash?: boolean;
    };
    paymentMethods?: string[];
    contact?: Contact;
    lastUpdated?: FirestoreTimestamp;
}
export declare const CITY_COLLECTIONS: {
    PLACES: string;
    PRODUCTS: string;
    MENU_CATEGORIES: string;
    EVENTS: string;
    REVIEWS: string;
    BOOKINGS: string;
    ORDERS: string;
    USER_PREFERENCES: string;
    ANALYTICS: string;
    TRANSIT_ROUTES: string;
    TRANSIT_STOPS: string;
    TRANSIT_SCHEDULES: string;
    TRANSIT_ALERTS: string;
    GOVERNMENT_SERVICES: string;
    GOVERNMENT_APPOINTMENTS: string;
    PARKS: string;
    PARK_FACILITIES: string;
    LIBRARIES: string;
    PARKING_FACILITIES: string;
    EMERGENCY_SERVICES: string;
    COMMUNITY_POSTS: string;
    COMMUNITY_COMMENTS: string;
    ISSUE_REPORTS: string;
    ISSUE_UPDATES: string;
};
