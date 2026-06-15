import type { IHajjItem } from '@livve-1/database-types';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { fDateTime, fDateRangeShortLabel } from 'src/utils/format-time';

import { Image } from 'src/components/image';
import { Iconify } from 'src/components/iconify';
import { usePopover, CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

type Props = {
  package: IHajjItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function HajjItem({ package: hajjPackage, onView, onEdit, onDelete }: Props) {
  const popover = usePopover();

  const renderRating = (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        top: 8,
        right: 8,
        zIndex: 9,
        borderRadius: 1,
        position: 'absolute',
        p: '2px 6px 2px 4px',
        typography: 'subtitle2',
        bgcolor: 'success.lighter',
      }}
    >
      <Iconify icon="eva:star-fill" sx={{ color: 'success.main', mr: 0.25 }} /> {hajjPackage.ratingNumber}
    </Stack>
  );

  const renderPrice = (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        top: 8,
        left: 8,
        zIndex: 9,
        borderRadius: 1,
        bgcolor: 'grey.800',
        position: 'absolute',
        p: '2px 6px 2px 4px',
        color: 'common.white',
        typography: 'subtitle2',
      }}
    >
      {!!hajjPackage.priceSale && (
        <Box component="span" sx={{ color: 'grey.500', mr: 0.25, textDecoration: 'line-through' }}>
          {fCurrency(hajjPackage.priceSale)}
        </Box>
      )}
      {fCurrency(hajjPackage.price)}
    </Stack>
  );

  const renderImages = (
    <Box gap={0.5} display="flex" sx={{ p: 1 }}>
      <Box flexGrow={1} sx={{ position: 'relative' }}>
        {renderPrice}
        {renderRating}
        <Image
          alt={hajjPackage.images[0]}
          src={hajjPackage.images[0]}
          sx={{ width: 1, height: 164, borderRadius: 1 }}
        />
      </Box>

      <Box gap={0.5} display="flex" flexDirection="column">
        <Image
          alt={hajjPackage.images[1]}
          src={hajjPackage.images[1]}
          ratio="1/1"
          sx={{ borderRadius: 1, width: 80, height: 80 }}
        />
        <Image
          alt={hajjPackage.images[2]}
          src={hajjPackage.images[2]}
          ratio="1/1"
          sx={{ borderRadius: 1, width: 80, height: 80 }}
        />
      </Box>
    </Box>
  );

  const renderTexts = (
    <ListItemText
      sx={{ p: (theme) => theme.spacing(2.5, 2.5, 2, 2.5) }}
      primary={`Posted date: ${fDateTime(hajjPackage.createdAt)}`}
      secondary={
        <Link component={RouterLink} href={paths.dashboard.hajj.details(hajjPackage.id)} color="inherit">
          {hajjPackage.name}
        </Link>
      }
      primaryTypographyProps={{ typography: 'caption', color: 'text.disabled' }}
      secondaryTypographyProps={{
        mt: 1,
        noWrap: true,
        component: 'span',
        color: 'text.primary',
        typography: 'subtitle1',
      }}
    />
  );

  const renderPackageType = (
    <Chip
      size="small"
      label={hajjPackage.packageType}
      color={
        hajjPackage.packageType === 'Hajj' 
          ? 'primary' 
          : hajjPackage.packageType === 'Umra' 
            ? 'info' 
            : 'warning'
      }
      sx={{ position: 'absolute', top: 45, left: 8, zIndex: 9 }}
    />
  );

  const renderInfo = (
    <Stack
      spacing={1.5}
      sx={{ position: 'relative', p: (theme) => theme.spacing(0, 2.5, 2.5, 2.5) }}
    >
      <IconButton onClick={popover.onOpen} sx={{ position: 'absolute', bottom: 20, right: 8 }}>
        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>

      {[
        {
          icon: <Iconify icon="mingcute:location-fill" sx={{ color: 'error.main' }} />,
          label: hajjPackage.destination,
        },
        {
          icon: <Iconify icon="solar:calendar-bold" sx={{ color: 'info.main' }} />,
          label: fDateRangeShortLabel(hajjPackage.available.startDate, hajjPackage.available.endDate),
        },
        {
          icon: <Iconify icon="solar:users-group-rounded-bold" sx={{ color: 'primary.main' }} />,
          label: `${hajjPackage.pilgrims.length} Registered`,
        },
      ].map((item) => (
        <Stack
          key={item.label}
          spacing={1}
          direction="row"
          alignItems="center"
          sx={{ typography: 'body2' }}
        >
          {item.icon}
          {item.label}
        </Stack>
      ))}
    </Stack>
  );

  return (
    <Card sx={{ p: 1 }}>
      {renderImages}
      {renderPackageType}
      {renderTexts}

      <Stack
        spacing={1.5}
        direction="row"
        flexWrap="wrap"
        sx={{
          px: 2.5,
          pb: 2,
        }}
      >
        {hajjPackage.tags.slice(0, 3).map((tag) => (
          <Box
            key={tag}
            sx={{
              bgcolor: 'text.disabled',
              color: 'common.white',
              fontSize: 12,
              py: 0.5,
              px: 0.75,
              borderRadius: 0.5,
            }}
          >
            {tag}
          </Box>
        ))}
      </Stack>

      {renderInfo}

      <CustomPopover
        open={popover.open}
        anchorEl={popover.anchorEl}
        onClose={popover.onClose}
        sx={{ width: 160 }}
      >
        <MenuList>
          <MenuItem
            onClick={() => {
              popover.onClose();
              onView();
            }}
          >
            <Iconify icon="solar:eye-bold" />
            View
          </MenuItem>

          <MenuItem
            onClick={() => {
              popover.onClose();
              onEdit();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Edit
          </MenuItem>

          <MenuItem
            onClick={() => {
              popover.onClose();
              onDelete();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Delete
          </MenuItem>
        </MenuList>
      </CustomPopover>
    </Card>
  );
} 