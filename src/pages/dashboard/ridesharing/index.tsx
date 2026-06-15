import { Helmet } from 'react-helmet-async';
import { RidesharingCustomView } from 'src/sections/ridesharing/view/ridesharing-custom-view';

// ----------------------------------------------------------------------

export default function RidesharingPage() {
  return (
    <>
      <Helmet>
        <title>Ridesharing | Liive AI</title>
      </Helmet>

      <RidesharingCustomView />
    </>
  );
} 