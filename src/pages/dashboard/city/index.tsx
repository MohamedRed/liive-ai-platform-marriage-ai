import { Helmet } from 'react-helmet-async';
import { useState, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { 
  CityWidgetSummary, 
  CityRestaurantList, 
  CityEventList, 
  CityOrderList,
  useCityData
} from '../../../sections/city';

// ----------------------------------------------------------------------

export default function CityDashboardPage() {
  const settings = useSettingsContext();

  const [currentTab, setCurrentTab] = useState('overview');

  const handleChangeTab = useCallback((event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  }, []);

  const TABS = [
    {
      value: 'overview',
      label: 'Overview',
      icon: <Iconify icon="solar:home-2-bold-duotone" width={24} />,
    },
    {
      value: 'restaurants',
      label: 'Restaurants',
      icon: <Iconify icon="solar:shop-bold-duotone" width={24} />,
    },
    {
      value: 'events',
      label: 'Events',
      icon: <Iconify icon="solar:calendar-bold-duotone" width={24} />,
    },
    {
      value: 'orders',
      label: 'Orders',
      icon: <Iconify icon="solar:cart-large-bold-duotone" width={24} />,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard: City</title>
      </Helmet>

      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading="City Dashboard"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'City' },
          ]}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flexGrow: 1 }} />
            </Box>
          }
          sx={{
            mb: { xs: 3, md: 5 },
          }}
        />

        <Tabs
          value={currentTab}
          onChange={handleChangeTab}
          sx={{
            mb: 3,
          }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {currentTab === 'overview' && <CityOverview />}
        {currentTab === 'restaurants' && <CityRestaurantList />}
        {currentTab === 'events' && <CityEventList />}
        {currentTab === 'orders' && <CityOrderList />}
      </Container>
    </>
  );
}

// ----------------------------------------------------------------------

function CityOverview() {
  const { 
    statistics, 
    loading, 
    error, 
    getCityStatistics 
  } = useCityData();

  useEffect(() => {
    getCityStatistics();
  }, [getCityStatistics]);

  return (
    <Grid container spacing={3}>
      <Grid xs={12} md={3}>
        <CityWidgetSummary
          title="Total Restaurants"
          total={statistics.totalRestaurants}
          icon={<Iconify icon="solar:shop-bold-duotone" width={28} />}
        />
      </Grid>

      <Grid xs={12} md={3}>
        <CityWidgetSummary
          title="Total Events"
          total={statistics.totalEvents}
          color="secondary"
          icon={<Iconify icon="solar:calendar-bold-duotone" width={28} />}
        />
      </Grid>

      <Grid xs={12} md={3}>
        <CityWidgetSummary
          title="Total Orders"
          total={statistics.totalOrders}
          color="success"
          icon={<Iconify icon="solar:cart-large-bold-duotone" width={28} />}
        />
      </Grid>

      <Grid xs={12} md={3}>
        <CityWidgetSummary
          title="Public Transit Routes"
          total={statistics.totalPublicTransit}
          color="info"
          icon={<Iconify icon="solar:bus-bold-duotone" width={28} />}
        />
      </Grid>

      <Grid xs={12} md={6} lg={8}>
        <Card sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Activity
          </Typography>
          {loading ? (
            <Box sx={{ textAlign: 'center', p: 2, color: 'text.secondary' }}>
              Loading...
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', p: 2, color: 'error.main' }}>
              {error}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Recent activity will be displayed here. This panel would typically show a timeline
              of activities like new restaurant additions, order completions, etc.
            </Typography>
          )}
        </Card>
      </Grid>

      <Grid xs={12} md={6} lg={4}>
        <Card sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Common actions for city administrators would be displayed here.
          </Typography>
        </Card>
      </Grid>
    </Grid>
  );
} 