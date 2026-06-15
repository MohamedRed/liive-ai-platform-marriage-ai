import { Helmet } from 'react-helmet-async';

import { CityEventList } from 'src/sections/city/event';

// ----------------------------------------------------------------------

export default function CityEventsPage() {
  return (
    <>
      <Helmet>
        <title>City: Events</title>
      </Helmet>

      <CityEventList />
    </>
  );
} 