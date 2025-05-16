import React from 'react';
import { Typography, Box, Container, Link, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { paths } from 'src/routes/paths';

export default function TestNewsRoute() {
  return (
    <Container>
      <Box sx={{ py: 5 }}>
        <Typography variant="h3" component="h1" paragraph>
          News Routes Test Page
        </Typography>
        <Typography paragraph>
          This is a simple test page to verify that the news routes are working correctly.
        </Typography>
        
        <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h5">News Route Links:</Typography>
          
          <Button 
            component={RouterLink} 
            to={paths.dashboard.news.root}
            variant="contained"
          >
            News List Page
          </Button>
          
          <Button 
            component={RouterLink} 
            to={paths.dashboard.news.positive}
            variant="contained"
            color="success"
          >
            Positive News
          </Button>
          
          <Button 
            component={RouterLink} 
            to={paths.dashboard.news.negative}
            variant="contained"
            color="error"
          >
            Negative News
          </Button>
          
          <Button 
            component={RouterLink} 
            to={paths.dashboard.news.details('example-news-article')}
            variant="contained"
            color="info"
          >
            News Details Page
          </Button>
        </Box>
      </Box>
    </Container>
  );
} 