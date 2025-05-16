import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { HijraListView } from 'src/sections/hijra/view';

// ----------------------------------------------------------------------

const metadata = { title: `Hijra Packages | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <HijraListView />
    </>
  );
} 