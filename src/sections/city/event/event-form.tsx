import { useState } from 'react';
import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  RHFTextField,
  RHFSelect,
  RHFDatePicker,
  Form,
} from 'src/components/hook-form';

// ----------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  'Food',
  'Music',
  'Arts',
  'Sports',
  'Business',
  'Education',
  'Technology',
  'Community',
  'Drinks',
  'Other'
];

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ----------------------------------------------------------------------

type EventFormProps = {
  event: {
    id?: string;
    name?: string;
    category?: string;
    location?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    photoUrl?: string;
  } | null;
  onSave: (formData: EventFormValues) => void;
};

interface EventFormValues {
  id?: string;
  name: string;
  category: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: string;
  photoUrl: string;
}

export default function EventForm({ event, onSave }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const EventSchema = zod.object({
    id: zod.string().optional(),
    name: zod.string().min(1, 'Name is required'),
    category: zod.string().min(1, 'Category is required'),
    location: zod.string().min(1, 'Location is required'),
    startDate: zod.date({
      required_error: 'Start date is required',
      invalid_type_error: 'Start date must be a valid date',
    }),
    endDate: zod.date({
      required_error: 'End date is required',
      invalid_type_error: 'End date must be a valid date',
    }),
    status: zod.string().min(1, 'Status is required'),
    photoUrl: zod.string().optional(),
  }).refine(data => data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

  const defaultValues = {
    id: event?.id,
    name: event?.name || '',
    category: event?.category || '',
    location: event?.location || '',
    startDate: event?.startDate || new Date(),
    endDate: event?.endDate || new Date(),
    status: event?.status || 'upcoming',
    photoUrl: event?.photoUrl || '',
  };

  const methods = useForm<EventFormValues>({
    resolver: zodResolver(EventSchema),
    defaultValues,
  });

  const onSubmit = methods.handleSubmit(async (data) => {
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
          <RHFTextField name="name" label="Event Name" />
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
          <RHFDatePicker name="startDate" label="Start Date" />
        </Grid>

        <Grid xs={12} md={6}>
          <RHFDatePicker name="endDate" label="End Date" />
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

        <Grid xs={12} md={6}>
          <RHFTextField 
            name="photoUrl" 
            label="Photo URL" 
            placeholder="https://example.com/photo.jpg" 
          />
        </Grid>

        <Grid xs={12} display="flex" justifyContent="flex-end">
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {event ? 'Update Event' : 'Create Event'}
          </LoadingButton>
        </Grid>
      </Grid>
    </Form>
  );
} 