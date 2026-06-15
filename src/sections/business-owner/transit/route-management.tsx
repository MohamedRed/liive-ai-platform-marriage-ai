import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Unstable_Grid2';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';
import { RHFTextField, RHFSelect, RHFSlider, Form } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Route' },
  { id: 'type', label: 'Type' },
  { id: 'stops', label: 'Stops' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'status', label: 'Status' },
  { id: '', label: '' },
];

const ROUTE_TYPES = [
  { value: 'bus', label: 'Bus' },
  { value: 'tram', label: 'Tram' },
  { value: 'subway', label: 'Subway' },
  { value: 'train', label: 'Train' },
];

const ROUTE_STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'limited', label: 'Limited Service' },
  { value: 'closed', label: 'Closed' },
  { value: 'planned', label: 'Planned' },
];

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays Only' },
  { value: 'weekends', label: 'Weekends Only' },
  { value: 'seasonal', label: 'Seasonal' },
];

// ----------------------------------------------------------------------

export default function RouteManagement() {
  const [routes, setRoutes] = useState([
    { 
      id: '1', 
      name: 'Downtown Loop', 
      type: 'bus', 
      stops: 12, 
      schedule: 'daily',
      firstDeparture: '05:30',
      lastDeparture: '23:30',
      frequency: 15,
      status: 'operational',
      description: 'Main downtown bus route connecting major business and shopping centers.'
    },
    { 
      id: '2', 
      name: 'Airport Express', 
      type: 'bus', 
      stops: 5, 
      schedule: 'daily',
      firstDeparture: '04:00',
      lastDeparture: '00:00',
      frequency: 30,
      status: 'operational',
      description: 'Express service between downtown transit center and international airport.'
    },
    { 
      id: '3', 
      name: 'North-South Line', 
      type: 'subway', 
      stops: 18, 
      schedule: 'daily',
      firstDeparture: '05:00',
      lastDeparture: '01:00',
      frequency: 8,
      status: 'limited',
      description: 'Primary subway line connecting northern and southern neighborhoods through downtown.'
    },
    { 
      id: '4', 
      name: 'University Route', 
      type: 'tram', 
      stops: 10, 
      schedule: 'weekdays',
      firstDeparture: '06:00',
      lastDeparture: '21:00',
      frequency: 12,
      status: 'operational',
      description: 'Tram service connecting downtown to the university campus and research park.'
    },
    { 
      id: '5', 
      name: 'Beach Shuttle', 
      type: 'bus', 
      stops: 8, 
      schedule: 'seasonal',
      firstDeparture: '09:00',
      lastDeparture: '20:00',
      frequency: 20,
      status: 'closed',
      description: 'Seasonal shuttle service to beach areas. Operates summer months only.'
    },
  ]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);

  const handleAddRoute = () => {
    setEditingRoute(null);
    setOpenDialog(true);
  };

  const handleEditRoute = (route: any) => {
    setEditingRoute(route);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRoute(null);
  };

  const handleSaveRoute = (formData: any) => {
    if (editingRoute) {
      // Update existing route
      setRoutes(
        routes.map((route) => (route.id === editingRoute.id ? { ...formData, id: route.id } : route))
      );
    } else {
      // Add new route
      const newId = String(routes.length + 1);
      setRoutes([...routes, { ...formData, id: newId }]);
    }
    handleCloseDialog();
  };

  const handleDeleteRoute = (id: string) => {
    setRoutes(routes.filter((route) => route.id !== id));
  };

  const getRouteTypeIcon = (type: string) => {
    switch (type) {
      case 'bus':
        return 'solar:bus-bold-duotone';
      case 'tram':
        return 'solar:tram-bold-duotone';
      case 'subway':
        return 'solar:subway-bold-duotone';
      case 'train':
        return 'solar:train-bold-duotone';
      default:
        return 'solar:bus-bold-duotone';
    }
  };

  const getRouteTypeColor = (type: string) => {
    switch (type) {
      case 'bus':
        return 'default';
      case 'tram':
        return 'primary';
      case 'subway':
        return 'secondary';
      case 'train':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'operational') return 'success';
    if (status === 'limited') return 'warning';
    if (status === 'closed') return 'error';
    return 'info';
  };

  const getScheduleText = (schedule: string) => {
    switch (schedule) {
      case 'daily':
        return 'Daily';
      case 'weekdays':
        return 'Weekdays Only';
      case 'weekends':
        return 'Weekends Only';
      case 'seasonal':
        return 'Seasonal';
      default:
        return schedule;
    }
  };

  return (
    <>
      <Card>
        <Stack
          sx={{ py: 2, px: 3 }}
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">Transit Routes</Typography>

          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:plus-fill" />}
            onClick={handleAddRoute}
          >
            Add Route
          </Button>
        </Stack>

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium">
              <TableHeadCustom headLabel={TABLE_HEAD} />

              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            display: 'flex',
                            borderRadius: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: `${getRouteTypeColor(route.type)}.lighter`,
                          }}
                        >
                          <Iconify
                            icon={getRouteTypeIcon(route.type)}
                            sx={{ color: `${getRouteTypeColor(route.type)}.main` }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {route.name}
                          </Typography>
                          <Chip
                            label={ROUTE_TYPES.find((t) => t.value === route.type)?.label}
                            size="small"
                            variant="soft"
                            color={getRouteTypeColor(route.type)}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      {ROUTE_TYPES.find((t) => t.value === route.type)?.label}
                    </TableCell>

                    <TableCell>{route.stops}</TableCell>

                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{getScheduleText(route.schedule)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {route.firstDeparture} - {route.lastDeparture}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Every {route.frequency} minutes
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Box
                        sx={{
                          display: 'inline-block',
                          color: `${getStatusColor(route.status)}.main`,
                          bgcolor: `${getStatusColor(route.status)}.lighter`,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                        }}
                      >
                        {ROUTE_STATUS_OPTIONS.find((s) => s.value === route.status)?.label}
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          startIcon={<Iconify icon="solar:pen-bold" />}
                          onClick={() => handleEditRoute(route)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                          onClick={() => handleDeleteRoute(route.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingRoute ? 'Edit Transit Route' : 'Add Transit Route'}</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid xs={12}>
                <RHFTextField
                  name="name"
                  label="Route Name"
                  defaultValue={editingRoute?.name || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFSelect
                  name="type"
                  label="Transit Type"
                  defaultValue={editingRoute?.type || 'bus'}
                >
                  {ROUTE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFSelect
                  name="schedule"
                  label="Schedule"
                  defaultValue={editingRoute?.schedule || 'daily'}
                >
                  {SCHEDULE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="firstDeparture"
                  label="First Departure"
                  defaultValue={editingRoute?.firstDeparture || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="lastDeparture"
                  label="Last Departure"
                  defaultValue={editingRoute?.lastDeparture || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="stops"
                  label="Number of Stops"
                  type="number"
                  defaultValue={editingRoute?.stops || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="frequency"
                  label="Frequency (min)"
                  type="number"
                  defaultValue={editingRoute?.frequency || ''}
                />
              </Grid>

              <Grid xs={12}>
                <RHFSelect
                  name="status"
                  label="Status"
                  defaultValue={editingRoute?.status || 'operational'}
                >
                  {ROUTE_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>

              <Grid xs={12}>
                <RHFTextField
                  name="description"
                  label="Description"
                  multiline
                  rows={2}
                  defaultValue={editingRoute?.description || ''}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              // Collect form data - this would be handled by a proper form library in production
              const form = document.querySelector('form');
              if (form) {
                const formData = new FormData(form);
                const data = {
                  name: formData.get('name') as string,
                  type: formData.get('type') as string,
                  stops: parseInt(formData.get('stops') as string, 10),
                  schedule: formData.get('schedule') as string,
                  firstDeparture: formData.get('firstDeparture') as string,
                  lastDeparture: formData.get('lastDeparture') as string,
                  frequency: parseInt(formData.get('frequency') as string, 10),
                  status: formData.get('status') as string,
                  description: formData.get('description') as string,
                };
                handleSaveRoute(data);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 