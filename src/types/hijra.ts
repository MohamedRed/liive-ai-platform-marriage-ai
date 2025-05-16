import type { IDateValue, IDatePickerControl } from './common';

// ----------------------------------------------------------------------

export type IHijraFilters = {
  services: string[];
  destination: string[];
  guides: IHijraGuide[];
  startDate: IDatePickerControl;
  endDate: IDatePickerControl;
};

export type IHijraGuide = {
  id: string;
  name: string;
  avatarUrl: string;
  phoneNumber: string;
  languages: string[];
  yearsInCountry: number;
};

export type IHijraClient = {
  id: string;
  name: string;
  familyMembers: number;
  avatarUrl: string;
};

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