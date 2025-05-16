import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Container, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

import { MealPlanHistory } from 'src/sections/meal-planning/history/meal-plan-history';
import { MealPlanWeeklyView } from 'src/sections/meal-planning/components/meal-plan-weekly-view';

// ----------------------------------------------------------------------

const StyledRoot = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(5),
  },
}));

// ----------------------------------------------------------------------

export default function MealPlanningHistoryPage() {
  const [selectedMealPlan, setSelectedMealPlan] = useState(null);

  const handleViewMealPlan = (mealPlan) => {
    setSelectedMealPlan(mealPlan);
  };

  const handleBackToHistory = () => {
    setSelectedMealPlan(null);
  };

  return (
    <>
      <Helmet>
        <title>Meal Planning History | Liive AI</title>
      </Helmet>

      <Container maxWidth={false}>
        <StyledRoot>
          {selectedMealPlan ? (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Box
                  onClick={handleBackToHistory}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: 'primary.main',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  ← Back to History
                </Box>
              </Box>
              <MealPlanWeeklyView mealPlan={selectedMealPlan} />
            </Box>
          ) : (
            <MealPlanHistory onViewMealPlan={handleViewMealPlan} />
          )}
        </StyledRoot>
      </Container>
    </>
  );
} 