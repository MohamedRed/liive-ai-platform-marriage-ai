import { useState } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { _hijraPackages, HIJRA_DETAILS_TABS } from 'src/_mock/_hijra';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { HijraDetailsContent } from '../hijra-details-content';
import { HijraDetailsClients } from '../hijra-details-clients';

import type { IHijraItem } from '@livve-1/database-types';

// ----------------------------------------------------------------------

type Props = {
  hijraPackage?: IHijraItem;
};

export function HijraDetailsView({ hijraPackage }: Props) {
  const [currentTab, setCurrentTab] = useState('content');

  const handleChangeTab = (_event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  };

  return (
    <DashboardContent>
      <Container>
        <CustomBreadcrumbs
          heading="Package Details"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hijra', href: paths.dashboard.hijra.root },
            { name: hijraPackage?.name || '' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Tabs
          value={currentTab}
          onChange={handleChangeTab}
          sx={{
            mb: { xs: 3, md: 5 },
          }}
        >
          {HIJRA_DETAILS_TABS.map((tab) => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>

        {currentTab === 'content' && <HijraDetailsContent hijraPackage={hijraPackage} />}

        {currentTab === 'clients' && <HijraDetailsClients clients={hijraPackage?.clients} />}
      </Container>
    </DashboardContent>
  );
} 