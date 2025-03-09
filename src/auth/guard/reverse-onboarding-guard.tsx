import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../hooks';
import { useFirestore, useFirestoreDocData } from 'reactfire';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from 'src/components/loading-screen';

type ReverseOnboardingGuardProps = {
  children: React.ReactNode;
};

export function ReverseOnboardingGuard({ children }: ReverseOnboardingGuardProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const firestore = useFirestore();
  
  const profileRef = doc(firestore, 'PROFILES', user?.id);
  const { status, data: profile } = useFirestoreDocData(profileRef, {
    idField: 'id',
  });

  useEffect(() => {
    if (status === 'loading' || !profile) return;

    if (profile?.identityVerification?.status === 'verified') {
      navigate('/dashboard/assistant');
    }
  }, [navigate, profile, status]);

  if (profile?.identityVerification?.status === 'verified') {
    return null;
  }

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <>{children}</>;
} 