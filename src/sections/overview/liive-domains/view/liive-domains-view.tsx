import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import type { ColorType } from 'src/theme/core/palette';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard';
import { paths } from 'src/routes/paths';

import { LiiveDomainCard } from '..';

// ----------------------------------------------------------------------

const LIIVE_DOMAINS = [
  // Marriage, Hijra, Hajj, and Mosque Community group
  {
    id: 'marriage',
    title: 'Marriage',
    color: 'primary' as ColorType,
    navigateTo: paths.dashboard.assistant,
    description: 'Your personal AI marriage counselor and relationship guide'
  },
  {
    id: 'hijra',
    title: 'Hijra',
    color: 'warning' as ColorType,
    navigateTo: paths.dashboard.hijra.root,
    description: 'Support for Muslims making hijra to Muslim countries with housing and local guides',
    status: 'active',
  },
  {
    id: 'hajj',
    title: 'Hajj/Umra',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.hajj.root,
    description: 'Comprehensive assistance for Hajj and Umra pilgrimage planning',
    status: 'active',
  },
  {
    id: 'mosque-community',
    title: 'Mosque Community',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Connect with your local mosque community, find events, and strengthen your spiritual bonds'
  },
  
  // Cooking and Health group
  {
    id: 'cooking',
    title: 'Cooking',
    color: 'warning' as ColorType,
    navigateTo: paths.dashboard.mealPlanning,
    description: 'Get personalized recipes and cooking assistance. Create weekly meal plans with cooking videos and step-by-step guidance'
  },
  {
    id: 'health',
    title: 'Health',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.health,
    description: 'Explore 3D human body, learn about organs, nutrients, and supplements'
  },
  
  // News and Polls group
  {
    id: 'news',
    title: 'News',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.news.root,  // Updated to link to news section
    description: 'Personalized news updates and insights on topics that matter to you, with both positive and negative news separately',
    status: 'active',
  },
  {
    id: 'polls',
    title: 'Polls',
    color: 'secondary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Create and analyze polls to gather community opinions and feedback'
  },
  
  // Friends, City, Ridesharing, and Traveling group
  {
    id: 'friends',
    title: 'Friends',
    color: 'primary' as ColorType,
    navigateTo: paths.dashboard.friends,
    description: 'Build and maintain meaningful friendships with personalized advice and connection insights',
    status: 'active',
  },
  {
    id: 'city',
    title: 'City',
    color: 'secondary' as ColorType,
    navigateTo: paths.dashboard.city.root,  // Now links to city admin panel
    description: 'Urban living, restaurants, events, and city services management',
    status: 'active',
  },
  {
    id: 'ridesharing',
    title: 'Ridesharing',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.ridesharing,
    description: 'Smart ride planning and carpooling optimization',
    status: 'active',
  },
  {
    id: 'traveling',
    title: 'Traveling',
    color: 'error' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Personalized travel planning and recommendations'
  },
  
  // Charity, Help, and Lost Things group
  {
    id: 'charity',
    title: 'Charity',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Guidance on charitable giving and finding meaningful ways to help others'
  },
  {
    id: 'help',
    title: 'Help',
    color: 'error' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Get immediate assistance with any questions or urgent needs you may have'
  },
  {
    id: 'lost-things',
    title: 'Lost Things',
    color: 'warning' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Help locate and recover your lost items with smart suggestions and tracking'
  },
  
  // Second Hand and Personal Ads group
  {
    id: 'second-hand',
    title: 'Second Hand',
    color: 'secondary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Buy and sell pre-owned items within your community in a sustainable way'
  },
  {
    id: 'personal-ads',
    title: 'Personalized Ads',
    color: 'primary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'View tailored advertisements based on your interests and needs, with AI-powered recommendations'
  },
  {
    id: 'loyalty-coupons',
    title: 'Loyalty/Coupons',
    color: 'warning' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Manage loyalty rewards and find exclusive coupons for products and services you love'
  },
  
  // Jobs
  {
    id: 'jobs',
    title: 'Jobs',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Career guidance and job search optimization'
  },
  
  // App Builder
  {
    id: 'builder',
    title: 'App Builder',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.builder,
    description: 'Create and customize your own AI applications using Claude Code.',
    status: 'active',
    path: '/builder',
  },
  
  // Banking
  {
    id: 'banking',
    title: 'Banking',
    color: 'success' as ColorType,
    navigateTo: paths.dashboard.banking.root,
    description: 'Personal finance management and banking assistance',
    status: 'active',
  },
  
  // Admin (keeping it last as it seems to be a utility category)
  {
    id: 'admin',
    title: 'Admin',
    color: 'primary' as ColorType,
    navigateTo: paths.dashboard.city.root,
    description: 'Platform administration for domains and services',
    status: 'active',
  },
];

