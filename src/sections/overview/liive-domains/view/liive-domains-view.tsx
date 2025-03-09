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
  {
    id: 'marriage',
    title: 'Marriage',
    color: 'primary' as ColorType,
    navigateTo: paths.dashboard.assistant,
    description: 'Your personal AI marriage counselor and relationship guide'
  },
  {
    id: 'builder',
    title: 'App Builder',
    color: 'info' as ColorType,
    navigateTo: paths.dashboard.builder,
    description: 'Create and customize your own AI applications using Claude Code.',
    status: 'active',
    path: '/builder',
  },
  {
    id: 'hijra',
    title: 'Hijra',
    color: 'warning' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Guidance and support for your spiritual journey and religious practices'
  },
  {
    id: 'hajj',
    title: 'Hajj/Umra',
    color: 'info' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Comprehensive assistance for Hajj and Umra pilgrimage planning'
  },
  {
    id: 'cooking',
    title: 'Cooking',
    color: 'warning' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Get personalized recipes and cooking assistance'
  },
  {
    id: 'charity',
    title: 'Charity',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Guidance on charitable giving and finding meaningful ways to help others'
  },
  {
    id: 'news',
    title: 'News',
    color: 'info' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Personalized news updates and insights on topics that matter to you'
  },
  {
    id: 'polls',
    title: 'Polls',
    color: 'secondary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Create and analyze polls to gather community opinions and feedback'
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
  {
    id: 'friends',
    title: 'Friends',
    color: 'primary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Build and maintain meaningful friendships with personalized advice and connection insights'
  },
  {
    id: 'mosque-community',
    title: 'Mosque Community',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Connect with your local mosque community, find events, and strengthen your spiritual bonds'
  },
  {
    id: 'ridesharing',
    title: 'Ridesharing',
    color: 'info' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Smart ride planning and carpooling optimization'
  },
  {
    id: 'city',
    title: 'City',
    color: 'secondary' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Your urban living and city services assistant'
  },
  {
    id: 'jobs',
    title: 'Jobs',
    color: 'success' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Career guidance and job search optimization'
  },
  {
    id: 'traveling',
    title: 'Traveling',
    color: 'error' as ColorType,
    navigateTo: '',  // Not implemented yet
    description: 'Personalized travel planning and recommendations'
  },
];

// ----------------------------------------------------------------------

export function LiiveDomainsView() {
  const theme = useTheme();

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

        <Grid 
          container 
          spacing={{ xs: 1.5, sm: 2, md: 2 }} 
          justifyContent="center"
          alignItems="center"
          sx={{ 
            width: '100%', 
            my: 'auto',
            px: { xs: 1, sm: 1 },
            position: 'relative',
            zIndex: 1
          }}
        >
          {LIIVE_DOMAINS.map((domain) => (
            <Grid 
              key={domain.id} 
              xs={6} 
              sm={6} 
              md={4} 
              lg={3} 
              sx={{ 
                maxWidth: { xs: '160px', sm: '180px', md: '200px' },
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
                  minHeight: { xs: '140px', sm: '100px' }
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </DashboardContent>
  );
} 