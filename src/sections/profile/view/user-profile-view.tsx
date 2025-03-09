import { motion } from 'framer-motion';
import {useCallback} from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';

import {useMockedUser} from 'src/auth/hooks';
import {useTabs} from '../../../hooks/use-tabs';
import {ProfileCover} from '../profile-cover';
import {useProfile} from "../hooks/use-profile";
import { MatchSummaryWidget } from 'src/sections/assistant/match-summary-widget';
import {ProfileGallery} from '../profile-gallery';
import {ProfileFollowers} from '../profile-followers';
import {ProfileFriends} from '../profile-friends';
import {ProfileHome} from '../profile-home';
import {_userAbout} from 'src/_mock';

// ----------------------------------------------------------------------

export default function UserProfileView() {
  const {user} = useMockedUser();
  const tabs = useTabs('profile');
  const {profile} = useProfile();

  return (
    <Box sx={{ pl: 1, pr: 1, pb: 2 }}>
      <Container maxWidth={false}>
      <Card sx={{mb: 3}}>
        <ProfileCover
          role={_userAbout.role}
          name={user?.displayName}
          avatarUrl={user?.photoURL}
          coverUrl={_userAbout.coverUrl}
        />
        </Card>

        <Grid container spacing={3}>
          <Grid xs={12} md={4}>
            <Stack spacing={3}>
              <MatchSummaryWidget />
            </Stack>
          </Grid>

          <Grid xs={12} md={8}>
            <Stack spacing={3}>
                <ProfileHome />
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
