import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { useSettingsContext } from 'src/components/settings';
import { useAuthContext } from 'src/auth/hooks';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { Iconify } from 'src/components/iconify';

// We'll create placeholder components for now; replace with actual components later
const BusinessOwnerOverview = ({ businessType }: { businessType: BusinessType }) => (
  <Typography variant="h6" sx={{ p: 3 }}>Overview for {businessType} business</Typography>
);

const BusinessOwnerRestaurant = {
  MenuManagement: () => <Typography variant="h6" sx={{ p: 3 }}>Restaurant Menu Management</Typography>,
};

const BusinessOwnerEvent = {
  EventManagement: () => <Typography variant="h6" sx={{ p: 3 }}>Event Management</Typography>,
};

const BusinessOwnerTransit = {
  RouteManagement: () => <Typography variant="h6" sx={{ p: 3 }}>Transit Route Management</Typography>,
};

// ----------------------------------------------------------------------

// This would normally come from user profile or auth context
export enum BusinessType {
  RESTAURANT = 'restaurant',
  EVENT = 'event',
  TRANSIT = 'transit',
}

// Business type metadata
const BUSINESS_TYPE_CONFIG = {
  [BusinessType.RESTAURANT]: {
    name: 'Pasta Paradise',
    icon: 'solar:shop-bold-duotone',
    color: 'primary.main',
  },
  [BusinessType.EVENT]: {
    name: 'City Events Co.',
    icon: 'solar:calendar-bold-duotone',
    color: 'info.main',
  },
  [BusinessType.TRANSIT]: {
    name: 'Metro Transit',
    icon: 'solar:bus-bold-duotone',
    color: 'success.main',
  },
};

export default function BusinessOwnerDashboard() {
  const router = useRouter();
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  
  // For now, we'll use a state to mock the business type
  // In a real app, this would come from the user's profile
  const [businessType, setBusinessType] = useState<BusinessType>(BusinessType.RESTAURANT);
  const [currentTab, setCurrentTab] = useState('overview');

  // Get business metadata
  const businessConfig = BUSINESS_TYPE_CONFIG[businessType];

  const handleChangeTab = (event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  };

  const getBusinessTypeTabs = () => {
    const commonTabs = [
      {
        value: 'overview',
        label: 'Overview',
        icon: <Iconify icon="solar:home-2-bold-duotone" width={24} />,
      },
      {
        value: 'orders',
        label: 'Orders',
        icon: <Iconify icon="solar:cart-large-bold-duotone" width={24} />,
      },
      {
        value: 'settings',
        label: 'Settings',
        icon: <Iconify icon="solar:settings-bold-duotone" width={24} />,
      },
    ];

    // Add business-specific tabs
    if (businessType === BusinessType.RESTAURANT) {
      return [
        ...commonTabs,
        {
          value: 'menu',
          label: 'Menu Management',
          icon: <Iconify icon="solar:document-bold-duotone" width={24} />,
        },
      ];
    }
    
    if (businessType === BusinessType.EVENT) {
      return [
        ...commonTabs,
        {
          value: 'events',
          label: 'Event Management',
          icon: <Iconify icon="solar:calendar-mark-bold-duotone" width={24} />,
        },
      ];
    }
    
    if (businessType === BusinessType.TRANSIT) {
      return [
        ...commonTabs,
        {
          value: 'routes',
          label: 'Route Management',
          icon: <Iconify icon="solar:road-bold-duotone" width={24} />,
        },
      ];
    }

    return commonTabs;
  };

  const tabs = getBusinessTypeTabs();
  
  // For demo/development purposes only
  const handleChangeBusinessType = (event: any) => {
    setBusinessType(event.target.value as BusinessType);
  };

  return (
    <>
      <Helmet>
        <title>{`Business Owner: ${businessConfig.name}`}</title>
      </Helmet>

      <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {/* Header */}
        <CustomBreadcrumbs
          heading={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify 
                icon={businessConfig.icon} 
                width={32} 
                height={32} 
                sx={{ color: businessConfig.color }}
              />
              <Typography variant="h4">{businessConfig.name}</Typography>
            </Stack>
          }
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Business Owner', href: paths.dashboard.businessOwner.root },
            { name: businessConfig.name },
          ]}
          action={
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="business-type-selector">Business Type</InputLabel>
              <Select
                labelId="business-type-selector"
                value={businessType}
                onChange={handleChangeBusinessType}
                label="Business Type"
                size="small"
                sx={{ maxHeight: 40 }}
                startAdornment={
                  <Iconify 
                    icon={businessConfig.icon} 
                    width={20} 
                    sx={{ mr: 1, color: businessConfig.color }}
                  />
                }
              >
                <MenuItem value={BusinessType.RESTAURANT}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify 
                      icon={BUSINESS_TYPE_CONFIG[BusinessType.RESTAURANT].icon} 
                      width={20} 
                      sx={{ color: 'primary.main' }}
                    />
                    <span>Restaurant</span>
                  </Stack>
                </MenuItem>
                <MenuItem value={BusinessType.EVENT}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify 
                      icon={BUSINESS_TYPE_CONFIG[BusinessType.EVENT].icon} 
                      width={20}
                      sx={{ color: 'info.main' }}
                    />
                    <span>Event</span>
                  </Stack>
                </MenuItem>
                <MenuItem value={BusinessType.TRANSIT}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify 
                      icon={BUSINESS_TYPE_CONFIG[BusinessType.TRANSIT].icon} 
                      width={20}
                      sx={{ color: 'success.main' }}
                    />
                    <span>Transit</span>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
          }
          sx={{
            mb: { xs: 3, md: 5 },
          }}
        />

        <Card sx={{ mb: 3, p: { xs: 0, sm: 1, md: 2 } }}>
          <Tabs
            value={currentTab}
            onChange={handleChangeTab}
            sx={{
              px: 2,
              bgcolor: 'background.neutral',
              '& .MuiTab-root': { py: 1.5 },
            }}
          >
            {tabs.map(tab => (
              <Tab 
                key={tab.value} 
                value={tab.value} 
                label={tab.label} 
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>

          <Divider />

          <Box sx={{ p: 4 }}>
            {currentTab === 'overview' && <BusinessOwnerOverview businessType={businessType} />}
            
            {/* Business-specific content */}
            {businessType === BusinessType.RESTAURANT && currentTab === 'menu' && (
              <BusinessOwnerRestaurant.MenuManagement />
            )}
            
            {businessType === BusinessType.EVENT && currentTab === 'events' && (
              <BusinessOwnerEvent.EventManagement />
            )}
            
            {businessType === BusinessType.TRANSIT && currentTab === 'routes' && (
              <BusinessOwnerTransit.RouteManagement />
            )}
            
            {/* Common tabs for all business types */}
            {currentTab === 'orders' && (
              <Typography variant="h6">Orders management would go here</Typography>
            )}
            
            {currentTab === 'settings' && (
              <Typography variant="h6">Business settings would go here</Typography>
            )}
          </Box>
        </Card>
      </Container>
    </>
  );
} 