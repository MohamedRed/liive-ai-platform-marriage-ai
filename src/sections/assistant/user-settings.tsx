// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
import {useTheme} from "@mui/material/styles";
import { useFirestoreDocData, useFirestore } from 'reactfire';
import { doc, WithFieldValue, updateDoc } from 'firebase/firestore';
import { useAuthContext } from "src/auth/hooks";
import { COLLECTIONS } from '@liive-marriage-ai/database-types';
import type { UserSettings } from '@liive-marriage-ai/database-types';
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Slider from "@mui/material/Slider";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Block } from "../../components/settings/drawer/styles";
import { useState, useEffect, useRef } from "react";
import { toast } from 'src/components/snackbar';
import { useLocale } from 'src/hooks/use-locale';

// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
}

type AvailableHourPeriod = {
  id: string;
  start: number;
  end: number;
  tempStart?: number;
  tempEnd?: number;
  days?: {
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
  };
}

type AvailableHoursData = {
  periods: {
    start: number;
    end: number;
    days?: {
      monday?: boolean;
      tuesday?: boolean;
      wednesday?: boolean;
      thursday?: boolean;
      friday?: boolean;
      saturday?: boolean;
      sunday?: boolean;
    };
  }[];
}

const settingsConverter = {
  toFirestore: (settings: WithFieldValue<UserSettings>) => settings,
  fromFirestore: (snap: any) => snap.data() as UserSettings,
};

