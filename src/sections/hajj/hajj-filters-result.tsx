import type { IHajjFilters, IHajjGuide } from '@livve-1/database-types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';

import { fDate } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  filters: IHajjFilters;
  results?: number;
  totalResults?: number; // For backward compatibility
  onResetFilters?: () => void;
  onFilters?: (name: string, value: any) => void;
  sx?: any;
  canReset?: boolean;
};

export function HajjFiltersResult({ 
  filters, 
  totalResults, 
  results, 
  onResetFilters, 
  onFilters,
  sx,
  canReset
}: Props) {
  const resultCount = results || totalResults || 0;
  
  const handleRemoveServices = (item: string) => {
    if (onFilters) {
      const newServices = filters.services.filter((service) => service !== item);
      onFilters('services', newServices);
    } else if (onResetFilters) {
      onResetFilters();
    }
  };

  const handleRemoveDestination = (item: string) => {
    if (onFilters) {
      const newDestination = filters.destination.filter((destination) => destination !== item);
      onFilters('destination', newDestination);
    } else if (onResetFilters) {
      onResetFilters();
    }
  };

  const handleRemoveGuide = (item: string) => {
    if (onFilters) {
      const newGuides = filters.guides.filter((guide) => guide.name !== item);
      onFilters('guides', newGuides);
    } else if (onResetFilters) {
      onResetFilters();
    }
  };
  
  const handleRemoveType = (item: string) => {
    if (onFilters) {
      const newTypes = filters.type.filter((type) => type !== item);
      onFilters('type', newTypes);
    } else if (onResetFilters) {
      onResetFilters();
    }
  };

  return (
    <Stack spacing={1.5} sx={{ mb: 3, ...sx }}>
      <Box sx={{ typography: 'body2' }}>
        <strong>{resultCount}</strong>
        <Box component="span" sx={{ color: 'text.secondary', ml: 0.25 }}>
          results found
        </Box>
      </Box>

      <Stack
        flexGrow={1}
        spacing={1}
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        sx={{
          ...(filters.services.length ||
          filters.destination.length ||
          filters.guides.length ||
          filters.type.length ||
          filters.startDate ||
          filters.endDate
            ? { bgcolor: 'background.paper' }
            : { bgcolor: 'transparent' }),
        }}
      >
        {filters.type.map((item) => (
          <Block key={item} label="Package Type:">
            <Chip
              size="small"
              label={item}
              color={
                item === 'Hajj' 
                  ? 'primary' 
                  : item === 'Umra' 
                    ? 'info' 
                    : 'warning'
              }
              onDelete={() => handleRemoveType(item)}
              sx={{ m: 0.5 }}
            />
          </Block>
        ))}
        
        {filters.services.map((item) => (
          <Block key={item} label="Service:">
            <Chip
              size="small"
              label={item}
              onDelete={() => handleRemoveServices(item)}
              sx={{ m: 0.5 }}
            />
          </Block>
        ))}

        {filters.destination.map((item) => (
          <Block key={item} label="Destination:">
            <Chip
              size="small"
              label={item}
              onDelete={() => handleRemoveDestination(item)}
              sx={{ m: 0.5 }}
            />
          </Block>
        ))}

        {filters.guides.map((item) => (
          <Block key={item.id} label="Guide:">
            <Chip
              size="small"
              label={item.name}
              onDelete={() => handleRemoveGuide(item.name)}
              sx={{ m: 0.5 }}
            />
          </Block>
        ))}

        {filters.startDate && (
          <Block label="Available from:">
            <Chip
              size="small"
              label={fDate(filters.startDate)}
              onDelete={() => onFilters ? onFilters('startDate', null) : onResetFilters && onResetFilters()}
              sx={{ m: 0.5 }}
            />
          </Block>
        )}

        {filters.endDate && (
          <Block label="Available to:">
            <Chip
              size="small"
              label={fDate(filters.endDate)}
              onDelete={() => onFilters ? onFilters('endDate', null) : onResetFilters && onResetFilters()}
              sx={{ m: 0.5 }}
            />
          </Block>
        )}

        {(filters.services.length ||
          filters.destination.length ||
          filters.guides.length ||
          filters.type.length ||
          filters.startDate ||
          filters.endDate) && (
          <Button
            variant="outlined"
            color="inherit"
            onClick={onResetFilters}
            startIcon={<Iconify icon="mingcute:refresh-line" />}
          >
            Clear
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type BlockProps = {
  label: string;
  children: React.ReactNode;
};

function Block({ label, children }: BlockProps) {
  return (
    <Stack
      spacing={1}
      direction="row"
      alignItems="center"
      sx={{
        py: 0.75,
        borderRadius: 1,
        px: 1,
        bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
      }}
    >
      <Box component="span" sx={{ typography: 'body2' }}>
        {label}
      </Box>

      {children}
    </Stack>
  );
} 