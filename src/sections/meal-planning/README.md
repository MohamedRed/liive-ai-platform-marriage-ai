# Meal Planning Feature

This feature allows users to create healthy weekly meal plans based on their preferences, leveraging YouTube cooking videos to provide visual step-by-step instructions.

## Key Features

- **Preference-Based Meal Planning**: Users can describe what type of meals they want, provide an image, or link to a video for inspiration.
- **Optimized Meal Plans**: The system creates meal plans that minimize food waste by reusing ingredients across the week.
- **Video-Based Recipes**: Each meal links to a YouTube cooking video with timestamps for each step.
- **Voice Assistant**: A hands-free cooking experience with voice commands to navigate steps.
- **Meal Statistics**: Track costs, cooking time, and nutritional information.
- **Social Sharing**: Share meal plans with other Liive users.
- **History & Analytics**: View past meal plans and cooking statistics.

## Directory Structure

```
meal-planning/
├── components/            # UI components
│   ├── meal-plan-input.tsx       # User input form
│   ├── meal-plan-weekly-view.tsx # Weekly view of meal plan
│   └── voice-assistant.tsx       # Voice assistant component
├── history/              # History view
│   └── meal-plan-history.tsx     # History and statistics
├── hooks/                # Custom hooks
│   └── useMealPlanning.ts        # Hook to interact with backend
├── view/                 # Main views
│   └── meal-planning-view.tsx    # Main view component
└── __tests__/            # Test files
    └── meal-planning.test.tsx    # Component tests
```

## Backend Implementation

The backend is implemented as Google Cloud Functions with the following endpoints:

1. `generateMealPlan`: Creates a meal plan based on user preferences
2. `getUserMealPlans`: Retrieves a user's meal plans
3. `updateMeal`: Updates a specific meal in a meal plan
4. `shareMealPlan`: Shares a meal plan with another user

## Core Technologies

- React for UI components
- Firebase/Firestore for database
- Google Cloud Functions for backend
- YouTube API for video search and metadata
- Pinecone for vector similarity search (caching similar meal plans)
- Firebase Authentication for user management

## Deployment

A dedicated deployment script is provided in `functions-nodejs/deploy-meal-planning.sh`. To deploy the cloud functions:

```bash
cd apps/marriage-ai/functions-nodejs
./deploy-meal-planning.sh
```

## Testing

Run component tests with:

```bash
cd apps/marriage-ai
npm test -- --testPathPattern=meal-planning
``` 