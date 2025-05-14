// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
import {useTheme} from "@mui/material/styles";
import { useFirestoreDocData, useFirestore } from 'reactfire';
import { doc, WithFieldValue } from 'firebase/firestore';
import { useAuthContext } from "src/auth/hooks";
import { COLLECTIONS, Matches, UserInfo } from '@livve-1/database-types';
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import { Chart, useChart } from "../../components/chart";
import { Block } from "../../components/settings/drawer/styles";

// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
}

const matchesConverter = {
  toFirestore: (matches: WithFieldValue<Matches>) => matches,
  fromFirestore: (snap: any) => snap.data() as Matches,
};

const userInfoConverter = {
  toFirestore: (userInfo: WithFieldValue<UserInfo>) => userInfo,
  fromFirestore: (snap: any) => snap.data() as UserInfo,
};

export function UserStatistics({isOpen, onClose}: Props) {
  const theme = useTheme();
  const firestore = useFirestore();
  const { user } = useAuthContext();

  // Return null if user or uid is not available
  if (!user?.uid) {
    return null;
  }

  const matchesRef = doc(firestore, COLLECTIONS.MARRIAGE.MATCHES, user.uid).withConverter(matchesConverter);
  const userInfoRef = doc(firestore, COLLECTIONS.USERS.USER_INFO, user.uid).withConverter(userInfoConverter);

  const { data: matches } = useFirestoreDocData<Matches>(matchesRef);
  const { data: userInfo } = useFirestoreDocData<UserInfo>(userInfoRef);

  const baseChartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    stroke: { width: 0 },
    fill: {
      type: 'gradient',
      gradient: {
        colorStops: [
          { offset: 0, color: theme.palette.primary.light, opacity: 1 },
          { offset: 100, color: theme.palette.primary.main, opacity: 1 },
        ],
      },
    },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: 6,
            color: theme.palette.primary.main,
            fontSize: theme.typography.subtitle2.fontSize as string,
          },
        },
      },
    },
  });

  const totalMatches = matches?.matches.length ?? 0;
  // const averageScore = totalMatches > 0 
  //   ? matches?.matches.reduce((acc, match) => acc + match.ai_score, 0) / totalMatches 
  //   : 0;

  const profileStrengthChartOptions = {
    ...(baseChartOptions ?? {}),
    plotOptions: {
      ...(baseChartOptions?.plotOptions ?? {}),
      radialBar: {
        ...(baseChartOptions?.plotOptions?.radialBar ?? {}),
        dataLabels: {
          ...(baseChartOptions?.plotOptions?.radialBar?.dataLabels ?? {}),
          value: {
            ...(baseChartOptions?.plotOptions?.radialBar?.dataLabels?.value ?? {}),
            offsetY: 6,
            color: theme.palette.primary.main,
            fontSize: theme.typography.subtitle2.fontSize as string,
            formatter: (val: number) => `${Math.round(val)}%`,
          },
        },
      },
    },
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Stack spacing={6} flexGrow={1} sx={{p: 1, mt: 2}}>
                <Block title="Your Statistics">
                  <Box
                    gap={3}
                    display="grid"
                    gridTemplateColumns={{xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'}}
                  >
                    <Card sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Top Match Score</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Chart
                          type="radialBar"
                          series={[(matches?.topMatchPercentage ?? 0) * 100]}
                          options={baseChartOptions}
                          width={80}
                          height={80}
                        />
                      </Box>
                    </Card>

                    <Card sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Total Matches</Typography>
                      <Typography variant="h4">{totalMatches}</Typography>
                    </Card>

                    {/* <Card sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Average Match Score</Typography>
                      <Typography variant="h4">{Math.round(averageScore * 100)}%</Typography>
                    </Card> */}
                  </Box>
                </Block>

                <Block title="Profile Strength">
                  <Card sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Profile Completeness</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Chart
                        type="radialBar"
                        series={[(matches?.currentUserCoreProfileCompletenessFactor ?? 0) * 100]}
                        options={profileStrengthChartOptions}
                        width={80}
                        height={80}
                      />
                    </Box>
                  </Card>
                </Block>
              </Stack>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
} 