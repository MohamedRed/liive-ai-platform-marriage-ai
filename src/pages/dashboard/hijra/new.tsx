import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';
import { Container, Typography, Button, Box } from '@mui/material';
import { DashboardContent } from 'src/layouts/dashboard';
import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { HijraCreateView } from 'src/sections/hijra/view';

// ----------------------------------------------------------------------

const metadata = { title: `Create Hijra Package | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <HijraCreateView />
    </>
  );
} 