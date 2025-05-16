import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

// ----------------------------------------------------------------------

type Props = {
  sort: string;
  onSort: (value: string) => void;
  sortOptions?: {
    value: string;
    label: string;
  }[];
};

export function HijraSort({ sort, onSort, sortOptions = [] }: Props) {
  // Default options if none provided
  const defaultOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'popular', label: 'Popular' }
  ];
  
  const options = sortOptions.length ? sortOptions : defaultOptions;

  return (
    <TextField
      select
      size="small"
      value={sort}
      onChange={(event) => onSort(event.target.value)}
      sx={{
        minWidth: 120,
        ...(sort === 'latest' && {
          '& .MuiSelect-select': {
            typography: 'subtitle2',
          },
        }),
      }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          sx={{
            mx: 1,
            my: 0.5,
            borderRadius: 0.75,
            typography: 'body2',
          }}
        >
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
} 