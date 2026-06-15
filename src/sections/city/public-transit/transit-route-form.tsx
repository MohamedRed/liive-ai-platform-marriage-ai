import { useState } from 'react';
import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import {
  RHFTextField,
  RHFSelect,
  RHFSlider,
  Form,
} from 'src/components/hook-form';

// ----------------------------------------------------------------------

const TRANSIT_TYPE_OPTIONS = [
  { value: 'bus', label: 'Bus' },
  { value: 'tram', label: 'Tram' },
  { value: 'subway', label: 'Subway' },
  { value: 'train', label: 'Train' },
];

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'limited', label: 'Limited Service' },
  { value: 'closed', label: 'Closed' },
  { value: 'planned', label: 'Planned' },
];

// ----------------------------------------------------------------------

type TransitRouteFormProps = {
  route: {
    id?: string;
    name?: string;
    type?: string;
    stops?: number;
    status?: string;
  } | null;
  onSave: (formData: TransitRouteFormValues) => void;
};

interface TransitRouteFormValues {
  id?: string;
  name: string;
  type: string;
  stops: number;
  status: string;
}

export default function TransitRouteForm({ route, onSave }: TransitRouteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const RouteSchema = zod.object({
    id: zod.string().optional(),
    name: zod.string().min(1, 'Route name is required'),
    type: zod.string().min(1, 'Transit type is required'),
    stops: zod.number()
      .min(2, 'Route must have at least 2 stops')
      .int(),
    status: zod.string().min(1, 'Status is required'),
  });

  const defaultValues = {
    id: route?.id,
    name: route?.name || '',
    type: route?.type || 'bus',
    stops: route?.stops || 5,
    status: route?.status || 'operational',
  };

  const methods = useForm<TransitRouteFormValues>({
    resolver: zodResolver(RouteSchema),
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
          <RHFTextField name="name" label="Route Name" />
        </Grid>

        <Grid xs={12} md={6}>
          <RHFSelect name="type" label="Type">
            {TRANSIT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </RHFSelect>
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
          <Typography gutterBottom variant="subtitle2">
            Number of Stops
          </Typography>
          <RHFSlider 
            name="stops"
            min={2}
            max={30}
            step={1}
            marks={[
              { value: 2, label: '2' },
              { value: 10, label: '10' },
              { value: 20, label: '20' },
              { value: 30, label: '30' },
            ]}
          />
        </Grid>

        <Grid xs={12} display="flex" justifyContent="flex-end">
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {route ? 'Update Route' : 'Create Route'}
          </LoadingButton>
        </Grid>
      </Grid>
    </Form>
  );
} 