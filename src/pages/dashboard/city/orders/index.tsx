import { Helmet } from 'react-helmet-async';

import { CityOrderList } from 'src/sections/city/order';

// ----------------------------------------------------------------------

export default function CityOrdersPage() {
  return (
    <>
      <Helmet>
        <title>City: Orders</title>
      </Helmet>

      <CityOrderList />
    </>
  );
} 