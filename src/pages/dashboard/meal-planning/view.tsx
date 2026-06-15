import { Helmet } from 'react-helmet-async';

import { MealPlanningView } from 'src/sections/meal-planning/view';

// ----------------------------------------------------------------------

export default function StandardMealPlanningPage() {
  return (
    <>
      <Helmet>
        <title>Standard Meal Planning | Liive AI</title>
      </Helmet>

      <MealPlanningView />
    </>
  );
} 