// ----------------------------------------------------------------------

export function LiiveDomainsView() {
  const theme = useTheme();

  // Group the domains by their comments
  const domainGroups = [
    { name: "Religion & Community", domains: LIIVE_DOMAINS.slice(0, 4) },
    { name: "Health & Wellness", domains: LIIVE_DOMAINS.slice(4, 6) },
    { name: "News & Information", domains: LIIVE_DOMAINS.slice(6, 8) },
    { name: "Social & Transportation", domains: LIIVE_DOMAINS.slice(8, 12) },
    { name: "Assistance & Support", domains: LIIVE_DOMAINS.slice(12, 15) },
    { name: "Marketplace", domains: LIIVE_DOMAINS.slice(15, 18) },
    { name: "Jobs", domains: LIIVE_DOMAINS.slice(18, 19) },
    { name: "Other Services", domains: LIIVE_DOMAINS.slice(19) }
  ];

  return (
    <DashboardContent 
      maxWidth="xl" 
      sx={{ 
        p: { xs: 1, sm: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: { xs: 'calc(100vh - 64px)', sm: 'calc(100vh - 92px)' },
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`
      }}
    >
      <Box 
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
          py: { xs: 1, sm: 2, md: 3 },
          maxWidth: 1200,
          mx: 'auto',
          position: 'relative',
          zIndex: 1
        }}
      >
        <Box
          sx={{
            position: 'relative',
            mb: { xs: 1, md: 2 },
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '120%',
              height: '120%',
              background: `radial-gradient(circle, ${theme.palette.primary.lighter} 0%, ${theme.palette.primary.lighter}00 70%)`,
              zIndex: -1,
              borderRadius: '50%',
              filter: 'blur(40px)',
            }
          }}
        >
          <Typography 
            variant="h2" 
            sx={{ 
              textAlign: 'center',
              fontWeight: 700,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              letterSpacing: '-0.02em',
              background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.primary.main} 90%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              position: 'relative',
              zIndex: 1
            }}
          >
            Liive
          </Typography>
        </Box>

        <Typography 
          variant="h6" 
          color="text.secondary" 
          sx={{ 
            mb: { xs: 2, md: 3 }, 
            textAlign: 'center', 
            maxWidth: 600,
            fontWeight: 400,
            fontSize: { xs: '0.875rem', sm: '1rem' },
            lineHeight: 1.4,
            opacity: 0.8,
            position: 'relative',
            zIndex: 1
          }}
        >
          Choose a domain to explore.
        </Typography>

        <Box 
          sx={{ 
            width: '100%', 
            my: 'auto',
            px: { xs: 1, sm: 1 },
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            maxWidth: '1200px',
            mx: 'auto'
          }}
        >
          {domainGroups.map((group, index) => (
            <Box key={index} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
              <Box sx={{ maxWidth: '1000px', width: '100%', mx: 'auto' }}>
                <Grid 
                  container 
                  spacing={{ xs: 1.5, sm: 2, md: 2 }} 
                  justifyContent="flex-start"
                  alignItems="center"
                  sx={{ width: '100%', pl: { xs: 2, sm: 3, md: 4 } }}
                >
                  {group.domains.map((domain) => (
                    <Grid 
                      key={domain.id} 
                      xs={6} 
                      sm={4} 
                      md={3} 
                      lg={2}
                      sx={{ 
                        width: { xs: '160px', sm: '180px', md: '200px' },
                        height: { xs: '160px', sm: '180px', md: '200px' },
                        padding: '8px',
                        boxSizing: 'border-box',
                        transition: 'transform 0.3s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)'
                        }
                      }}
                    >
                      <LiiveDomainCard
                        title={domain.title}
                        color={domain.color}
                        navigateTo={domain.navigateTo}
                        description={domain.description}
                        sx={{ 
                          opacity: domain.navigateTo ? 1 : 0.7,
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            boxShadow: (theme) => theme.shadows[8]
                          },
                          backgroundColor: theme.palette.background.paper,
                          width: '100%',
                          height: '100%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                          fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
                          padding: { xs: '10px', sm: '12px', md: '15px' },
                          overflow: 'hidden'
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </DashboardContent>
  );
} 