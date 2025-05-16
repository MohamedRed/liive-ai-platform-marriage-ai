import { Helmet } from 'react-helmet-async';

import { CityRestaurantList } from 'src/sections/city/restaurant';

// ----------------------------------------------------------------------

export default function CityRestaurantsPage() {
  return (
    <>
      <Helmet>
        <title>City: Restaurants</title>
      </Helmet>

      <CityRestaurantList />
    </>
  );
} 