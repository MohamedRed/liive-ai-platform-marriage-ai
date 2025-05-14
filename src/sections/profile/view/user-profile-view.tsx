import {useState, useCallback} from 'react';
import { motion } from 'framer-motion';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import {useTabs} from 'src/hooks/use-tabs';

import {_userAbout} from 'src/_mock';

import {Iconify} from 'src/components/iconify';

import {useMockedUser} from 'src/auth/hooks';

import {ProfileHome} from '../profile-home';
import {ProfileCover} from '../profile-cover';
import {useProfile} from "../hooks/use-profile";
import { MatchSummaryWidget } from 'src/sections/assistant/match-summary-widget';

// ----------------------------------------------------------------------

const TABS = [
  {value: 'profile', label: 'Profile', icon: <Iconify icon="solar:user-id-bold" width={24}/>},
];

// ----------------------------------------------------------------------

export function UserProfileView() {
  const {user} = useMockedUser();
  const tabs = useTabs('profile');
  const { userInfo, qas, profileLoading, profileError, profileEmpty } = useProfile();

  return (
    <Box sx={{ pl: 2, pr: 2, pb: 2 }}>
      <Card sx={{ mb: 3, height: 290 }}>
        <ProfileCover
          role={'User Role'}
          name={userInfo?.name ? `${userInfo.name.firstName} ${userInfo.name.lastName}` : user?.displayName}
          avatarUrl={user?.photoURL}
          coverUrl={_userAbout.coverUrl}
        />

        <Box
          display="flex"
          justifyContent={{xs: 'center', md: 'flex-end'}}
          sx={{
            width: 1,
            bottom: 0,
            zIndex: 9,
            px: {md: 3},
            position: 'absolute',
            bgcolor: 'background.paper',
          }}
        >
          <Tabs value={tabs.value} onChange={tabs.onChange}>
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} icon={tab.icon} label={tab.label}/>
            ))}
          </Tabs>
        </Box>
      </Card>

      <Box sx={{ mb: 3 }}>
        <MatchSummaryWidget />
      </Box>
      <Box sx={{ mb: 3 }}>
        {tabs.value === 'profile' && 
          <ProfileHome 
            userInfo={userInfo} 
            qasData={qas} 
            isLoading={profileLoading} 
          />
        }
      </Box>
    </Box>
  );
}
