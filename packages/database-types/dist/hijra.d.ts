import type { IDateValue, IDatePickerControl } from './common-types';
/**
 * Filter options for Hijra packages
 */
export type IHijraFilters = {
    services: string[];
    destination: string[];
    guides: IHijraGuide[];
    startDate: IDatePickerControl;
    endDate: IDatePickerControl;
};
/**
 * Guide information for Hijra packages
 */
export type IHijraGuide = {
    id: string;
    name: string;
    avatarUrl: string;
    phoneNumber: string;
    languages: string[];
    yearsInCountry: number;
};
/**
 * Client information for Hijra packages
 */
export type IHijraClient = {
    id: string;
    name: string;
    familyMembers: number;
    avatarUrl: string;
};
/**
 * Main Hijra package/item model
 */
export type IHijraItem = {
    id: string;
    name: string;
    price: number;
    totalViews: number;
    tags: string[];
    content: string;
    publish: string;
    images: string[];
    duration: string;
    priceSale: number;
    services: string[];
    destination: string;
    ratingNumber: number;
    clients: IHijraClient[];
    guides: IHijraGuide[];
    createdAt: IDateValue;
    benefits: string[];
    requirements: string[];
    housingOptions: string[];
    available: {
        startDate: IDateValue;
        endDate: IDateValue;
    };
};
/**
 * Firestore collection name
 */
export declare const HIJRA_COLLECTION = "hijra_packages";
/**
 * Service options for Hijra packages
 */
export declare const HIJRA_SERVICE_OPTIONS: {
    value: string;
    label: string;
}[];
