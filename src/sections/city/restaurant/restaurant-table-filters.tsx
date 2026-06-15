import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { RESTAURANT_CATEGORY_OPTIONS } from '../constants';

// ----------------------------------------------------------------------

type RestaurantTableFiltersProps = {
  filters: {
    category: string[];
    status: string;
  };
  onFilters: (name: string, value: string | string[]) => void;
  onResetFilters: () => void;
  results: number;
};

export default function RestaurantTableFilters({
  filters,
  onFilters,
  onResetFilters,
  results,
}: RestaurantTableFiltersProps) {
  const handleFilterStatus = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilters('status', event.target.value);
  };

  const handleFilterCategory = (category: string) => {
    const checked = filters.category.includes(category)
      ? filters.category.filter((value) => value !== category)
      : [...filters.category, category];

    onFilters('category', checked);
  };

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Status</Typography>
        <TextField
          select
          fullWidth
          value={filters.status}
          onChange={handleFilterStatus}
          SelectProps={{
            MenuProps: {
              PaperProps: {
                sx: { maxHeight: 220 },
              },
            },
          }}
        >
          {[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ].map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Category</Typography>
        <FormGroup>
          {RESTAURANT_CATEGORY_OPTIONS.map((category) => (
            <FormControlLabel
              key={category}
              control={
                <Checkbox
                  checked={filters.category.includes(category)}
                  onClick={() => handleFilterCategory(category)}
                />
              }
              label={category}
            />
          ))}
        </FormGroup>
      </Stack>

      <Button
        variant="text"
        color="primary"
        onClick={onResetFilters}
        sx={{ justifyContent: 'flex-start', px: 0 }}
      >
        Clear Filters
      </Button>

      <Stack direction="row" alignItems="center" justifyContent="flex-end">
        <Badge
          showZero
          color="primary"
          badgeContent={results}
          sx={{ typography: 'body2' }}
        />
        <Typography variant="subtitle2" sx={{ ml: 0.5 }}>
          Results
        </Typography>
      </Stack>
    </Stack>
  );
} 