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
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';
import { RHFTextField, RHFSelect, RHFDatePicker, Form } from 'src/components/hook-form';
import { fDate, fTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Event' },
  { id: 'date', label: 'Date' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'ticketPrice', label: 'Ticket Price', align: 'right' },
  { id: 'status', label: 'Status' },
  { id: '', label: '' },
];

const EVENT_TYPES = [
  'Music',
  'Food & Drink',
  'Arts',
  'Sports',
  'Business',
  'Technology',
  'Community',
  'Other',
];

const EVENT_STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ----------------------------------------------------------------------

export default function EventManagement() {
  const [events, setEvents] = useState([
    { 
      id: '1', 
      name: 'Summer Music Festival', 
      type: 'Music', 
      date: new Date('2023-06-15T19:00:00'), 
      capacity: 1000,
      ticketPrice: 59.99,
      status: 'upcoming',
      location: 'City Park',
      description: 'Annual summer music festival featuring local and international artists.'
    },
    { 
      id: '2', 
      name: 'Food & Wine Expo', 
      type: 'Food & Drink', 
      date: new Date('2023-07-22T11:00:00'), 
      capacity: 500,
      ticketPrice: 35.00,
      status: 'upcoming',
      location: 'Convention Center',
      description: 'Showcase of local restaurants and wineries with tastings included.'
    },
    { 
      id: '3', 
      name: 'Tech Conference', 
      type: 'Technology', 
      date: new Date('2023-08-05T09:00:00'), 
      capacity: 300,
      ticketPrice: 149.99,
      status: 'upcoming',
      location: 'Business Center',
      description: 'Annual tech conference with speakers, workshops, and networking opportunities.'
    },
    { 
      id: '4', 
      name: 'Art Exhibition', 
      type: 'Arts', 
      date: new Date('2023-05-10T10:00:00'), 
      capacity: 200,
      ticketPrice: 15.00,
      status: 'completed',
      location: 'City Gallery',
      description: 'Featuring works from local artists across multiple media.'
    },
    { 
      id: '5', 
      name: 'Community Cleanup', 
      type: 'Community', 
      date: new Date('2023-09-18T08:00:00'), 
      capacity: 100,
      ticketPrice: 0,
      status: 'upcoming',
      location: 'Riverside Park',
      description: 'Volunteer event to clean up the riverside park and trails.'
    },
  ]);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const handleAddEvent = () => {
    setEditingEvent(null);
    setOpenDialog(true);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEvent(null);
  };

  const handleSaveEvent = (formData: any) => {
    if (editingEvent) {
      // Update existing event
      setEvents(
        events.map((event) => (event.id === editingEvent.id ? { ...formData, id: event.id } : event))
      );
    } else {
      // Add new event
      const newId = String(events.length + 1);
      setEvents([...events, { ...formData, id: newId }]);
    }
    handleCloseDialog();
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((event) => event.id !== id));
  };

  const getStatusColor = (status: string) => {
    if (status === 'upcoming') return 'info';
    if (status === 'ongoing') return 'success';
    if (status === 'completed') return 'default';
    return 'error';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <Stack
          sx={{ py: 2, px: 3 }}
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">Events</Typography>

          <Button
            variant="contained"
            startIcon={<Iconify icon="eva:plus-fill" />}
            onClick={handleAddEvent}
          >
            Create Event
          </Button>
        </Stack>

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size="medium">
              <TableHeadCustom headLabel={TABLE_HEAD} />

              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            display: 'flex',
                            borderRadius: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.neutral',
                          }}
                        >
                          <Iconify
                            icon={
                              event.type === 'Music' ? 'solar:music-note-bold-duotone' :
                              event.type === 'Food & Drink' ? 'solar:glass-bold-duotone' :
                              event.type === 'Technology' ? 'solar:laptop-bold-duotone' :
                              event.type === 'Arts' ? 'solar:palette-bold-duotone' :
                              event.type === 'Community' ? 'solar:users-group-rounded-bold-duotone' :
                              'solar:calendar-bold-duotone'
                            }
                            sx={{ color: 'text.secondary' }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {event.name}
                          </Typography>
                          <Typography variant="body2" noWrap color="text.secondary">
                            {event.type}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{fDate(event.date)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {fTime(event.date)}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>{event.capacity}</TableCell>

                    <TableCell align="right">
                      {event.ticketPrice > 0 ? fCurrency(event.ticketPrice) : 'Free'}
                    </TableCell>

                    <TableCell>
                      <Box
                        sx={{
                          display: 'inline-block',
                          color: `${getStatusColor(event.status)}.main`,
                          bgcolor: `${getStatusColor(event.status)}.lighter`,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                        }}
                      >
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          startIcon={<Iconify icon="solar:pen-bold" />}
                          onClick={() => handleEditEvent(event)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                          onClick={() => handleDeleteEvent(event.id)}
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
        <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid xs={12}>
                <RHFTextField
                  name="name"
                  label="Event Name"
                  defaultValue={editingEvent?.name || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFSelect
                  name="type"
                  label="Event Type"
                  defaultValue={editingEvent?.type || ''}
                >
                  {EVENT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="location"
                  label="Location"
                  defaultValue={editingEvent?.location || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFDatePicker
                  name="date"
                  label="Event Date & Time"
                  defaultValue={editingEvent?.date || new Date()}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="capacity"
                  label="Capacity"
                  type="number"
                  defaultValue={editingEvent?.capacity || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="ticketPrice"
                  label="Ticket Price"
                  type="number"
                  defaultValue={editingEvent?.ticketPrice || ''}
                  InputProps={{
                    startAdornment: <Box component="span" sx={{ mr: 1 }}>$</Box>,
                  }}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFSelect
                  name="status"
                  label="Status"
                  defaultValue={editingEvent?.status || 'upcoming'}
                >
                  {EVENT_STATUS_OPTIONS.map((option) => (
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
                  rows={4}
                  defaultValue={editingEvent?.description || ''}
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
                  location: formData.get('location') as string,
                  date: new Date(formData.get('date') as string),
                  capacity: parseInt(formData.get('capacity') as string, 10),
                  ticketPrice: parseFloat(formData.get('ticketPrice') as string),
                  status: formData.get('status') as string,
                  description: formData.get('description') as string,
                };
                handleSaveEvent(data);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
} 