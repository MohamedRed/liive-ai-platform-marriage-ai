import { initializeApp } from 'firebase-admin/app';
import { LEGACY_COLLECTIONS } from '@livve-1/database-types';

// Re-export these constants for backward compatibility during the transition to
// domain-specific databases.
export { LEGACY_COLLECTIONS };

import * as users from './domains/users';
import * as marriage from './domains/marriage';
import * as identityVerification from './domains/identity-verification';

const mealPlanning = require('./domains/meal-planning/meal-plan');
const testFunction = require('./domains/meal-planning/test-function');
const superMinimalTest = require('./domains/meal-planning/super-minimal-test');

initializeApp();

export const userFunctions = users;
export const marriageFunctions = marriage;
export const identityVerificationFunctions = identityVerification;

exports.generateMealPlan = mealPlanning.generateMealPlan;
exports.getUserMealPlans = mealPlanning.getUserMealPlans;
exports.updateMeal = mealPlanning.updateMeal;
exports.shareMealPlan = mealPlanning.shareMealPlan;

exports.testMealPlanningFunction = testFunction.testMealPlanningFunction;
exports.minimalTestFunction = testFunction.minimalTestFunction;
exports.superMinimalTest = superMinimalTest.superMinimalTest;
