import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MealPlanInput } from '../components/meal-plan-input';
import { MealPlanWeeklyView } from '../components/meal-plan-weekly-view';
import { VoiceAssistant } from '../components/voice-assistant';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/theme';

// Mocks
jest.mock('../hooks', () => ({
  useMealPlanning: () => ({
    loading: false,
    error: null,
    mealPlans: [],
    currentMealPlan: null,
    generateMealPlan: jest.fn(),
    getUserMealPlans: jest.fn(),
    updateMeal: jest.fn(),
    shareMealPlan: jest.fn(),
    setCurrentMealPlan: jest.fn(),
  }),
}));

// Mock data
const mockMealPlan = {
  id: '123456',
  createdAt: new Date().toISOString(),
  preferences: 'Test preferences',
  userId: 'user123',
  weekDays: [
    {
      day: 'Monday',
      meals: [
        {
          type: 'Breakfast',
          name: 'Test Breakfast',
          videoUrl: 'https://www.youtube.com/watch?v=123',
          thumbnail: 'https://example.com/image.jpg',
          cookingTime: '15 minutes',
          costPerServing: '$3.20',
          ingredients: ['Ingredient 1', 'Ingredient 2'],
          utensils: ['Utensil 1', 'Utensil 2'],
          nutritionInfo: {
            calories: 350,
            protein: '15g',
            carbs: '25g',
            fat: '22g',
          },
          healthBenefits: ['Benefit 1', 'Benefit 2'],
          steps: [
            { text: 'Step 1', videoTimestamp: '0:10' },
            { text: 'Step 2', videoTimestamp: '0:45' },
          ],
        },
      ],
    },
  ],
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('MealPlanInput Component', () => {
  const mockSubmit = jest.fn();
  
  test('renders input form correctly', () => {
    renderWithProviders(<MealPlanInput onSubmit={mockSubmit} loading={false} />);
    
    expect(screen.getByRole('button', { name: /create meal plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /video/i })).toBeInTheDocument();
  });
  
  test('allows entering text and submitting', () => {
    renderWithProviders(<MealPlanInput onSubmit={mockSubmit} loading={false} />);
    
    const textInput = screen.getByRole('textbox');
    fireEvent.change(textInput, { target: { value: 'Test meal plan description' } });
    
    const submitButton = screen.getByRole('button', { name: /create meal plan/i });
    fireEvent.click(submitButton);
    
    expect(mockSubmit).toHaveBeenCalledWith({
      description: 'Test meal plan description',
      imageUrl: undefined,
      videoUrl: undefined,
    });
  });
  
  test('shows loading state when loading prop is true', () => {
    renderWithProviders(<MealPlanInput onSubmit={mockSubmit} loading={true} />);
    
    expect(screen.getByRole('button', { name: /generating plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generating plan/i })).toBeDisabled();
  });
});

describe('MealPlanWeeklyView Component', () => {
  test('renders meal plan correctly', () => {
    renderWithProviders(<MealPlanWeeklyView mealPlan={mockMealPlan} />);
    
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Test Breakfast')).toBeInTheDocument();
    expect(screen.getByText('15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });
  
  test('shows meal details when clicking Details button', async () => {
    renderWithProviders(<MealPlanWeeklyView mealPlan={mockMealPlan} />);
    
    const detailsButton = screen.getByRole('button', { name: /details/i });
    fireEvent.click(detailsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Nutrition Information')).toBeInTheDocument();
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
      expect(screen.getByText('Utensils Needed')).toBeInTheDocument();
      expect(screen.getByText('Cooking Steps')).toBeInTheDocument();
    });
  });
});

describe('VoiceAssistant Component', () => {
  const mockClose = jest.fn();
  
  test('renders voice assistant dialog when open', () => {
    renderWithProviders(<VoiceAssistant open={true} onClose={mockClose} />);
    
    expect(screen.getByText('Voice Assistant')).toBeInTheDocument();
    expect(screen.getByText('Available Voice Commands')).toBeInTheDocument();
  });
  
  test('does not render when closed', () => {
    renderWithProviders(<VoiceAssistant open={false} onClose={mockClose} />);
    
    expect(screen.queryByText('Voice Assistant')).not.toBeInTheDocument();
  });
  
  test('calls onClose when close button is clicked', () => {
    renderWithProviders(<VoiceAssistant open={true} onClose={mockClose} />);
    
    const closeButton = screen.getByRole('button', { name: '' }); // Close button has no text
    fireEvent.click(closeButton);
    
    expect(mockClose).toHaveBeenCalled();
  });
}); 