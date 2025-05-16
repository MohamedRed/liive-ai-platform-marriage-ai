import type { IHijraItem } from '@livve-1/database-types';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { HijraNewEditForm } from '../../../sections/hijra/hijra-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  hijraPackage?: IHijraItem;
};

export function HijraEditView({ hijraPackage }: Props) {
  return (
    <DashboardContent sx={{ p: { xs: 2, md: 3 } }}>
      <CustomBreadcrumbs
        heading="Edit"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Hijra', href: paths.dashboard.hijra.root },
          { name: hijraPackage?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <HijraNewEditForm currentPackage={hijraPackage} />
    </DashboardContent>
  );
} 