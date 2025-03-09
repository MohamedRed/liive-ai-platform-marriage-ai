import type { StackProps } from '@mui/material/Stack';
import { Box } from '@mui/material';

import Stack from '@mui/material/Stack';

// ----------------------------------------------------------------------

type Props = StackProps & {
  slots: {
    main: React.ReactNode;
  };
};

export function Layout({ slots, sx }: Props) {
  return (
    <Box
      sx={{
        ...sx,
        width: '100%',
        maxWidth: { sm: 600 }, // Keep mobile-like width on all screens
        mx: 'auto', // Center the layout
      }}
    >
      {slots.main}
    </Box>
  );
}
