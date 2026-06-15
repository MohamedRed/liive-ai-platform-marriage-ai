import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { useResponsive } from 'src/hooks/use-responsive';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  search: string;
  onSearch: (value: string) => void;
  sx?: any;
};

export function HajjSearch({ search, onSearch, sx }: Props) {
  const lgUp = useResponsive('up', 'lg');

  return (
    <TextField
      value={search}
      onChange={(event) => onSearch(event.target.value)}
      placeholder="Search package..."
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        ),
      }}
      sx={{
        width: { xs: 1, sm: 260 },
        ...sx,
      }}
    />
  );
} 