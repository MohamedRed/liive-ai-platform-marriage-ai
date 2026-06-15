import { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography, Card, Container, Divider, List, ListItem, ListItemText, Grid } from '@mui/material';

import { useSettingsContext } from 'src/components/settings';
import { DashboardContent } from 'src/layouts/dashboard';

interface OrganInfo {
  name: string;
  description: string;
  nutrients: Array<{ name: string; benefit: string }>;
  supplements: Array<{ name: string; description: string }>;
}

export default function HealthPage() {
  const settings = useSettingsContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganInfo | null>(null);

  // Sample data for organs
  const organData: Record<string, OrganInfo> = {
    heart: {
      name: 'Heart',
      description: 'The heart is a muscular organ that pumps blood throughout the body, supplying oxygen and nutrients to tissues and removing carbon dioxide and other wastes.',
      nutrients: [
        { name: 'Omega-3 Fatty Acids', benefit: 'Reduces inflammation and lowers blood pressure' },
        { name: 'Potassium', benefit: 'Helps regulate heart rhythm and blood pressure' },
        { name: 'Magnesium', benefit: 'Supports proper heart muscle function' },
        { name: 'CoQ10', benefit: 'Helps generate energy in cells and has antioxidant properties' }
      ],
      supplements: [
        { name: 'Fish Oil', description: 'Rich source of omega-3 fatty acids' },
        { name: 'CoQ10 Supplements', description: 'May improve heart function, especially for those on statins' },
        { name: 'Magnesium Supplements', description: 'Helps with heart rhythm and blood pressure' }
      ]
    },
    liver: {
      name: 'Liver',
      description: 'The liver is a vital organ that processes nutrients, filters blood, and removes toxins from the body.',
      nutrients: [
        { name: 'Antioxidants', benefit: 'Helps protect liver cells from damage' },
        { name: 'B Vitamins', benefit: 'Supports metabolic functions in the liver' },
        { name: 'Choline', benefit: 'Helps transport fat from the liver' }
      ],
      supplements: [
        { name: 'Milk Thistle', description: 'Has antioxidant and anti-inflammatory properties' },
        { name: 'NAC (N-Acetyl Cysteine)', description: 'Helps produce glutathione, a powerful antioxidant' },
        { name: 'Turmeric/Curcumin', description: 'Has anti-inflammatory and antioxidant effects' }
      ]
    },
    brain: {
      name: 'Brain',
      description: 'The brain is the center of the nervous system, controlling thoughts, memory, emotions, and movements.',
      nutrients: [
        { name: 'Omega-3 Fatty Acids', benefit: 'Supports brain structure and function' },
        { name: 'Antioxidants', benefit: 'Protects brain cells from oxidative stress' },
        { name: 'B Vitamins', benefit: 'Supports energy metabolism in brain cells' }
      ],
      supplements: [
        { name: 'Omega-3 Supplements', description: 'Supports cognitive function and reduces inflammation' },
        { name: 'Vitamin B Complex', description: 'Supports brain health and energy production' },
        { name: 'Ginkgo Biloba', description: 'May improve blood circulation to the brain' }
      ]
    }
  };

  // This function would be called from the parent component when an organ is selected
  // For now, we'll provide a way for users to manually select organs for demonstration
  const handleSelectOrgan = (organId: string) => {
    if (organData[organId]) {
      setSelectedOrgan(organData[organId]);
    }
  };

  return (
    <>
      <Helmet>
        <title>Health - 3D Human Body</title>
      </Helmet>

      <DashboardContent maxWidth={settings.compactLayout ? 'lg' : false}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Interactive 3D Human Body
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 4 }}>
          Explore the human body in 3D. Use the Zygote Body controls to navigate, select different body systems, and learn about organs. 
          Then use the panel on the right to see nutrients and supplements for key organs.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: 740, position: 'relative', overflow: 'hidden' }}>
              <Box 
                component="iframe"
                ref={iframeRef}
                src="https://www.zygotebody.com"
                width="100%"
                height="100%"
                sx={{ border: 0 }}
                title="Zygote Body 3D Human Anatomy"
              />
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ height: 740, overflow: 'auto', p: 3 }}>
              {selectedOrgan ? (
                <>
                  <Typography variant="h5" sx={{ mb: 2 }}>
                    {selectedOrgan.name}
                  </Typography>
                  
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    {selectedOrgan.description}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Important Nutrients
                  </Typography>
                  
                  <List>
                    {selectedOrgan.nutrients.map((nutrient, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText 
                          primary={nutrient.name} 
                          secondary={nutrient.benefit} 
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Recommended Supplements
                  </Typography>
                  
                  <List>
                    {selectedOrgan.supplements.map((supplement, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText 
                          primary={supplement.name} 
                          secondary={supplement.description} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              ) : (
                <>
                  <Box sx={{ 
                    mb: 4,
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'center', 
                    alignItems: 'center',
                    textAlign: 'center',
                    px: 2
                  }}>
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                      Select an organ to view information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Explore the 3D model on the left, then click a button below to see nutrition details
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Quick organ selection:
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {Object.keys(organData).map((organId) => (
                      <Grid item xs={4} key={organId}>
                        <Box
                          onClick={() => handleSelectOrgan(organId)}
                          sx={{
                            p: 1.5,
                            textAlign: 'center',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'action.hover',
                              transform: 'translateY(-2px)'
                            }
                          }}
                        >
                          <Typography variant="body2">
                            {organData[organId].name}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </Card>
          </Grid>
        </Grid>
      </DashboardContent>
    </>
  );
} 