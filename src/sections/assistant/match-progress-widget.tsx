import { useEffect, useState } from 'react';
import type { CardProps } from '@mui/material/Card';
import type { ChartOptions } from 'src/components/chart';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';

import { fNumber, fPercent } from 'src/utils/format-number';
import { varAlpha, stylesMode } from 'src/theme/styles';
import { Iconify } from 'src/components/iconify';
import { Chart, useChart } from 'src/components/chart';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title: string;
  total: number;
  percent: number;
  chart: {
    colors?: string[];
    categories: string[];
    series: number[];
    options?: ChartOptions;
  };
};

export function MatchProgressWidget({ title, percent, total, chart, sx, ...other }: Props) {
  const theme = useTheme();
  const [displayTotal, setDisplayTotal] = useState(0);
  const [chartData, setChartData] = useState<number[]>(chart.series);
  const chartColors = chart.colors ?? [theme.palette.primary.light, theme.palette.primary.main];

  // Keep only the counter animation
  useEffect(() => {
    if (total > displayTotal) {
      const interval = setInterval(() => {
        setDisplayTotal(prev => {
          const next = prev + 1;
          if (next >= total) {
            clearInterval(interval);
            return total;
          }
          return next;
        });
      }, 10);
      return () => clearInterval(interval);
    }
  }, [total, displayTotal]);

  // Update chart data when total changes
  useEffect(() => {
    setChartData(prev => [...prev.slice(0, -1), displayTotal]);
  }, [displayTotal]);

  const chartOptions = useChart({
    // Start with parent options
    ...chart.options,
    
    // Explicitly set animations first
    chart: {
      animations: {
        enabled: true,
        speed: 800,
        animateGradually: { 
          enabled: true,
          delay: 150 
        }
      },
      sparkline: { enabled: true },
    },
    
    // Then other configs
    colors: [chartColors[1]],
    xaxis: { categories: chart.categories },
    grid: { padding: { top: 6, left: 6, right: 6, bottom: 6 } },
    fill: {
      type: 'gradient',
      gradient: {
        colorStops: [
          { offset: 0, color: chartColors[0], opacity: 1 },
          { offset: 100, color: chartColors[1], opacity: 1 },
        ],
      },
    },
    tooltip: {
      y: { formatter: (value: number) => fPercent(value / 100), title: { formatter: () => '' } },
    },
  });

  const renderTrending = (
    <Box sx={{ gap: 0.5, display: 'flex', alignItems: 'center' }}>
      <Box
        component="span"
        sx={{
          width: 24,
          height: 24,
          display: 'flex',
          borderRadius: '50%',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: varAlpha(theme.vars.palette.success.mainChannel, 0.16),
          color: 'success.dark',
          [stylesMode.dark]: { color: 'success.light' },
          ...(percent < 0 && {
            bgcolor: varAlpha(theme.vars.palette.error.mainChannel, 0.16),
            color: 'error.dark',
            [stylesMode.dark]: { color: 'error.light' },
          }),
        }}
      >
        <Iconify
          width={16}
          icon={percent < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'}
        />
      </Box>

      <Box component="span" sx={{ typography: 'subtitle2' }}>
        {percent > 0 && '+'}
        {fPercent(percent)}
      </Box>
      <Box component="span" sx={{ color: 'text.secondary', typography: 'body2' }}>
        last match
      </Box>
    </Box>
  );

  return (
    <Card
      sx={{
        p: 3,
        display: 'flex',
        alignItems: 'center',
        ...sx,
      }}
      {...other}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ typography: 'subtitle2' }}>{title}</Box>
        <Box sx={{ my: 1.5, typography: 'h3' }}>
          {fPercent(displayTotal / 100)}
        </Box>
        {renderTrending}
      </Box>

      <Chart
        type="line"
        series={[{ data: chartData }]}
        options={chartOptions}
        width={100}
        height={66}
      />
    </Card>
  );
} 