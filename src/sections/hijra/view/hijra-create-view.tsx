import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { HijraNewEditForm } from '../hijra-new-edit-form';

// ----------------------------------------------------------------------

export function HijraCreateView() {
  return (
    <DashboardContent sx={{ p: { xs: 2, md: 3 } }}>
      <CustomBreadcrumbs
        heading="Create a new Hijra package"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Hijra', href: paths.dashboard.hijra.root },
          { name: 'New Package' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <HijraNewEditForm />
    </DashboardContent>
  );
} 