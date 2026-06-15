import { useResponsive } from 'src/hooks/use-responsive';

import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import { styled, useTheme, Theme } from '@mui/material/styles';

// ----------------------------------------------------------------------

const SPACING = 8;

type StyledRootProps = {
  theme: Theme;
  collapsed: {
    nav: boolean;
    details: boolean;
  };
};

const StyledRoot = styled('div')(({ theme, collapsed }: StyledRootProps) => ({
  display: 'flex',
  overflow: 'hidden',
  flexDirection: 'column',
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    height: '100%',
  },
  '& .nav': {
    width: collapsed.nav ? 0 : 320,
    minWidth: 0,
    borderRight: `solid 1px ${theme.palette.divider}`,
    transition: theme.transitions.create(['width'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
  '& .details': {
    width: collapsed.details ? 0 : 320,
    minWidth: 0,
    borderLeft: `solid 1px ${theme.palette.divider}`,
    transition: theme.transitions.create(['width'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
}));

// ----------------------------------------------------------------------

type LayoutProps = {
  sx?: object;
  slots: {
    header?: React.ReactNode;
    nav?: React.ReactNode;
    main?: React.ReactNode;
    details?: React.ReactNode;
  };
};

export function Layout({ sx, slots }: LayoutProps) {
  const mdUp = useResponsive('up', 'md');

  const theme = useTheme();

  const collapsed = {
    nav: slots.header && !mdUp ? true : false,
    details: !slots.details,
  };

  return (
    <StyledRoot theme={theme} collapsed={collapsed} sx={sx}>
      {slots.nav && <div className="nav">{slots.nav}</div>}

      <Stack sx={{ flexGrow: 1, height: 1, overflow: 'hidden' }}>
        {slots.header && <div>{slots.header}</div>}

        <Stack
          direction="row"
          component={!mdUp ? Container : 'div'}
          sx={{
            pt: slots.header ? 0 : SPACING,
            height: 1,
            ...(mdUp && {
              px: SPACING,
              flexGrow: 1,
              minHeight: 0,
            }),
          }}
        >
          {slots.main && (
            <Stack sx={{ position: 'relative', flexGrow: 1, minHeight: 0 }}>
              {slots.main}
            </Stack>
          )}
        </Stack>
      </Stack>

      {slots.details && <div className="details">{slots.details}</div>}
    </StyledRoot>
  );
}
