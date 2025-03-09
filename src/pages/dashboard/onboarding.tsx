import { Helmet } from 'react-helmet-async';
import { OnboardingView } from '../../sections/onboarding/view';

export default function OnboardingPage() {
  return (
    <>
      <Helmet>
        <title>Onboarding | Marriage AI</title>
      </Helmet>

      <OnboardingView />
    </>
  );
} 