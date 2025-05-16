import { useCallback } from 'react';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';
import { CustomPopover, usePopover } from 'src/components/custom-popover';
import { Button } from '@mui/material';

// ----------------------------------------------------------------------

const TRANSIT_TYPE_OPTIONS = ['bus', 'tram', 'subway', 'train'];

const TRANSIT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'operational', label: 'Operational' },
  { value: 'limited', label: 'Limited Service' },
  { value: 'closed', label: 'Closed' },
];

// ----------------------------------------------------------------------

type TransitRouteToolbarProps = {
  filters: {
    name: string;
    type: string[];
    status: string;
  };
  onFilters: (name: string, value: string | string[]) => void;
};

export default function TransitRouteToolbar({
  filters,
  onFilters,
}: TransitRouteToolbarProps) {
  const popover = usePopover();

  const handleFilterName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFilters('name', event.target.value);
    },
    [onFilters]
  );

  const handleFilterStatus = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFilters('status', event.target.value);
    },
    [onFilters]
  );

  const handleFilterType = useCallback(
    (type: string) => {
      const checked = filters.type.includes(type)
        ? filters.type.filter((value) => value !== type)
        : [...filters.type, type];

      onFilters('type', checked);
    },
    [filters.type, onFilters]
  );

  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: 'flex-end', md: 'center' }}
        direction={{
          xs: 'column',
          md: 'row',
        }}
        sx={{
          px: 2.5,
          py: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
          <TextField
            fullWidth
            value={filters.name}
            onChange={handleFilterName}
            placeholder="Search route..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            color="inherit"
            sx={{ px: 1 }}
            onClick={popover.onOpen}
            endIcon={<Iconify icon="eva:more-vertical-fill" />}
          >
            Types
          </Button>

          <TextField
            select
            size="small"
            value={filters.status}
            onChange={handleFilterStatus}
            label="Status"
            sx={{
              minWidth: 120,
            }}
          >
            {TRANSIT_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        sx={{ width: 160 }}
      >
        <FormGroup sx={{ p: 1.5 }}>
          {TRANSIT_TYPE_OPTIONS.map((type) => (
            <FormControlLabel
              key={type}
              control={
                <Checkbox
                  checked={filters.type.includes(type)}
                  onClick={() => handleFilterType(type)}
                />
              }
              label={type}
            />
          ))}
        </FormGroup>
      </CustomPopover>
    </>
  );
} 