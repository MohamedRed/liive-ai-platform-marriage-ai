import type { CardProps } from '@mui/material/Card';
import type { ColorType } from 'src/theme/core/palette';

import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';

import { CONFIG } from 'src/config-global';
import { varAlpha, bgGradient } from 'src/theme/styles';

import { SvgColor } from 'src/components/svg-color';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title: string;
  color?: ColorType;
  navigateTo?: string;
  description?: string;
};

export function LiiveDomainCard({
  title,
  color = 'primary',
  navigateTo,
  description,
  sx,
  ...other
}: Props) {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleClick = () => {
    if (navigateTo) {
      navigate(navigateTo);
    }
  };

  const isClickable = !!navigateTo;

  return (
    <Card
      sx={{
        ...bgGradient({
          color: `135deg, ${varAlpha(theme.vars.palette[color].lighterChannel, 0.48)}, ${varAlpha(theme.vars.palette[color].lightChannel, 0.48)}`,
        }),
        p: { xs: 2, sm: 3 },
        boxShadow: 'none',
        position: 'relative',
        color: `${color}.darker`,
        backgroundColor: 'common.white',
        height: { xs: '160px', sm: '140px', md: '160px' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': isClickable ? {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[4],
        } : {},
        ...sx,
      }}
      onClick={handleClick}
      {...other}
    >
      <Box sx={{ position: 'relative' }}>
        <Typography 
          variant="h6"
          sx={{ 
            fontSize: { xs: '0.9rem', sm: '1.1rem' },
            fontWeight: 'bold'
          }}
        >
          {title}
        </Typography>
        
        {description && (
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              mt: 0.5,
              color: 'text.secondary',
              opacity: 0.8
            }}
          >
            {description}
          </Typography>
        )}
        
        {isClickable ? (
          <Box 
            sx={{ 
              mt: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              opacity: 0.7 
            }}
          >
            <Iconify icon="eva:arrow-forward-fill" width={16} sx={{ mr: 0.5 }} />
            <Typography variant="caption">Enter</Typography>
          </Box>
        ) : (
          <Box 
            sx={{ 
              mt: 1,
              py: 0.5,
              px: 1,
              borderRadius: 1,
              display: 'inline-flex',
              bgcolor: 'action.selected',
              color: 'text.secondary'
            }}
          >
            <Typography variant="caption" fontWeight="bold">Coming Soon</Typography>
          </Box>
        )}
      </Box>

      <SvgColor
        src={`${CONFIG.site.basePath}/assets/background/shape-square.svg`}
        sx={{
          top: 0,
          left: -20,
          width: { xs: 120, sm: 240 },
          zIndex: -1,
          height: { xs: 120, sm: 240 },
          opacity: 0.24,
          position: 'absolute',
          color: `${color}.main`,
        }}
      />
    </Card>
  );
} 