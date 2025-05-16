import { Timestamping } from './index';
import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';
/**
 * Interface for a step in a cooking recipe with video timestamp
 */
export interface MealStep {
    /** Descriptive text for the step */
    text: string;
    /** Video timestamp in format MM:SS */
    videoTimestamp: string;
}
/**
 * Interface for nutritional information of a meal
 */
export interface NutritionInfo {
    /** Total calories per serving */
    calories: number;
    /** Protein content with unit (e.g., "15g") */
    protein: string;
    /** Protein as percentage of daily value */
    proteinDailyValue?: string;
    /** Carbohydrates content with unit (e.g., "25g") */
    carbs: string;
    /** Carbohydrates as percentage of daily value */
    carbsDailyValue?: string;
    /** Fat content with unit (e.g., "10g") */
    fat: string;
    /** Fat as percentage of daily value */
    fatDailyValue?: string;
    /** Fiber content with unit */
    fiber?: string;
    /** Fiber as percentage of daily value */
    fiberDailyValue?: string;
    /** Sugar content with unit */
    sugar?: string;
    /** Cholesterol content with unit */
    cholesterol?: string;
    /** Sodium content with unit */
    sodium?: string;
    /** Potassium content with unit */
    potassium?: string;
    /** Micronutrients with quantities and daily values */
    micronutrients?: {
        name: string;
        amount: string;
        dailyValue?: string;
    }[];
}
/**
 * Interface for a meal with all necessary details
 */
export interface Meal {
    /** Type of meal (e.g., "Breakfast", "Lunch", "Dinner") */
    type: string;
    /** Name/title of the meal */
    name: string;
    /** YouTube video URL for the recipe */
    videoUrl: string;
    /** Thumbnail image URL */
    thumbnail: string;
    /** Time required to cook (e.g., "30 minutes") */
    cookingTime: string;
    /** Estimated cost per serving (e.g., "$3.50") */
    costPerServing: string;
    /** List of required ingredients */
    ingredients: string[];
    /** List of required cooking utensils */
    utensils: string[];
    /** Nutritional information */
    nutritionInfo: NutritionInfo;
    /** List of health benefits */
    healthBenefits: string[];
    /** Step-by-step cooking instructions with video timestamps */
    steps: MealStep[];
    /** Number of servings this recipe makes */
    servings: number;
}
/**
 * Interface for a day's meal plan
 */
export interface DayPlan {
    /** Day of the week (e.g., "Monday") */
    day: string;
    /** List of meals for the day */
    meals: Meal[];
}
/**
 * Interface for a meal plan request from the user
 */
export interface MealPlanRequest {
    /** User's description of preferences */
    description: string;
    /** Optional image URL for reference */
    imageUrl?: string;
    /** Optional video URL for reference */
    videoUrl?: string;
    /** User ID */
    userId: string;
    /** User's country for pricing estimates (e.g., "United States") */
    userCountry?: string;
}
/**
 * Interface for a complete meal plan
 */
export interface MealPlan extends Timestamping {
    /** Unique identifier */
    id: string;
    /** When the meal plan was created (overriding the Timestamping.createdAt with correct type) */
    createdAt: FirestoreTimestamp;
    /** User's preferences description */
    preferences: string;
    /** Meal plans for each day of the week */
    weekDays: DayPlan[];
    /** ID of the user who created the plan */
    userId: string;
    /** ID of the user who shared this plan (if applicable) */
    sharedBy?: string;
    /** Whether this plan was shared from another user */
    isShared?: boolean;
}
