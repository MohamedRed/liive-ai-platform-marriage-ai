import { _mock } from './_mock';
import { _tags } from './assets';
import { HAJJ_SERVICE_OPTIONS, HAJJ_TYPE_OPTIONS } from '@livve-1/database-types';

// ----------------------------------------------------------------------

export const HAJJ_DESTINATION_OPTIONS = [
  { code: 'SA', label: 'Saudi Arabia', phone: '966' },
  { code: 'AE', label: 'United Arab Emirates', phone: '971' },
  { code: 'EG', label: 'Egypt', phone: '20' },
  { code: 'JO', label: 'Jordan', phone: '962' },
  { code: 'TR', label: 'Turkey', phone: '90' },
];

export const HAJJ_SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'priceDesc', label: 'Price: High-Low' },
  { value: 'priceAsc', label: 'Price: Low-High' },
];

export const HAJJ_PUBLISH_OPTIONS = [
  {
    value: 'published',
    label: 'Published',
  },
  {
    value: 'draft',
    label: 'Draft',
  },
];

export const HAJJ_DETAILS_TABS = [
  { value: 'content', label: 'Package Details' },
  { value: 'pilgrims', label: 'Pilgrims' },
];

// ----------------------------------------------------------------------

const LANGUAGES = ['Arabic', 'English', 'Turkish', 'Urdu', 'Indonesian', 'Malay', 'French', 'Persian'];
const CERTIFICATIONS = ['Hajj Ministry Approved', 'First Aid Certified', 'Licensed Tour Guide', 'Religious Scholar'];

export const _hajjGuides = [...Array(12)].map((_, index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  phoneNumber: _mock.phoneNumber(index),
  languages: [...Array(2)].map((_, i) => LANGUAGES[(i + index) % LANGUAGES.length]),
  yearsExperience: _mock.number.age(index) % 15 + 2,
  certifications: [...Array(2)].map((_, i) => CERTIFICATIONS[(i + index) % CERTIFICATIONS.length]),
}));

export const _hajjPilgrims = [...Array(12)].map((_, index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  familyMembers: (index % 4) + 1,
  passportCountry: ['USA', 'UK', 'Canada', 'Australia', 'France', 'Germany', 'Malaysia', 'Indonesia', 'Pakistan', 'India', 'Egypt', 'Turkey'][index % 12],
}));

export const _hajjPackages = [...Array(24)].map((_, index) => {
  const available = {
    startDate: _mock.time(index),
    endDate: _mock.time(index + 1),
  };

  const publish = (index % 3 ? 'published' : 'draft') as string;

  const destination = HAJJ_DESTINATION_OPTIONS[index % HAJJ_DESTINATION_OPTIONS.length].label;

  const packageType = HAJJ_TYPE_OPTIONS[index % HAJJ_TYPE_OPTIONS.length].value;

  const services = [...Array((index % 4) + 2)].map(
    (__, _index) => HAJJ_SERVICE_OPTIONS[(_index + index) % HAJJ_SERVICE_OPTIONS.length].value
  );

  const guides = [...Array(3)].map((__, _index) => {
    const guideIndex = (index + _index) % _hajjGuides.length;
    return _hajjGuides[guideIndex];
  });

  const pilgrims = [...Array((index % 10) + 6)].map((__, _index) => {
    const pilgrimIndex = (index + _index) % _hajjPilgrims.length;
    return _hajjPilgrims[pilgrimIndex];
  });

  const inclusions = [
    'Accommodation in 5-star hotels',
    'All transportation within Saudi Arabia',
    'Visa processing fee',
    'Three meals per day',
    'Guided tours of holy sites',
    'Ziyarat to historical places',
    'Airport transfers',
    'Ihram for men',
  ].slice(0, (index % 4) + 4);

  const exclusions = [
    'International airfare',
    'Personal expenses',
    'Optional tours',
    'Travel insurance',
    'Qurbani fees',
    'Laundry services',
  ].slice(0, (index % 3) + 3);

  const accommodationOptions = [
    'Quad sharing room',
    'Triple sharing room',
    'Double sharing room',
    'Single room (with supplement)',
    'Family suite',
  ].slice(0, (index % 3) + 2);

  const durationOptions = ['7 days', '10 days', '14 days', '21 days', '30 days'];
  const duration = durationOptions[index % durationOptions.length];

  return {
    id: _mock.id(index),
    name: `${packageType} Package: ${destination} (${duration})`,
    duration,
    price: _mock.number.price(index) * 3, // Hajj is typically more expensive
    priceSale: index % 3 === 0 ? 0 : _mock.number.price(index) * 2.5,
    totalViews: (index + 1) * 100,
    tags: [...Array(3)].map((__, _index) => _tags[(_index + index) % _tags.length]),
    publish,
    destination,
    services,
    packageType,
    images: [...Array(3)].map((__, _index) => _mock.image.travel((_index + index) % 20)),
    content: index < 3 ? 
      `Experience the spiritual journey of a lifetime with our comprehensive ${packageType} package to ${destination}. Our ${duration} program includes everything you need for a fulfilling pilgrimage. Stay in comfortable accommodations close to the holy sites, enjoy guided tours from experienced scholars, and benefit from our seamless logistics management so you can focus on your spiritual journey.` :
      `Join thousands of pilgrims who have trusted us for their ${packageType} journey to ${destination}. Our ${duration} package provides complete support from knowledgeable guides who understand both the practical and spiritual aspects of this sacred pilgrimage. We handle all the details so you can immerse yourself in this blessed experience.`,
    inclusions,
    exclusions,
    accommodationOptions,
    ratingNumber: _mock.number.rating(index),
    guides,
    pilgrims,
    createdAt: _mock.time(index),
    available,
  };
}); 