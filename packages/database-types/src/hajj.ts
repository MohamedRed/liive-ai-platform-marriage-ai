import type { Dayjs } from 'dayjs';
import type { IDateValue, IDatePickerControl } from './common-types';

// ----------------------------------------------------------------------

/**
 * Filter options for Hajj/Umra packages
 */
export type IHajjFilters = {
  services: string[];
  destination: string[];
  guides: IHajjGuide[];
  startDate: IDatePickerControl;
  endDate: IDatePickerControl;
  type: string[]; // Hajj or Umra
};

/**
 * Guide information for Hajj/Umra packages
 */
export type IHajjGuide = {
  id: string;
  name: string;
  avatarUrl: string;
  phoneNumber: string;
  languages: string[];
  yearsExperience: number;
  certifications: string[];
};

/**
 * Pilgrim information for Hajj/Umra packages
 */
export type IHajjPilgrim = {
  id: string;
  name: string;
  familyMembers: number;
  avatarUrl: string;
  passportCountry: string;
};

/**
 * Main Hajj/Umra package/item model
 */
export type IHajjItem = {
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
  pilgrims: IHajjPilgrim[];
  guides: IHajjGuide[];
  createdAt: IDateValue;
  accommodationOptions: string[];
  inclusions: string[];
  exclusions: string[];
  packageType: 'Hajj' | 'Umra' | 'Hajj & Umra';
  available: {
    startDate: IDateValue;
    endDate: IDateValue;
  };
};

/**
 * Firestore collection name
 */
export const HAJJ_COLLECTION = 'hajj_packages';

/**
 * Service options for Hajj/Umra packages
 */
export const HAJJ_SERVICE_OPTIONS = [
  { value: 'Visa Processing', label: 'Visa Processing' },
  { value: 'Transportation', label: 'Transportation' },
  { value: 'Accommodation', label: 'Accommodation' },
  { value: 'Meals', label: 'Meals' },
  { value: 'Group Guide', label: 'Group Guide' },
  { value: 'Religious Guidance', label: 'Religious Guidance' },
  { value: 'Ziyarat', label: 'Ziyarat' },
  { value: 'Medical Assistance', label: 'Medical Assistance' },
];

/**
 * Package type options
 */
export const HAJJ_TYPE_OPTIONS = [
  { value: 'Hajj', label: 'Hajj' },
  { value: 'Umra', label: 'Umra' },
  { value: 'Hajj & Umra', label: 'Hajj & Umra' },
]; 