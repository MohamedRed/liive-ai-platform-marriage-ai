import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../hooks';
import { useFirestore, useFirestoreDocData } from 'reactfire';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from 'src/components/loading-screen';

type OnboardingGuardProps = {
  children: React.ReactNode;
};

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const firestore = useFirestore();
  
  const profileRef = doc(firestore, 'PROFILES', user?.id);
  const { status, data: profile } = useFirestoreDocData(profileRef, {
    idField: 'id',
  });

  useEffect(() => {
    if (!user?.id || status === 'loading') {
      return;
    }

    const isVerified = profile?.identityVerification?.status === 'verified';
    const currentPath = window.location.pathname;

    if (isVerified) {
      if (currentPath === '/dashboard/onboarding') {
        navigate('/dashboard/assistant');
      }
    } else {
      if (currentPath !== '/dashboard/onboarding') {
        navigate('/dashboard/onboarding');
      }
    }
  }, [navigate, profile, status, user]);

  // Only render children if onboarding is complete ie identity is verified
  if (!profile?.identityVerification?.status || 
      profile.identityVerification.status !== 'verified') {
    return null;
  }

  return <>{children}</>;
} 