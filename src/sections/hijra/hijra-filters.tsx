import { useCallback } from 'react';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { useResponsive } from 'src/hooks/use-responsive';

import { Iconify } from 'src/components/iconify';
import { CustomPopover, usePopover } from 'src/components/custom-popover';

import type { IHijraFilters, IHijraGuide } from '@livve-1/database-types';
import type { IDatePickerControl } from 'src/types/common';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  canReset?: boolean;
  dateError?: boolean;
  filters: IHijraFilters;
  options?: {
    services: string[];
    guides: IHijraGuide[];
  };
  serviceOptions?: string[];
  onFilters: (name: string, value: any) => void;
  onResetFilters?: () => void;
};

export function HijraFilters({
  open,
  onOpen,
  onClose,
  canReset,
  dateError,
  filters,
  options,
  serviceOptions = [],
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
    (value: IHijraGuide[]) => {
      onFilters('guides', value);
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
    <>
      <Stack spacing={2.5} sx={{ py: 3 }}>
        <Autocomplete
          multiple
          options={options?.services || []}
          getOptionLabel={(option) => option}
          value={filters.services}
          onChange={(event, options) => handleFilterServices(options)}
          renderInput={(params) => <TextField {...params} label="Services" />}
        />

        <Autocomplete
          multiple
          options={options?.guides || []}
          getOptionLabel={(option) => option.name}
          value={filters.guides}
          onChange={(event, options) => handleFilterGuides(options)}
          renderInput={(params) => <TextField {...params} label="Guides" />}
          renderOption={(props, option) => (
            <Stack component="li" {...props} direction="row" alignItems="center" spacing={1}>
              <Box
                component="img"
                sx={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  border: '1px solid',
                  borderRadius: '50%',
                  borderColor: 'divider',
                  objectFit: 'cover',
                }}
                src={option.avatarUrl}
                alt={option.name}
              />
              {option.name}
            </Stack>
          )}
        />

        <Stack spacing={2.5}>
          <Typography variant="subtitle2">Available</Typography>

          <TextField
            fullWidth
            label="Start date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.startDate ? filters.startDate.format('YYYY-MM-DD') : ''}
            onChange={(e) => {
              const date = e.target.value ? dayjs(e.target.value) : null;
              handleFilterStartDate(date);
            }}
            error={dateError}
          />

          <TextField
            fullWidth
            label="End date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.endDate ? filters.endDate.format('YYYY-MM-DD') : ''}
            onChange={(e) => {
              const date = e.target.value ? dayjs(e.target.value) : null;
              handleFilterEndDate(date);
            }}
            error={dateError}
          />
        </Stack>
      </Stack>

      <Stack spacing={1.5} sx={{ py: 2 }}>
        <Button variant="contained" color="inherit" onClick={onClose}>
          Apply
        </Button>

        <Button
          variant="soft"
          color="inherit"
          disabled={!canReset}
          onClick={() => {
            onFilters('services', []);
            onFilters('destination', []);
            onFilters('guides', []);
            onFilters('startDate', null);
            onFilters('endDate', null);
          }}
        >
          Clear
        </Button>
      </Stack>
    </>
  );

  return (
    <>
      <Button
        variant="soft"
        color="inherit"
        startIcon={<Iconify icon="solar:settings-linear" />}
        onClick={onOpen}
      >
        Filters
      </Button>

      {mdUp ? (
        <Drawer
          anchor="right"
          open={open}
          onClose={onClose}
          slotProps={{
            backdrop: { invisible: true },
          }}
          PaperProps={{
            sx: {
              width: 280,
              p: 3,
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              ...(!open && { transform: 'translateX(100%)' }),
            },
          }}
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 3,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Filters</Typography>

            <IconButton onClick={onClose}>
              <Iconify icon="mingcute:close-line" />
            </IconButton>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          {renderContent}
        </Drawer>
      ) : (
        <CustomPopover
          open={popover.open}
          anchorEl={popover.anchorEl}
          onClose={popover.onClose}
          sx={{
            p: 3,
            boxShadow: (theme) => theme.customShadows.z24,
          }}
        >
          {renderContent}
        </CustomPopover>
      )}
    </>
  );
} 