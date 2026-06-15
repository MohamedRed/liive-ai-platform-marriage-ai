import { useState, useCallback, useEffect } from 'react';
import { Container, Typography, Box, Card, Button, TextField, Grid, Stack, Divider, IconButton, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Iconify } from 'src/components/iconify';
import { fDateTime } from 'src/utils/format-time';
import { MealPlanInput } from '../components/meal-plan-input';
import { MealPlanWeeklyView } from '../components/meal-plan-weekly-view';
import { VoiceAssistant } from '../components/voice-assistant';
import { useMealPlanning } from '../hooks';
import { Link } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import { MealPlan } from '@livve-1/database-types';

// ----------------------------------------------------------------------

// Types
interface MealStep {
  text: string;
  videoTimestamp: string;
}

interface Meal {
  type: string;
  name: string;
  videoUrl: string;
  thumbnail: string;
  cookingTime: string;
  costPerServing: string;
  ingredients: string[];
  utensils: string[];
  nutritionInfo: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
  healthBenefits: string[];
  steps: MealStep[];
}

interface DayPlan {
  day: string;
  meals: Meal[];
}

interface MealPlan {
  id: string;
  createdAt: string;
  preferences: string;
  weekDays: DayPlan[];
  userId: string;
}

const StyledRoot = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(5),
  },
}));

// ----------------------------------------------------------------------

export default function MealPlanningView() {
  const theme = useTheme();
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  
  const {
    loading,
    error,
    currentMealPlan,
    generateMealPlan,
    setCurrentMealPlan
  } = useMealPlanning();

  const handleGenerateMealPlan = useCallback(async (input: { description: string; imageUrl?: string; videoUrl?: string; imageFiles?: File[] }) => {
    try {
      // Use the real cloud function instead of mock data
      await generateMealPlan(input);
      
      // The mock data block below can be removed or commented out
      /*
      setTimeout(() => {
        const mockMealPlan: MealPlan = {
          id: '123456',
          createdAt: new Date().toISOString(),
          preferences: input.description,
          userId: 'user123',
          weekDays: [
            // ... mock data ...
          ]
        };
        setCurrentMealPlan(mockMealPlan);
      }, 1500);
      */
    } catch (error) {
      console.error('Error generating meal plan:', error);
      // Error handling is already done in the hook
    }
  }, [generateMealPlan]);

  const toggleVoiceAssistant = useCallback(() => {
    setVoiceAssistantOpen((prev) => !prev);
  }, []);

  return (
    <Container maxWidth={false}>
      <StyledRoot>
        <Box sx={{ mb: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Weekly Meal Planning
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create a healthy, efficient meal plan based on your preferences.
            </Typography>
          </Box>
          
          <Button
            component={Link}
            to={`${paths.dashboard.mealPlanning}/history`}
            startIcon={<Iconify icon="mdi:history" />}
          >
            View History
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!currentMealPlan ? (
          <MealPlanInput onSubmit={handleGenerateMealPlan} loading={loading} />
        ) : (
          <>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5">
                Your Weekly Meal Plan
              </Typography>
              <Box>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  startIcon={<Iconify icon="mdi:refresh" />}
                  onClick={() => setCurrentMealPlan(null)}
                  sx={{ mr: 1 }}
                >
                  New Plan
                </Button>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<Iconify icon="mdi:content-save" />}
                >
                  Save Plan
                </Button>
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Created on: {fDateTime(currentMealPlan.createdAt)}
            </Typography>
            
            <Typography 
              variant="subtitle1" 
              sx={{ 
                mb: 3, 
                p: 2, 
                bgcolor: 'background.neutral', 
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}` 
              }}
            >
              <strong>Preferences:</strong> {currentMealPlan.preferences}
            </Typography>

            <MealPlanWeeklyView mealPlan={currentMealPlan} />

            <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={toggleVoiceAssistant}
                startIcon={<Iconify icon={voiceAssistantOpen ? "mdi:microphone-off" : "mdi:microphone"} />}
                sx={{ borderRadius: '50%', width: 64, height: 64, minWidth: 'auto' }}
              >
                {voiceAssistantOpen ? null : null}
              </Button>
            </Box>

            {voiceAssistantOpen && (
              <VoiceAssistant open={voiceAssistantOpen} onClose={toggleVoiceAssistant} />
            )}
          </>
        )}
      </StyledRoot>
    </Container>
  );
} 