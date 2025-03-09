import { m, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { onSnapshot } from 'firebase/firestore';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useSettingsContext } from 'src/components/settings';
import { useCarousel, Carousel } from 'src/components/carousel';
import { CarouselDotButtons } from 'src/components/carousel';
import { _mock } from 'src/_mock';
import { useAuthContext } from 'src/auth/hooks';
import { doc } from 'firebase/firestore';
import { useFirestore } from 'reactfire';

const slides = [
  {
    id: '1',
    title: 'Islamic Marriage Made Simple',
    description: 'Find your almost perfect marriage partner following strict Islamic principles.',
    coverUrl: _mock.image.cover(1),
  },
  {
    id: '2',
    title: 'Intelligent Matching Process',
    description: 'Simply answer questions from our AI assistant about your preferences and values.',
    coverUrl: _mock.image.cover(2),
  },
  {
    id: '3',
    title: 'Safety First',
    description: "Your security is our priority. We verify all users' identities.",
    coverUrl: _mock.image.cover(3),
  },
];

// Lazy load the VerificationIdentity component
const VerificationIdentity = lazy(() => 
  import('src/sections/assistant/verification-identity').then(module => ({
    default: module.VerificationIdentity
  }))
);

export function OnboardingView() {
  const settings = useSettingsContext();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const firestore = useFirestore();
  
  const carousel = useCarousel({
    slidesToShow: 1,
    align: 'start',
    skipSnaps: false,
    dragFree: false,
  });

  const [openVerification, setOpenVerification] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  const handleOpenVerification = useCallback(() => {
    setShowVerification(true);
    setOpenVerification(true);
  }, []);

  const handleCloseVerification = useCallback(() => {
    setOpenVerification(false);
    setShowVerification(false);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = onSnapshot(
      doc(firestore, 'PROFILES', user.id),
      async (doc) => {
        const profile = doc.data();
        if (profile?.identityVerification && profile?.identityVerification?.status !== 'verified') {
          carousel.mainApi?.scrollTo(slides.length - 1);
          await new Promise(resolve => setTimeout(resolve, 1250));
          setShowButton(true);
          await new Promise(resolve => setTimeout(resolve, 1250));  
          setShowVerification(true);
          setOpenVerification(true);
        }
      }
    );

    return () => unsubscribe();
  }, [carousel, firestore, user?.id]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (carousel.dots.selectedIndex === slides.length - 1) {
      timer = setTimeout(() => {
        setShowButton(true);
      }, 2000); // 2 seconds delay
    } else {
      setShowButton(false);
    }

    return () => clearTimeout(timer);
  }, [carousel.dots.selectedIndex]);

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden' }}>
      <Carousel carousel={carousel}>
        {slides.map((slide) => (
          <Box
            key={slide.id}
            sx={{
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 3,
              pt: { xs: 12, md: 15 },
              bgcolor: 'background.paper',
            }}
          >
            <Box 
              component="img" 
              src={slide.coverUrl} 
              sx={{ 
                height: '28vh',
                width: 'auto',
                borderRadius: 4,
                boxShadow: (theme) => theme.customShadows.z24,
              }} 
            />

            <Stack 
              spacing={3} 
              sx={{ 
                maxWidth: 480, 
                textAlign: 'center',
                mt: 4,
              }}
            >
              <Typography variant="h3">{slide.title}</Typography>
              <Typography sx={{ color: 'text.secondary' }}>{slide.description}</Typography>
            </Stack>
          </Box>
        ))}
      </Carousel>

      <Box sx={{ position: 'fixed', bottom: 40, width: '100%', zIndex: 9 }}>
        <AnimatePresence mode="wait">
          {showButton && carousel.dots.selectedIndex === slides.length - 1 && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{ textAlign: 'center' }}
            >
              <Button
                size="large"
                variant="contained"
                onClick={handleOpenVerification}
                sx={{ mb: 5 }}
              >
                Get Started
              </Button>
            </m.div>
          )}
        </AnimatePresence>

        <CarouselDotButtons
          variant="number"
          scrollSnaps={carousel.dots.scrollSnaps}
          selectedIndex={carousel.dots.selectedIndex}
          onClickDot={carousel.dots.onClickDot}
          sx={{ width: 1, justifyContent: 'center' }}
        />
      </Box>

      {showVerification && (
        <Suspense fallback={null}>
          <VerificationIdentity 
            isOpen={openVerification} 
            onClose={handleCloseVerification}
          />
        </Suspense>
      )}
    </Box>
  );
} 