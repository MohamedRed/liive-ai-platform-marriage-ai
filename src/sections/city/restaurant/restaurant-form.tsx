import { useState, useEffect } from 'react';
import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  RHFTextField,
  RHFSelect,
  RHFRating,
  Form,
} from 'src/components/hook-form';

// ----------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  'French',
  'Italian',
  'Japanese',
  'American', 
  'Mexican',
  'Chinese',
  'Indian',
  'Thai',
  'Mediterranean',
  'Other'
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// ----------------------------------------------------------------------

type RestaurantFormProps = {
  restaurant: {
    id?: string;
    name?: string;
    category?: string;
    location?: string;
    rating?: number;
    status?: string;
    photoUrl?: string;
  } | null;
  onSave: (formData: RestaurantFormValues) => void;
};

interface RestaurantFormValues {
  id?: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  status: string;
  photoUrl: string;
}

export default function RestaurantForm({ restaurant, onSave }: RestaurantFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const RestaurantSchema = zod.object({
    name: zod.string().min(1, 'Name is required'),
    category: zod.string().min(1, 'Category is required'),
    location: zod.string().min(1, 'Location is required'),
    rating: zod.number().min(0).max(5),
    status: zod.string().min(1, 'Status is required'),
    photoUrl: zod.string().optional(),
    id: zod.string().optional(),
  });

  const defaultValues = {
    id: restaurant?.id,
    name: restaurant?.name || '',
    category: restaurant?.category || '',
    location: restaurant?.location || '',
    rating: restaurant?.rating || 0,
    status: restaurant?.status || 'active',
    photoUrl: restaurant?.photoUrl || '',
  };

  const methods = useForm<RestaurantFormValues>({
    resolver: zodResolver(RestaurantSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting: formIsSubmitting },
  } = methods;

  useEffect(() => {
    if (restaurant) {
      reset(defaultValues);
    }
  }, [restaurant, reset, defaultValues]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      setIsSubmitting(true);
      onSave(data);
      setIsSubmitting(false);
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3} sx={{ p: 3 }}>
        <Grid xs={12}>
          <RHFTextField name="name" label="Restaurant Name" />
        </Grid>

        <Grid xs={12} md={6}>
          <RHFSelect name="category" label="Category">
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </RHFSelect>
        </Grid>

        <Grid xs={12} md={6}>
          <RHFTextField name="location" label="Location" />
        </Grid>

        <Grid xs={12} md={6}>
          <Stack spacing={1}>
            <Box component="label" sx={{ typography: 'body2' }}>
              Rating
            </Box>
            <RHFRating name="rating" precision={0.5} />
          </Stack>
        </Grid>

        <Grid xs={12} md={6}>
          <RHFSelect name="status" label="Status">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </RHFSelect>
        </Grid>

        <Grid xs={12}>
          <RHFTextField 
            name="photoUrl" 
            label="Photo URL" 
            placeholder="https://example.com/photo.jpg" 
          />
        </Grid>

        <Grid xs={12} display="flex" justifyContent="flex-end">
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {restaurant ? 'Update Restaurant' : 'Create Restaurant'}
          </LoadingButton>
        </Grid>
      </Grid>
    </Form>
  );
} 