import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useFirestore, useFirestoreDocData } from 'reactfire';
import { doc, getDoc, WithFieldValue, DocumentData, Timestamp } from 'firebase/firestore';
import { useAuthContext } from 'src/auth/hooks';
import { COLLECTIONS, Matches } from '@liive-marriage-ai/database-types';
import { MatchProgressWidget } from './match-progress-widget';
import { useState, useEffect } from 'react';

interface Props {
}

// Define a fallback profile if data can't be loaded
const DEFAULT_PROFILE: Partial<Matches> = {
  matches: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};

const profileConverter = {
  toFirestore: (profile: WithFieldValue<Matches>) => profile,
  fromFirestore: (snap: any) => snap.data() as Matches,
};

export function MatchSummaryWidget({}: Props) {
  const { user } = useAuthContext();
  const theme = useTheme();
  const firestore = useFirestore();
  
  // State for tracking loading status and profile data
  const [profile, setProfile] = useState<Partial<Matches>>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const userId = user?.id || '';
  
  // Fetch data when component mounts and userId changes
  useEffect(() => {
    // Reset loading state
    setIsLoading(true);
    
    // Only attempt to fetch data if we have a valid user ID
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    const fetchProfileData = async () => {
      try {
        const profileRef = doc(firestore, COLLECTIONS.MATCHES, userId).withConverter(profileConverter);
        const profileData = await getDoc(profileRef);
        
        if (profileData.exists()) {
          setProfile(profileData.data());
        } else {
          // No profile found for this user
          setProfile(DEFAULT_PROFILE);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfile(DEFAULT_PROFILE);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfileData();
  }, [userId, firestore]);
  
  // Use a safe accessor pattern to avoid undefined errors
  const bestMatch = profile?.matches?.reduce((best: any, current: any) => {
    if (!best || (current && current.ai_score > best.ai_score)) {
      return current;
    }
    return best;
  }, null);

  // Provide fallback values to avoid rendering errors
  const matchPercentage = bestMatch ? Math.round((bestMatch.ai_score || 0) * 100) : 50;

  // If we don't have a valid user ID or profile, show a default state
  if (!userId || isLoading) {
    return (
      <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
        <MatchProgressWidget
          title="Loading Match Data..."
          percent={0}
          total={100}
          chart={{
            categories: ['--', '--', '--', '--', '--', '--', '--', '--'],
            series: [0, 0, 0, 0, 0, 0, 0, 0],
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <MatchProgressWidget
        title="Match Found"
        percent={matchPercentage}
        total={matchPercentage}
        chart={{
          categories: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
          series: [22, 8, 35, 50, 82, 84, 77, 50],
        }}
      />
    </Box>
  );
} 