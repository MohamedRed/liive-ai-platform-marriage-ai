import { Helmet } from 'react-helmet-async';

import { MealPlanningCustomView } from 'src/sections/meal-planning/view/meal-planning-custom-view';

// ----------------------------------------------------------------------

export default function MealPlanningPage() {
  return (
    <>
      <Helmet>
        <title>Meal Planning | Liive AI</title>
      </Helmet>

      <MealPlanningCustomView />
    </>
  );
} 