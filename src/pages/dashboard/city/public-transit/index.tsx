import { Helmet } from 'react-helmet-async';

import { CityPublicTransit } from 'src/sections/city/public-transit';

// ----------------------------------------------------------------------

export default function CityPublicTransitPage() {
  return (
    <>
      <Helmet>
        <title>City: Public Transit</title>
      </Helmet>

      <CityPublicTransit />
    </>
  );
} 