// eslint-disable-next-line import/no-extraneous-dependencies
import {shuffle} from "lodash";
import {m} from "framer-motion";
// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
// eslint-disable-next-line import/no-extraneous-dependencies
import {useState, useEffect} from "react";
import { useFirestoreDocData, useFirestore } from 'reactfire';
import { query, where, limit, orderBy, doc, collection, WithFieldValue } from 'firebase/firestore';
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useTheme} from "@mui/material/styles";
import ListItemText from "@mui/material/ListItemText";

import {CONFIG} from "../../config-global";
import {Iconify} from "../../components/iconify";
import {SvgColor} from "../../components/svg-color";
import {Chart, useChart} from "../../components/chart";
import {Block} from "../../components/settings/drawer/styles";
import {SheetTweenConfig} from "react-modal-sheet/src/types";
import { useAuthContext } from "src/auth/hooks";
import { COLLECTIONS, Matches } from '@livve-1/database-types';

// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean
  onClose: () => void;
}

const spring = {
  type: "spring",
  damping: 100,
  stiffness: 150
};

const matchesConverter = {
  toFirestore: (matches: WithFieldValue<Matches>) => matches,
  fromFirestore: (snap: any) => snap.data() as Matches,
};

export function MatchMaking({isOpen, onClose}: Props) {
  const theme = useTheme();

  const [randomArray, setRandomArray] = useState([...Array(5)].map((_, index) => index));

  const firestore = useFirestore();
  const {user} = useAuthContext()

  // Return null if user or uid is not available
  if (!user?.uid) {
    return null;
  }

  const matchesRef = doc(firestore, COLLECTIONS.MARRIAGE.MATCHES, user.uid).withConverter(matchesConverter)

  const { status, data: matches } = useFirestoreDocData<Matches>(matchesRef, {
    idField: "id"
  });
  
  // Use topMatchPercentage from the root of the Matches document
  const topMatchPercentageToShow = matches?.topMatchPercentage ?? 0;

  useEffect(() => {
    setTimeout(() => {
      setRandomArray(shuffle(randomArray));
    }, 3000);
  }, [randomArray]);

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Stack spacing={6} flexGrow={1} sx={{p: 1, mt: 2}}>
                <Block title="Best match yet" sx={{p: 2, backgroundColor: theme.palette.primary.main}}>
                  <ProspectItem isBestMatch bestMatchScore={topMatchPercentageToShow}/>
                </Block>
                <Block title="We are searching for a 99% match">
                  <Box
                    gap={3}
                    display="grid"
                    gridTemplateColumns={{xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'}}
                  >
                    {randomArray.map((value, index) => (
                      <m.div key={value} layout transition={spring}>
                        <ProspectItem isBestMatch={false}/>
                      </m.div>
                    ))}
                  </Box>
                </Block>
              </Stack>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

// ----------------------------------------------------------------------

type ProspectItemProps = {
  isBestMatch: boolean;
  bestMatchScore?: number;
};

function ProspectItem({isBestMatch, bestMatchScore = 0}: ProspectItemProps) {
  const theme = useTheme();

  const chartColors = [theme.palette.primary.light, theme.palette.primary.main];

  const chartOptions = useChart({
    chart: {sparkline: {enabled: true}},
    stroke: {width: 0},
    fill: {
      type: 'gradient',
      gradient: {
        colorStops: [
          {offset: 0, color: chartColors[0], opacity: 1},
          {offset: 100, color: chartColors[1], opacity: 1},
        ],
      },
    },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: {show: false},
          value: {
            offsetY: 6,
            color: theme.palette.primary.main,
            fontSize: theme.typography.subtitle2.fontSize as string,
          },
        },
      },
    },
  });

  return (
    <Card sx={{display: 'flex', alignItems: 'center', p: (theme) => theme.spacing(3, 2, 3, 3)}}>
      <Skeleton variant="circular" sx={{width: 48, height: 48, mr: 2}}/>

      <ListItemText
        primary={<Skeleton sx={{width: 150, height: 12}}/>}
        secondary={
          <>
            <Iconify icon="mingcute:location-fill" width={16} sx={{flexShrink: 0, mr: 0.5}}/>
            <Skeleton sx={{width: 100, height: 12}}/>
          </>
        }
        primaryTypographyProps={{noWrap: true, typography: 'subtitle2'}}
        secondaryTypographyProps={{
          mt: 0.5,
          noWrap: true,
          display: 'flex',
          component: 'span',
          alignItems: 'center',
          typography: 'caption',
          color: 'text.disabled',
        }}
      />

      {isBestMatch
        ? <Box
          sx={{
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Chart
            type="radialBar"
            series={[bestMatchScore]}
            options={chartOptions}
            width={80}
            height={80}
            sx={{zIndex: 1}}
          />

          <SvgColor
            src={`${CONFIG.site.basePath}/assets/background/shape-circle-3.svg`}
            sx={{
              width: 200,
              height: 200,
              opacity: 0.08,
              position: 'absolute',
              color: 'primary.light',
            }}
          />
        </Box>
        : <Skeleton variant="circular" sx={{width: 60, height: 60, ml: 1.5}}/>
      }
    </Card>
  );
}
