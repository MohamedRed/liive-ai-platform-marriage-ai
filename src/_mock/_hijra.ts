import { _mock } from './_mock';
import { _tags } from './assets';

// ----------------------------------------------------------------------

export const HIJRA_SERVICE_OPTIONS = [
  { value: 'Housing assistance', label: 'Housing assistance' },
  { value: 'Paperwork guidance', label: 'Paperwork guidance' },
  { value: 'School enrollment', label: 'School enrollment' },
  { value: 'Language support', label: 'Language support' },
  { value: 'Job search assistance', label: 'Job search assistance' },
  { value: 'Cultural orientation', label: 'Cultural orientation' },
  { value: 'Community introduction', label: 'Community introduction' },
  { value: 'Medical assistance', label: 'Medical assistance' },
];

export const HIJRA_DESTINATION_OPTIONS = [
  { code: 'TR', label: 'Turkey', phone: '90' },
  { code: 'MY', label: 'Malaysia', phone: '60' },
  { code: 'QA', label: 'Qatar', phone: '974' },
  { code: 'AE', label: 'United Arab Emirates', phone: '971' },
  { code: 'SA', label: 'Saudi Arabia', phone: '966' },
  { code: 'MA', label: 'Morocco', phone: '212' },
  { code: 'ID', label: 'Indonesia', phone: '62' },
  { code: 'EG', label: 'Egypt', phone: '20' },
];

export const HIJRA_SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'priceDesc', label: 'Price: High-Low' },
  { value: 'priceAsc', label: 'Price: Low-High' },
];

export const HIJRA_PUBLISH_OPTIONS = [
  {
    value: 'published',
    label: 'Published',
  },
  {
    value: 'draft',
    label: 'Draft',
  },
];

export const HIJRA_DETAILS_TABS = [
  { value: 'content', label: 'Package Details' },
  { value: 'clients', label: 'Clients' },
];

// ----------------------------------------------------------------------

const LANGUAGES = ['Arabic', 'English', 'Turkish', 'Malay', 'Indonesian', 'French', 'Urdu', 'Persian'];

export const _hijraGuides = [...Array(12)].map((_, index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  phoneNumber: _mock.phoneNumber(index),
  languages: [...Array(2)].map((_, i) => LANGUAGES[(i + index) % LANGUAGES.length]),
  yearsInCountry: _mock.number.age(index) % 10 + 2,
}));

export const _hijraClients = [...Array(12)].map((_, index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  familyMembers: (index % 4) + 1,
}));

export const _hijraPackages = [...Array(24)].map((_, index) => {
  const available = {
    startDate: _mock.time(index),
    endDate: _mock.time(index + 1),
  };

  const publish = (index % 3 ? 'published' : 'draft') as string;

  const destination = HIJRA_DESTINATION_OPTIONS[index % HIJRA_DESTINATION_OPTIONS.length].label;

  const services = [...Array((index % 4) + 2)].map(
    (__, _index) => HIJRA_SERVICE_OPTIONS[(_index + index) % HIJRA_SERVICE_OPTIONS.length].value
  );

  const guides = [...Array(3)].map((__, _index) => {
    const guideIndex = (index + _index) % _hijraGuides.length;
    return _hijraGuides[guideIndex];
  });

  const clients = [...Array((index % 10) + 6)].map((__, _index) => {
    const clientIndex = (index + _index) % _hijraClients.length;
    return _hijraClients[clientIndex];
  });

  const benefits = [
    'Authentic cultural experience',
    'Local guide and companion',
    'Assistance with paperwork',
    'Housing options preparation',
    'Islamic community introduction',
    'Language learning resources',
    'Job opportunity connections',
    'School enrollment assistance',
  ].slice(0, (index % 4) + 4);

  const requirements = [
    'Valid passport',
    'Visa application',
    'Financial proof',
    'Medical insurance',
    'Background check',
    'Intention letter',
  ].slice(0, (index % 3) + 3);

  const housingOptions = [
    'Apartment in Muslim neighborhood',
    'House near masjid',
    'Temporary housing while searching',
    'Shared accommodation with other families',
    'Rental with option to buy',
  ].slice(0, (index % 3) + 2);

  return {
    id: _mock.id(index),
    name: `Hijra Package: ${destination}`,
    duration: _mock.sentence(index % 3),
    price: _mock.number.price(index),
    priceSale: index % 3 === 0 ? 0 : _mock.number.price(index / 2),
    totalViews: (index + 1) * 100,
    tags: [...Array(3)].map((__, _index) => _tags[(_index + index) % _tags.length]),
    publish,
    destination,
    services,
    images: [...Array(3)].map((__, _index) => _mock.image.travel((_index + index) % 20)),
    content: index < 3 ? 
      `This comprehensive Hijra package offers complete support for Muslims looking to relocate to ${destination}. Our experienced guides who have lived in the country for years will assist with housing, paperwork, school enrollment, and community integration. The package includes assistance with navigating local bureaucracy, finding suitable housing near mosques, getting connected with the local Muslim community, and all essential services to make your Hijra journey smooth and blessed.` :
      `Join our community of Muslims who have successfully made Hijra to ${destination}. This package provides you with all the necessary support from experienced guides who understand both the practical and spiritual aspects of Hijra. We'll help you navigate local systems, find appropriate housing, connect with Islamic institutions, and build a new life in a more Muslim-friendly environment.`,
    benefits,
    requirements,
    housingOptions,
    ratingNumber: _mock.number.rating(index),
    guides,
    clients,
    createdAt: _mock.time(index),
    available,
  };
}); 