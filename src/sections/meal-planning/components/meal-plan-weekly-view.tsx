import { useState } from 'react';
import { 
  Box, 
  Card, 
  Grid, 
  Tabs, 
  Tab, 
  Typography, 
  Stack, 
  Divider, 
  Button, 
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

interface MealPlanWeeklyViewProps {
  mealPlan: any; // This will be properly typed once we have the backend API
}

const StyledMealCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[10],
  },
}));

const StyledMealImage = styled('img')({
  width: '100%',
  height: 180,
  objectFit: 'cover',
});

export function MealPlanWeeklyView({ mealPlan }: MealPlanWeeklyViewProps) {
  const [currentDay, setCurrentDay] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [openMealDetails, setOpenMealDetails] = useState(false);
  const [openCookingMode, setOpenCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleChangeDay = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentDay(newValue);
  };

  const handleOpenMealDetails = (meal: any) => {
    setSelectedMeal(meal);
    setOpenMealDetails(true);
  };

  const handleCloseMealDetails = () => {
    setOpenMealDetails(false);
  };

  const handleStartCooking = () => {
    setOpenMealDetails(false);
    setOpenCookingMode(true);
    setCurrentStep(0);
  };

  const handleCloseCookingMode = () => {
    setOpenCookingMode(false);
  };

  const handleNextStep = () => {
    if (selectedMeal && currentStep < selectedMeal.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Mock data for now - will be replaced with actual data from props
  const days = mealPlan?.weekDays || [];

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={currentDay} 
          onChange={handleChangeDay} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {days.map((day: any, index: number) => (
            <Tab key={index} label={day.day} />
          ))}
        </Tabs>
      </Box>

      {days.length > 0 && days[currentDay] && (
        <Grid container spacing={3}>
          {days[currentDay].meals.map((meal: any, index: number) => (
            <Grid item xs={12} md={4} key={index}>
              <StyledMealCard>
                <Box sx={{ position: 'relative' }}>
                  <StyledMealImage src={meal.thumbnail} alt={meal.name} />
                  <Chip 
                    label={meal.type} 
                    color="primary" 
                    sx={{ 
                      position: 'absolute', 
                      top: 16, 
                      left: 16,
                      fontWeight: 'bold',
                    }} 
                  />
                </Box>
                
                <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" gutterBottom>
                    {meal.name}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Chip 
                      size="small" 
                      icon={<Iconify icon="mdi:clock-outline" />} 
                      label={meal.cookingTime} 
                    />
                    <Chip 
                      size="small" 
                      icon={<Iconify icon="mdi:currency-usd" />} 
                      label={meal.costPerServing} 
                    />
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {meal.ingredients.slice(0, 3).join(', ')}
                    {meal.ingredients.length > 3 && ` +${meal.ingredients.length - 3} more`}
                  </Typography>
                  
                  <Box sx={{ mt: 'auto' }}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      onClick={() => handleOpenMealDetails(meal)}
                      startIcon={<Iconify icon="mdi:information-outline" />}
                    >
                      Details
                    </Button>
                  </Box>
                </Box>
              </StyledMealCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Meal Details Dialog */}
      <Dialog 
        open={openMealDetails} 
        onClose={handleCloseMealDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedMeal && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6">{selectedMeal.name}</Typography>
                <Chip label={selectedMeal.type} color="primary" size="small" />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <img 
                    src={selectedMeal.thumbnail} 
                    alt={selectedMeal.name} 
                    style={{ width: '100%', borderRadius: 8 }} 
                  />
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Nutrition Information
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Calories:</strong> {selectedMeal.nutritionInfo.calories}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Protein:</strong> {selectedMeal.nutritionInfo.protein}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Carbs:</strong> {selectedMeal.nutritionInfo.carbs}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Fat:</strong> {selectedMeal.nutritionInfo.fat}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Health Benefits
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {selectedMeal.healthBenefits.map((benefit: string, index: number) => (
                        <Chip 
                          key={index} 
                          label={benefit} 
                          size="small" 
                          icon={<Iconify icon="mdi:heart" />} 
                          sx={{ mb: 1 }} 
                        />
                      ))}
                    </Stack>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Ingredients
                  </Typography>
                  <List dense>
                    {selectedMeal.ingredients.map((ingredient: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Iconify icon="mdi:food-apple" />
                        </ListItemIcon>
                        <ListItemText primary={ingredient} />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Utensils Needed
                  </Typography>
                  <List dense>
                    {selectedMeal.utensils.map((utensil: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Iconify icon="mdi:silverware" />
                        </ListItemIcon>
                        <ListItemText primary={utensil} />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Cooking Steps
                  </Typography>
                  <List dense>
                    {selectedMeal.steps.map((step: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                            {index + 1}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary={step.text} 
                          secondary={`Video timestamp: ${step.videoTimestamp}`} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button 
                startIcon={<Iconify icon="mdi:youtube" />}
                color="error"
                href={selectedMeal.videoUrl}
                target="_blank"
              >
                Watch Video
              </Button>
              <Button 
                startIcon={<Iconify icon="mdi:swap-horizontal" />}
                color="warning"
              >
                Replace Meal
              </Button>
              <Button 
                startIcon={<Iconify icon="mdi:chef-hat" />}
                variant="contained"
                onClick={handleStartCooking}
              >
                Start Cooking
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Cooking Mode Dialog */}
      <Dialog 
        open={openCookingMode} 
        onClose={handleCloseCookingMode}
        maxWidth="md"
        fullWidth
      >
        {selectedMeal && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">Cooking: {selectedMeal.name}</Typography>
                <Chip 
                  label={`Step ${currentStep + 1} of ${selectedMeal.steps.length}`} 
                  color="primary" 
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ position: 'relative', pb: '56.25%', height: 0, mb: 3 }}>
                <iframe
                  src={`${selectedMeal.videoUrl.replace('watch?v=', 'embed/')}?start=${selectedMeal.steps[currentStep].videoTimestamp.split(':').reduce((acc: number, time: string) => (60 * acc) + +time, 0)}&autoplay=1`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 8 }}
                  title="Cooking Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </Box>
              
              <Card sx={{ mb: 3, p: 2, bgcolor: 'background.neutral' }}>
                <Typography variant="h6" gutterBottom>
                  Step {currentStep + 1}: {selectedMeal.steps[currentStep].text}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Follow along with the video above. Use voice commands like "next step", "previous step", or "repeat" to navigate.
                </Typography>
              </Card>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  startIcon={<Iconify icon="mdi:arrow-left" />}
                  onClick={handlePreviousStep}
                  disabled={currentStep === 0}
                >
                  Previous Step
                </Button>
                <Button
                  endIcon={<Iconify icon="mdi:arrow-right" />}
                  variant="contained"
                  onClick={handleNextStep}
                  disabled={currentStep === selectedMeal.steps.length - 1}
                >
                  Next Step
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button 
                startIcon={<Iconify icon="mdi:microphone" />}
                color="primary"
              >
                Voice Commands
              </Button>
              <Button 
                startIcon={<Iconify icon="mdi:exit-to-app" />}
                color="error"
                onClick={handleCloseCookingMode}
              >
                Exit Cooking Mode
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
} 