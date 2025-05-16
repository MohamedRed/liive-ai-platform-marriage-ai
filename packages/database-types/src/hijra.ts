import type { Dayjs } from 'dayjs';
import type { IDateValue, IDatePickerControl } from './common-types';

// ----------------------------------------------------------------------

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
export const HIJRA_COLLECTION = 'hijra_packages';

/**
 * Service options for Hijra packages
 */
export const HIJRA_SERVICE_OPTIONS = [
  { value: 'Visa Processing', label: 'Visa Processing' },
  { value: 'Housing Assistance', label: 'Housing Assistance' },
  { value: 'Job Search', label: 'Job Search' },
  { value: 'Language Classes', label: 'Language Classes' },
  { value: 'Legal Guidance', label: 'Legal Guidance' },
  { value: 'Cultural Orientation', label: 'Cultural Orientation' },
  { value: 'School Enrollment', label: 'School Enrollment' },
  { value: 'Medical Registration', label: 'Medical Registration' },
]; 