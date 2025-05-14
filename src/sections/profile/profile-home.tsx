import {useRef} from 'react';

import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import { UserInfo, QuestionsAnswers } from '@livve-1/database-types';

import {QAVerticalStepper} from "./qa-vertical-stepper";

// ----------------------------------------------------------------------

export interface QuestionAnswer {
  question: string,
  answer: string,
  createdAt: number
}

// Define Props interface
interface ProfileHomeProps {
  userInfo: UserInfo | null;
  qasData: QuestionsAnswers | null;
  isLoading: boolean;
}

export function ProfileHome({ userInfo, qasData, isLoading }: ProfileHomeProps) {

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAttach = () => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  };

  const renderAbout = (
    <>
      {/* <CardHeader title="About" />

      <Stack spacing={2} sx={{ p: 3 }}>
        <Box sx={{ typography: 'body2' }}>{info.quote}</Box>

        <Stack direction="row" spacing={2}>
          <Iconify icon="mingcute:location-fill" width={24} />

          <Box sx={{ typography: 'body2' }}>
            {`Live at `}
            <Link variant="subtitle2" color="inherit">
              {info.country}
            </Link>
          </Box>
        </Stack>

        <Stack direction="row" sx={{ typography: 'body2' }}>
          <Iconify icon="fluent:mail-24-filled" width={24} sx={{ mr: 2 }} />
          {info.email}
        </Stack>

        <Stack direction="row" spacing={2}>
          <Iconify icon="ic:round-business-center" width={24} />

          <Box sx={{ typography: 'body2' }}>
            {info.role} {`at `}
            <Link variant="subtitle2" color="inherit">
              {info.company}
            </Link>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2}>
          <Iconify icon="ic:round-business-center" width={24} />

          <Box sx={{ typography: 'body2' }}>
            {`Studied at `}
            <Link variant="subtitle2" color="inherit">
              {info.school}
            </Link>
          </Box>
        </Stack>


      </Stack> */}
      <QAVerticalStepper 
        qasData={qasData} 
        isLoading={isLoading} 
        userId={userInfo?.id} 
      />
    </>
  );

  return (
        <Stack spacing={0} sx={{ mx: { xs: -2, md: 0 } }}>

          {renderAbout}

        </Stack>
  );
}
