import { useCallback } from 'react';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { useResponsive } from 'src/hooks/use-responsive';

import { Iconify } from 'src/components/iconify';
import { CustomPopover, usePopover } from 'src/components/custom-popover';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import type { IHajjFilters, IHajjGuide } from '@livve-1/database-types';
import type { IDatePickerControl } from 'src/types/common';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  canReset?: boolean;
  dateError?: boolean;
  filters: IHajjFilters;
  options?: {
    services: string[];
    guides: IHajjGuide[];
  };
  serviceOptions?: string[];
  packageTypes?: string[];
  onFilters: (name: string, value: any) => void;
  onResetFilters?: () => void;
};

export function HajjFilters({
  open,
  onOpen,
  onClose,
  canReset,
  dateError,
  filters,
  options,
  serviceOptions = [],
  packageTypes = ['Hajj', 'Umra', 'Hajj & Umra'],
  onFilters,
  onResetFilters,
}: Props) {
  const popover = usePopover();

  const mdUp = useResponsive('up', 'md');

  const handleFilterServices = useCallback(
    (newValue: string[]) => {
      onFilters('services', newValue);
    },
    [onFilters]
  );

  const handleFilterDestination = useCallback(
    (value: string[]) => {
      onFilters('destination', value);
    },
    [onFilters]
  );

  const handleFilterGuides = useCallback(
    (value: IHajjGuide[]) => {
      onFilters('guides', value);
    },
    [onFilters]
  );

  const handleFilterPackageType = useCallback(
    (value: string[]) => {
      onFilters('type', value);
    },
    [onFilters]
  );

  const handleFilterStartDate = useCallback(
    (value: IDatePickerControl) => {
      onFilters('startDate', value);
    },
    [onFilters]
  );

  const handleFilterEndDate = useCallback(
    (value: IDatePickerControl) => {
      onFilters('endDate', value);
    },
    [onFilters]
  );

  const renderContent = (
    <Stack
      spacing={2.5}
      sx={{
        flexShrink: 0,
        width: { xs: 1, md: 280 },
      }}
    >
      <Stack spacing={3} sx={{ p: 2.5 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Package Type</Typography>
          <Autocomplete
            multiple
            options={packageTypes}
            getOptionLabel={(option) => option}
            value={filters.type}
            onChange={(event, newValue: string[]) => handleFilterPackageType(newValue)}
            renderInput={(params) => <TextField {...params} placeholder="Select Package Type" />}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {option}
              </li>
            )}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={option}
                  size="small"
                  color={
                    option === 'Hajj' 
                      ? 'primary' 
                      : option === 'Umra' 
                        ? 'info' 
                        : 'warning'
                  }
                  variant="soft"
                />
              ))
            }
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Services</Typography>
          <Autocomplete
            multiple
            options={options?.services || serviceOptions}
            getOptionLabel={(option) => option}
            value={filters.services}
            onChange={(event, newValue: string[]) => handleFilterServices(newValue)}
            renderInput={(params) => <TextField {...params} placeholder="Select Services" />}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {option}
              </li>
            )}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Destination</Typography>
          <Autocomplete
            multiple
            options={['Saudi Arabia', 'United Arab Emirates', 'Egypt', 'Jordan', 'Turkey']}
            getOptionLabel={(option) => option}
            value={filters.destination}
            onChange={(event, newValue) => handleFilterDestination(newValue)}
            renderInput={(params) => <TextField {...params} placeholder="Select Destination" />}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {option}
              </li>
            )}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Guides</Typography>
          <Autocomplete
            multiple
            options={options?.guides || []}
            getOptionLabel={(option) => option.name}
            value={filters.guides}
            onChange={(event, newValue) => handleFilterGuides(newValue)}
            renderInput={(params) => <TextField {...params} placeholder="Select Guides" />}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.name}
              </li>
            )}
          />
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Available From</Typography>
          <DatePicker
            value={filters.startDate}
            onChange={(newValue) => handleFilterStartDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: dateError,
              },
            }}
          />
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Available To</Typography>
          <DatePicker
            value={filters.endDate}
            onChange={(newValue) => handleFilterEndDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: dateError,
              },
            }}
          />
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Button
            variant="outlined"
            color="inherit"
            onClick={onResetFilters}
            startIcon={<Iconify icon="mingcute:refresh-line" />}
          >
            Clear
          </Button>

          <Button
            variant="soft"
            onClick={onClose}
            startIcon={<Iconify icon="mingcute:check-fill" />}
          >
            Apply
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );

  return (
    <>
      <Button
        disableRipple
        color="inherit"
        endIcon={<Iconify icon="mingcute:filter-line" />}
        onClick={onOpen}
      >
        Filters
      </Button>

      {mdUp ? (
        <Drawer
          anchor="right"
          open={open}
          onClose={onClose}
          BackdropProps={{
            invisible: true,
          }}
          PaperProps={{
            sx: {
              width: 280,
              border: 'none',
              overflow: 'hidden',
              boxShadow: (theme) => theme.customShadows.z24,
            },
          }}
        >
          {renderContent}
        </Drawer>
      ) : (
        <CustomPopover
          open={open}
          onClose={onClose}
          sx={{
            p: 0,
            mt: 1.5,
            ml: -1,
            width: 1,
            maxWidth: 360,
          }}
        >
          {renderContent}
        </CustomPopover>
      )}
    </>
  );
} 