import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SxProps, Theme, alpha } from '@mui/material/styles';

// ----------------------------------------------------------------------

interface CityWidgetSummaryProps {
  title: string;
  total: number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  sx?: SxProps<Theme>;
}

export function CityWidgetSummary({
  title,
  total,
  icon,
  color = 'primary',
  sx,
  ...other
}: CityWidgetSummaryProps) {
  return (
    <Card
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3,
        ...sx,
      }}
      {...other}
    >
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'text.disabled' }}>
          {title}
        </Typography>

        <Typography variant="h3" sx={{ mt: 1, mb: 1 }}>
          {total}
        </Typography>
      </Box>

      <Box
        sx={{
          width: 120,
          height: 120,
          display: 'flex',
          borderRadius: '50%',
          alignItems: 'center',
          justifyContent: 'center',
          color: `${color}.main`,
          bgcolor: (theme) => alpha(theme.palette[color].main, 0.08),
        }}
      >
        {icon}
      </Box>
    </Card>
  );
} 