const formatTime = (hour: number, locale: string): string => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  
  // Check if locale uses 24-hour format
  const uses24Hour = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: false })
    .format(date)
    .includes('24');
  
  if (uses24Hour) {
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  
  return date.toLocaleTimeString(locale, { 
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
};

export function UserSettings({isOpen, onClose}: Props) {
  const theme = useTheme();
  const firestore = useFirestore();
  const { user } = useAuthContext();
  const { locale } = useLocale();

  const settingsRef = doc(firestore, COLLECTIONS.USER_SETTINGS, user?.uid).withConverter(settingsConverter);
  const { data: settings } = useFirestoreDocData<UserSettings>(settingsRef);

  const [notificationsEnabled, setNotificationsEnabled] = useState(settings?.notification?.preferences?.enabled ?? true);
  const [availableHours, setAvailableHours] = useState<AvailableHourPeriod[]>(() => {
    const availableHoursData = settings?.notification?.preferences?.availableHours as AvailableHoursData | undefined;
    if (!availableHoursData?.periods) {
      return [{
        id: 'period-0',
        start: 9,
        end: 18,
        days: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        }
      }];
    }
    return availableHoursData.periods.map((period, index) => ({
      id: `period-${index}`,
      start: period.start,
      end: period.end,
      days: period.days
    }));
  });

  const handleSliderChange = (periodId: string, newValue: number | number[]) => {
    const [start, end] = newValue as [number, number];
    
    if (start === end) {
      toast.error('Start and end times cannot be the same');
      return;
    }

    const isValidRange = end > start || (start > 12 && end < 12);
    if (!isValidRange) {
      toast.error('Invalid time range');
      return;
    }

    // Update only the temporary state
    setAvailableHours(availableHours.map(period => 
      period.id === periodId 
        ? { ...period, tempStart: start, tempEnd: end }
        : period
    ));
  };

  const handleDayToggle = (periodId: string, day: keyof AvailableHourPeriod['days']) => {
    setAvailableHours(availableHours.map(period => 
      period.id === periodId 
        ? { 
            ...period, 
            days: {
              ...period.days,
              [day]: !period.days?.[day]
            }
          }
        : period
    ));
  };

  const handleSaveChanges = async (periodId: string) => {
    const period = availableHours.find(p => p.id === periodId);
    if (!period?.tempStart || !period?.tempEnd) return;

    const updatedPeriods = availableHours.map(p => 
      p.id === periodId 
        ? { 
            id: p.id,
            start: p.tempStart!,
            end: p.tempEnd!,
            days: p.days,
            tempStart: undefined,
            tempEnd: undefined
          }
        : p
    );
    setAvailableHours(updatedPeriods);

    try {
      await updateDoc(settingsRef, {
        'notification.preferences.availableHours.periods': updatedPeriods.map(({ start, end, days }) => ({
          start,
          end,
          days
        }))
      });
      toast.success('Available hours updated');
    } catch (error) {
      console.error('Error updating available hours:', error);
      toast.error('Failed to update available hours');
    }
  };

  const handleAddPeriod = () => {
    const newPeriod: AvailableHourPeriod = {
      id: `period-${availableHours.length}`,
      start: 9,
      end: 17,
      days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }
    };
    setAvailableHours([...availableHours, newPeriod]);
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (availableHours.length <= 1) {
      toast.error('Cannot delete the last available hours period');
      return;
    }

    const updatedPeriods = availableHours.filter(period => period.id !== periodId);
    setAvailableHours(updatedPeriods);

    try {
      await updateDoc(settingsRef, {
        'notification.preferences.availableHours.periods': updatedPeriods.map(({ start, end }) => ({
          start,
          end
        }))
      });
      toast.success('Available hours period deleted');
    } catch (error) {
      console.error('Error deleting available hours period:', error);
      toast.error('Failed to delete available hours period');
    }
  };

  const getPeriodDuration = (period: AvailableHourPeriod) => {
    if (period.end > period.start) {
      return period.end - period.start;
    }
    return (24 - period.start) + period.end;
  };

  const renderTimeSelector = (period: AvailableHourPeriod) => {
    const start = period.tempStart ?? period.start;
    const end = period.tempEnd ?? period.end;
    const hasUnsavedChanges = period.tempStart !== undefined || period.tempEnd !== undefined;
    
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {formatTime(start, locale)} - {formatTime(end, locale)}
            </Typography>
            <Typography variant="caption" color="success.main">
              ({getPeriodDuration({ ...period, start, end })}h)
            </Typography>
          </Box>
          {hasUnsavedChanges && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => handleSaveChanges(period.id)}
              disabled={!notificationsEnabled}
            >
              Save Changes
            </Button>
          )}
        </Box>
        <Box sx={{ px: 2 }}>
          <Slider
            value={[start, end]}
            onChange={(_, newValue) => handleSliderChange(period.id, newValue)}
            min={0}
            max={24}
            step={1}
            disabled={!notificationsEnabled}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => formatTime(value, locale)}
            marks={[
              { value: 0, label: '00:00' },
              { value: 6, label: '06:00' },
              { value: 12, label: '12:00' },
              { value: 18, label: '18:00' },
              { value: 24, label: '24:00' },
            ]}
            sx={{
              '& .MuiSlider-markLabel': {
                fontSize: '0.75rem',
                color: 'text.secondary',
              },
              '& .MuiSlider-mark': {
                backgroundColor: 'background.paper',
                '&.MuiSlider-markActive': {
                  backgroundColor: 'background.paper',
                },
              },
              '& .MuiSlider-rail': {
                height: 4,
                borderRadius: 2,
              },
              '& .MuiSlider-track': {
                height: 4,
                borderRadius: 2,
              },
              '& .MuiSlider-thumb': {
                height: 16,
                width: 16,
                backgroundColor: 'background.paper',
                border: '2px solid currentColor',
                '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                  boxShadow: 'inherit',
                },
                '&:before': {
                  display: 'none',
                },
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
            <FormControlLabel
              key={day}
              control={
                <Switch
                  size="small"
                  checked={period.days?.[day as keyof AvailableHourPeriod['days']] ?? false}
                  onChange={() => handleDayToggle(period.id, day as keyof AvailableHourPeriod['days'])}
                  disabled={!notificationsEnabled}
                />
              }
              label={day.charAt(0).toUpperCase() + day.slice(1)}
              sx={{ m: 0 }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  const handleNotificationToggle = async () => {
    try {
      await updateDoc(settingsRef, {
        'notification.preferences.enabled': !notificationsEnabled
      });
      setNotificationsEnabled(!notificationsEnabled);
      toast.success('Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update notification settings');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Stack spacing={6} flexGrow={1} sx={{p: 1, mt: 2}}>
                <Block title="Notification Settings">
                  <Card sx={{ p: 2 }}>
                    <Stack spacing={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notificationsEnabled}
                            onChange={handleNotificationToggle}
                            color="primary"
                          />
                        }
                        label="Enable Notifications"
                      />

                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle2">
                            Available Hours
                          </Typography>
                          <Button
                            startIcon={<AddIcon />}
                            onClick={handleAddPeriod}
                            disabled={!notificationsEnabled}
                            size="small"
                          >
                            Add Hours
                          </Button>
                        </Box>

                        {availableHours.map((period) => (
                          <Box key={period.id} sx={{ mb: 4 }}>
                            {availableHours.length > 1 && (
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeletePeriod(period.id)}
                                  disabled={!notificationsEnabled}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            )}
                            {renderTimeSelector(period)}
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  </Card>
                </Block>

                <Block title="Privacy Settings">
                  <Card sx={{ p: 2 }}>
                    <Stack spacing={3}>
                      <FormControlLabel
                        control={<Switch color="primary" />}
                        label="Show Profile to Others"
                      />
                      <FormControlLabel
                        control={<Switch color="primary" />}
                        label="Allow Match Suggestions"
                      />
                    </Stack>
                  </Card>
                </Block>
              </Stack>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}