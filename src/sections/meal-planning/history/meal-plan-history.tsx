import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Button, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Stack,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Iconify } from 'src/components/iconify';
import { fDateTime } from 'src/utils/format-time';
import { useMealPlanning } from '../hooks';

// Types
interface MealPlanHistoryProps {
  onViewMealPlan: (mealPlan: any) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  height: '100%',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[10],
  },
}));

export function MealPlanHistory({ onViewMealPlan }: MealPlanHistoryProps) {
  const theme = useTheme();
  const { mealPlans, loading, error, getUserMealPlans } = useMealPlanning();
  const [statistics, setStatistics] = useState({
    totalMealPlans: 0,
    averageCostPerMeal: '0',
    mostUsedIngredient: '',
    averageCookingTime: '0 minutes',
    favoriteCuisine: '',
  });

  // Fetch user's meal plans
  useEffect(() => {
    const fetchMealPlans = async () => {
      await getUserMealPlans();
    };
    
    fetchMealPlans();
  }, [getUserMealPlans]);

  // Calculate statistics when meal plans change
  useEffect(() => {
    if (mealPlans.length > 0) {
      // Calculate average cost per meal
      let totalCost = 0;
      let mealCount = 0;
      
      // Count ingredients and cuisines
      const ingredientCounts: Record<string, number> = {};
      const cuisineTypes: Record<string, number> = {};
      
      // Total cooking time
      let totalCookingMinutes = 0;
      
      mealPlans.forEach(plan => {
        plan.weekDays.forEach(day => {
          day.meals.forEach(meal => {
            mealCount += 1;
            
            // Extract cost (remove $ and convert to number)
            const cost = parseFloat(meal.costPerServing.replace('$', ''));
            if (!isNaN(cost)) {
              totalCost += cost;
            }
            
            // Count ingredients
            meal.ingredients.forEach(ingredient => {
              ingredientCounts[ingredient] = (ingredientCounts[ingredient] || 0) + 1;
            });
            
            // Extract cooking time (assuming format like "30 minutes")
            const timeMatch = meal.cookingTime.match(/(\d+)/);
            if (timeMatch) {
              totalCookingMinutes += parseInt(timeMatch[1], 10);
            }
            
            // Basic cuisine detection from meal name
            const cuisineKeywords = [
              'italian', 'mexican', 'chinese', 'indian', 'thai', 
              'japanese', 'french', 'mediterranean', 'greek'
            ];
            
            cuisineKeywords.forEach(cuisine => {
              if (meal.name.toLowerCase().includes(cuisine)) {
                cuisineTypes[cuisine] = (cuisineTypes[cuisine] || 0) + 1;
              }
            });
          });
        });
      });
      
      // Find most used ingredient
      let mostUsedIngredient = '';
      let maxIngredientCount = 0;
      Object.entries(ingredientCounts).forEach(([ingredient, count]) => {
        if (count > maxIngredientCount) {
          mostUsedIngredient = ingredient;
          maxIngredientCount = count;
        }
      });
      
      // Find favorite cuisine
      let favoriteCuisine = 'Mixed';
      let maxCuisineCount = 0;
      Object.entries(cuisineTypes).forEach(([cuisine, count]) => {
        if (count > maxCuisineCount) {
          favoriteCuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
          maxCuisineCount = count;
        }
      });
      
      // Set statistics
      setStatistics({
        totalMealPlans: mealPlans.length,
        averageCostPerMeal: mealCount > 0 ? `$${(totalCost / mealCount).toFixed(2)}` : '$0',
        mostUsedIngredient: mostUsedIngredient || 'N/A',
        averageCookingTime: mealCount > 0 ? `${Math.round(totalCookingMinutes / mealCount)} minutes` : '0 minutes',
        favoriteCuisine,
      });
    }
  }, [mealPlans]);

  const handleViewMealPlan = useCallback((mealPlan) => {
    onViewMealPlan(mealPlan);
  }, [onViewMealPlan]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Your Meal Plan History
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ my: 3 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      ) : (
        <>
          {/* Statistics section */}
          <Card sx={{ mb: 4, overflow: 'hidden' }}>
            <Box
              sx={{
                py: 2,
                px: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <Typography variant="h6">Your Cooking Statistics</Typography>
            </Box>
            
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Iconify icon="mdi:food-variant" width={40} height={40} sx={{ mb: 1, color: 'primary.main' }} />
                    <Typography variant="h5">{statistics.totalMealPlans}</Typography>
                    <Typography variant="body2" color="text.secondary">Meal Plans Created</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Iconify icon="mdi:currency-usd" width={40} height={40} sx={{ mb: 1, color: 'success.main' }} />
                    <Typography variant="h5">{statistics.averageCostPerMeal}</Typography>
                    <Typography variant="body2" color="text.secondary">Average Cost Per Meal</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Box textAlign="center">
                    <Iconify icon="mdi:clock-outline" width={40} height={40} sx={{ mb: 1, color: 'warning.main' }} />
                    <Typography variant="h5">{statistics.averageCookingTime}</Typography>
                    <Typography variant="body2" color="text.secondary">Average Cooking Time</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Iconify icon="mdi:food-apple" width={24} height={24} sx={{ mr: 1, color: 'info.main' }} />
                    <Typography variant="body2">
                      <strong>Most Used Ingredient:</strong> {statistics.mostUsedIngredient}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Iconify icon="mdi:silverware-fork-knife" width={24} height={24} sx={{ mr: 1, color: 'info.main' }} />
                    <Typography variant="body2">
                      <strong>Favorite Cuisine:</strong> {statistics.favoriteCuisine}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          {/* Meal plans history */}
          <Typography variant="h6" gutterBottom>
            Past Meal Plans
          </Typography>
          
          {mealPlans.length === 0 ? (
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <Iconify icon="mdi:food-off" width={60} height={60} sx={{ color: 'text.disabled', mb: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                No Meal Plans Yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You haven't created any meal plans yet. Start by creating your first meal plan!
              </Typography>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {mealPlans.map((mealPlan) => (
                <Grid item xs={12} md={6} key={mealPlan.id}>
                  <StyledCard>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" noWrap>
                          {new Date(mealPlan.createdAt).toLocaleDateString()} Meal Plan
                        </Typography>
                        {mealPlan.isShared && (
                          <Chip 
                            size="small"
                            label="Shared" 
                            color="info"
                            icon={<Iconify icon="mdi:share-variant" />}
                          />
                        )}
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} noWrap>
                        <strong>Preferences:</strong> {mealPlan.preferences}
                      </Typography>
                      
                      <Box 
                        sx={{ 
                          mb: 2, 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 1 
                        }}
                      >
                        {mealPlan.weekDays[0]?.meals.map((meal, index) => (
                          <Chip 
                            key={index}
                            size="small"
                            label={meal.type}
                            color={
                              meal.type === 'Breakfast' ? 'success' :
                              meal.type === 'Lunch' ? 'warning' : 'error'
                            }
                          />
                        ))}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" display="block">
                        Created: {fDateTime(mealPlan.createdAt)}
                      </Typography>
                      
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ mt: 2 }}
                        onClick={() => handleViewMealPlan(mealPlan)}
                        startIcon={<Iconify icon="mdi:eye" />}
                      >
                        View Meal Plan
                      </Button>
                    </CardContent>
                  </StyledCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
} 