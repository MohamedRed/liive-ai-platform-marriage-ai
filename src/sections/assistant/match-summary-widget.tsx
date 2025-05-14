import { Box, Grid } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useFirestore } from 'reactfire';
import { doc, getDoc, WithFieldValue, DocumentData, Timestamp } from 'firebase/firestore';
import { useAuthContext } from 'src/auth/hooks';
import { COLLECTIONS, Matches, QuestionsAnswers } from '@livve-1/database-types';
import { MatchProgressWidget } from './match-progress-widget';
import { useState, useEffect } from 'react';
import { EcommerceWidgetSummary } from "src/sections/overview/e-commerce/ecommerce-widget-summary";

interface Props {
}

// Define a fallback profile if data can't be loaded
const DEFAULT_MATCHES_DATA: Partial<Matches> = {
  matches: [],
  topMatchPercentage: 0, // Default percentage
  // currentUserAnsweredCoreQuestionsCount: 0, // Removed - Fetched from QAS now
};

const DEFAULT_QAS_DATA: Partial<QuestionsAnswers> = {
  questions: {}
};

const matchesConverter = {
  toFirestore: (matches: WithFieldValue<Matches>) => matches,
  fromFirestore: (snap: any): Matches => snap.data() as Matches, // Ensure type is Matches
};

const qasConverter = {
  toFirestore: (qas: WithFieldValue<QuestionsAnswers>) => qas,
  fromFirestore: (snap: any): QuestionsAnswers => snap.data() as QuestionsAnswers,
};

const DEFAULT_CHART_DATA = {
  categories: ['-'], 
  series: [0] 
};

export function MatchSummaryWidget({}: Props) {
  const { user } = useAuthContext();
  const theme = useTheme();
  const firestore = useFirestore();
  
  const [matchesData, setMatchesData] = useState<Partial<Matches>>(DEFAULT_MATCHES_DATA);
  const [qasData, setQasData] = useState<Partial<QuestionsAnswers>>(DEFAULT_QAS_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const userId = user?.id || '';
  
  useEffect(() => {
    setIsLoading(true);
    if (!userId) {
      setIsLoading(false);
      setMatchesData(DEFAULT_MATCHES_DATA);
      setQasData(DEFAULT_QAS_DATA);
      return;
    }
    
    const fetchWidgetData = async () => {
      try {
        // Fetch Matches Data
        const matchesRef = doc(firestore, COLLECTIONS.MARRIAGE.MATCHES, userId).withConverter(matchesConverter);
        const matchesSnap = await getDoc(matchesRef);
        setMatchesData(matchesSnap.exists() ? matchesSnap.data() : DEFAULT_MATCHES_DATA);

        // Fetch QAS Data
        const qasRef = doc(firestore, COLLECTIONS.MARRIAGE.QUESTIONS_ANSWERS, userId).withConverter(qasConverter);
        const qasSnap = await getDoc(qasRef);
        setQasData(qasSnap.exists() ? qasSnap.data() : DEFAULT_QAS_DATA);

      } catch (error) {
        console.error('Error fetching widget data:', error);
        setMatchesData(DEFAULT_MATCHES_DATA);
        setQasData(DEFAULT_QAS_DATA);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWidgetData();
  }, [userId, firestore]);
  
  // Use the adjusted percentage directly from the fetched data
  const matchPercentage = (matchesData as Matches)?.topMatchPercentage ?? 0;

  // Calculate total answered questions count from QAS data
  const totalAnsweredCount = qasData?.questions ? Object.keys(qasData.questions).length : 0;

  if (isLoading) {
    return (
      <Grid container spacing={3} sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
         <Grid item xs={6} md={6}>
            <EcommerceWidgetSummary title="Match Score" total={0} percent={0} chart={DEFAULT_CHART_DATA} />
         </Grid>
         <Grid item xs={6} md={6}>
             <EcommerceWidgetSummary title="Questions Answered" total={0} percent={0} chart={DEFAULT_CHART_DATA} />
         </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={3} sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
       <Grid item xs={6} md={6}>
         <EcommerceWidgetSummary 
           title="Questions Answered"
           total={totalAnsweredCount}
           percent={0}
           chart={DEFAULT_CHART_DATA}
         />
       </Grid>
       <Grid item xs={6} md={6}>
         <EcommerceWidgetSummary 
           title="Top Match Score (%)"
           total={matchPercentage}
        percent={matchPercentage}
        chart={{
             categories: ['Match'],
             series: [matchPercentage]
        }}
      />
       </Grid>
    </Grid>
  );
} 