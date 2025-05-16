import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Unstable_Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { BusinessType } from 'src/pages/dashboard/business-owner';
import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  businessType: BusinessType;
};

export default function BusinessOwnerOverview({ businessType }: Props) {
  // In a real app, these would come from API calls based on the business ID
  const getMetricsForBusinessType = () => {
    const commonMetrics = [
      {
        title: 'Total Orders',
        total: businessType === BusinessType.RESTAURANT ? 147 : 
               businessType === BusinessType.EVENT ? 78 : 32,
        icon: 'solar:cart-large-bold-duotone',
        color: 'success',
      },
      {
        title: 'Total Revenue',
        total: businessType === BusinessType.RESTAURANT ? '$4,290.00' : 
               businessType === BusinessType.EVENT ? '$15,890.00' : '$2,430.00',
        icon: 'solar:dollar-minimalistic-bold-duotone',
        color: 'info',
      },
    ];

    // Add business-specific metrics
    if (businessType === BusinessType.RESTAURANT) {
      return [
        ...commonMetrics,
        {
          title: 'Menu Items',
          total: 48,
          icon: 'solar:document-bold-duotone',
          color: 'warning',
        },
        {
          title: 'Average Rating',
          total: '4.7',
          icon: 'solar:star-bold-duotone',
          color: 'error',
        },
      ];
    }

    if (businessType === BusinessType.EVENT) {
      return [
        ...commonMetrics,
        {
          title: 'Upcoming Events',
          total: 12,
          icon: 'solar:calendar-bold-duotone',
          color: 'warning',
        },
        {
          title: 'Tickets Sold',
          total: 1240,
          icon: 'solar:ticket-bold-duotone',
          color: 'error',
        },
      ];
    }

    if (businessType === BusinessType.TRANSIT) {
      return [
        ...commonMetrics,
        {
          title: 'Active Routes',
          total: 8,
          icon: 'solar:road-bold-duotone',
          color: 'warning',
        },
        {
          title: 'Passengers',
          total: 15600,
          icon: 'solar:user-bold-duotone',
          color: 'error',
        },
      ];
    }

    return commonMetrics;
  };

  const metrics = getMetricsForBusinessType();

  // Mock recent orders data
  const recentOrders = [
    {
      id: 'ORD-123',
      customerName: 'John Doe',
      date: new Date('2023-03-15T08:30:00'),
      amount: 42.99,
      status: 'completed',
    },
    {
      id: 'ORD-124', 
      customerName: 'Jane Smith',
      date: new Date('2023-03-15T09:45:00'),
      amount: 29.50,
      status: 'processing',
    },
    {
      id: 'ORD-125',
      customerName: 'Mike Johnson',
      date: new Date('2023-03-15T11:20:00'),
      amount: 36.75,
      status: 'completed',
    },
    {
      id: 'ORD-126',
      customerName: 'Sarah Williams',
      date: new Date('2023-03-15T12:15:00'),
      amount: 22.80,
      status: 'processing',
    },
    {
      id: 'ORD-127',
      customerName: 'David Brown',
      date: new Date('2023-03-15T14:30:00'),
      amount: 51.25,
      status: 'completed',
    },
  ];

  const getBusinessTypeSpecificContent = () => {
    if (businessType === BusinessType.RESTAURANT) {
      return (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Popular Menu Items
          </Typography>
          <Stack spacing={2}>
            {['Margherita Pizza', 'Pasta Carbonara', 'Tiramisu', 'Caprese Salad', 'Risotto'].map((item, index) => (
              <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{item}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {20 - index * 2} orders this week
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      );
    }

    if (businessType === BusinessType.EVENT) {
      return (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Upcoming Events
          </Typography>
          <Stack spacing={2}>
            {['Summer Music Festival', 'Food & Wine Expo', 'Tech Conference', 'Art Exhibition', 'Comedy Night'].map((item, index) => (
              <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{item}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {fDate(new Date(new Date().setDate(new Date().getDate() + (index + 1) * 5)))}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      );
    }

    if (businessType === BusinessType.TRANSIT) {
      return (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Transit Route Status
          </Typography>
          <Stack spacing={2}>
            {['Downtown Loop', 'Airport Express', 'North-South Line', 'University Route', 'Beach Shuttle'].map((item, index) => (
              <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{item}</Typography>
                <Box 
                  sx={{ 
                    color: index === 2 ? 'warning.main' : 'success.main',
                    display: 'flex',
                    alignItems: 'center' 
                  }}
                >
                  <Iconify 
                    icon={index === 2 ? 'solar:clock-circle-bold' : 'solar:check-circle-bold'} 
                    sx={{ mr: 0.5, width: 18, height: 18 }}
                  />
                  <Typography variant="body2">
                    {index === 2 ? 'Delayed' : 'On Time'}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Card>
      );
    }

    return null;
  };

  const getStatusColor = (status: string) => {
    return status === 'completed' ? 'success.main' : 
           status === 'processing' ? 'info.main' : 
           status === 'cancelled' ? 'error.main' : 'text.secondary';
  };

  return (
    <Grid container spacing={3}>
      {/* Metrics cards */}
      {metrics.map((metric, index) => (
        <Grid key={index} xs={12} sm={6} md={3}>
          <Card sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: `${metric.color}.lightest`, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <Iconify icon={metric.icon} width={24} height={24} color={`${metric.color}.main`} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  {metric.title}
                </Typography>
                <Typography variant="h4">{metric.total}</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      ))}

      {/* Recent orders */}
      <Grid xs={12} md={7}>
        <Card sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Orders
          </Typography>
          <Stack spacing={2}>
            {recentOrders.map((order) => (
              <Stack key={order.id} direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2">{order.id}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.customerName}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {fDate(order.date)}
                </Typography>
                <Typography variant="subtitle2">{fCurrency(order.amount)}</Typography>
                <Typography variant="body2" sx={{ color: getStatusColor(order.status) }}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Grid>

      {/* Business-specific content */}
      <Grid xs={12} md={5}>
        {getBusinessTypeSpecificContent()}
      </Grid>
    </Grid>
  );
} 