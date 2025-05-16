import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type GroupLabelProps = {
  children: React.ReactNode;
};

export function GroupLabel({ children }: GroupLabelProps) {
  return (
    <Typography
      component="div"
      variant="overline"
      sx={{
        px: 2.5,
        py: 1,
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

// ----------------------------------------------------------------------

type MoreButtonProps = {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function MoreButton({ onClick }: MoreButtonProps) {
  return (
    <IconButton
      onClick={onClick}
      sx={{
        p: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: (theme) => theme.palette.text.secondary,
        '&:hover': {
          color: (theme) => theme.palette.text.primary,
        },
      }}
    >
      <Box
        component="img"
        src="/assets/icons/setting/dots-horizontal.svg"
        sx={{ width: 16, height: 16 }}
      />
    </IconButton>
  );
}

// ----------------------------------------------------------------------

type SearchBoxProps = {
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  value?: string;
  sx?: object;
};

export function SearchBox({ placeholder, onChange, value, sx }: SearchBoxProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        px: 2,
        height: 48,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
        '&:hover': {
          bgcolor: (theme) => alpha(theme.palette.grey[500], 0.16),
        },
        ...sx,
      }}
    >
      <Box component="img" src="/assets/icons/search.svg" sx={{ width: 20, height: 20 }} />

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={placeholder}
        style={{
          border: 0,
          outline: 'none',
          width: '100%',
          height: '100%',
          background: 'transparent',
          padding: '0 8px',
        }}
      />
    </Stack>
  );
}
