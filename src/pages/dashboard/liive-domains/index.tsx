import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { LiiveDomainsView } from 'src/sections/overview/liive-domains/view';

// ----------------------------------------------------------------------

const metadata = { title: `Liive AI Domains | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <LiiveDomainsView />
    </>
  );
} 