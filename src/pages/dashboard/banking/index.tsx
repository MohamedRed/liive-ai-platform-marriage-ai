import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import { BankingDashboard } from 'src/sections/banking/banking-dashboard';

// ----------------------------------------------------------------------

const metadata = { title: `Banking | Dashboard - ${CONFIG.site.name}` };

export default function BankingPage() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <BankingDashboard />
    </>
  );
}
