import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthContext } from 'src/auth/hooks';
import { 
  MealPlan, 
  MealPlanRequest, 
  Meal 
} from '@livve-1/database-types';

// Types
interface MealStep {
  text: string;
  videoTimestamp: string;
}

interface DayPlan {
  day: string;
  meals: Meal[];
}

export function useMealPlanning() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [currentMealPlan, setCurrentMealPlan] = useState<MealPlan | null>(null);

  const functions = getFunctions();

  // Generate a meal plan
  const generateMealPlan = useCallback(async (request: MealPlanRequest) => {
    if (!user) {
      setError('You must be logged in to generate a meal plan');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const generateMealPlanFn = httpsCallable<MealPlanRequest & { userId: string }, MealPlan>(
        functions,
        'generateMealPlan'
      );

      const result = await generateMealPlanFn({
        ...request,
        userId: user.id,
      });

      const mealPlan = result.data;
      setCurrentMealPlan(mealPlan);
      return mealPlan;
    } catch (err) {
      console.error('Error generating meal plan:', err);
      setError('Failed to generate meal plan. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [functions, user]);

  // Get user's meal plans
  const getUserMealPlans = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view your meal plans');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const getUserMealPlansFn = httpsCallable<void, { mealPlans: MealPlan[] }>(
        functions,
        'getUserMealPlans'
      );

      const result = await getUserMealPlansFn();
      const userMealPlans = result.data.mealPlans;
      setMealPlans(userMealPlans);
      return userMealPlans;
    } catch (err) {
      console.error('Error getting meal plans:', err);
      setError('Failed to get meal plans. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [functions, user]);

  // Update a meal in a meal plan
  const updateMeal = useCallback(async (mealPlanId: string, dayIndex: number, mealIndex: number, newMeal: Meal) => {
    if (!user) {
      setError('You must be logged in to update a meal');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const updateMealFn = httpsCallable<
        { mealPlanId: string; dayIndex: number; mealIndex: number; newMeal: Meal },
        { success: boolean }
      >(functions, 'updateMeal');

      const result = await updateMealFn({
        mealPlanId,
        dayIndex,
        mealIndex,
        newMeal,
      });

      // Update local state if successful
      if (result.data.success && currentMealPlan && currentMealPlan.id === mealPlanId) {
        const updatedMealPlan = { ...currentMealPlan };
        updatedMealPlan.weekDays[dayIndex].meals[mealIndex] = newMeal;
        setCurrentMealPlan(updatedMealPlan);
      }

      return result.data.success;
    } catch (err) {
      console.error('Error updating meal:', err);
      setError('Failed to update meal. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [functions, user, currentMealPlan]);

  // Share a meal plan with another user
  const shareMealPlan = useCallback(async (mealPlanId: string, recipientEmail: string) => {
    if (!user) {
      setError('You must be logged in to share a meal plan');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const shareMealPlanFn = httpsCallable<
        { mealPlanId: string; recipientEmail: string },
        { success: boolean }
      >(functions, 'shareMealPlan');

      const result = await shareMealPlanFn({
        mealPlanId,
        recipientEmail,
      });

      return result.data.success;
    } catch (err) {
      console.error('Error sharing meal plan:', err);
      setError('Failed to share meal plan. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [functions, user]);

  return {
    loading,
    error,
    mealPlans,
    currentMealPlan,
    generateMealPlan,
    getUserMealPlans,
    updateMeal,
    shareMealPlan,
    setCurrentMealPlan,
  };
} 