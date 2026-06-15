import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type RestaurantTableRowProps = {
  row: {
    id: string;
    name: string;
    category: string;
    location: string;
    rating: number;
    status: string;
    photoUrl: string;
  };
  selected: boolean;
  onSelectRow: () => void;
  onViewRow: () => void;
  onEditRow: () => void;
};

export default function RestaurantTableRow({
  row,
  selected,
  onSelectRow,
  onViewRow,
  onEditRow,
}: RestaurantTableRowProps) {
  const { name, category, location, rating, status, photoUrl } = row;

  return (
    <TableRow hover selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onClick={onSelectRow} />
      </TableCell>

      <TableCell>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar alt={name} src={photoUrl} />

          <ListItemText
            primary={
              <Link
                noWrap
                color="inherit"
                variant="subtitle2"
                onClick={onViewRow}
                sx={{ cursor: 'pointer' }}
              >
                {name}
              </Link>
            }
            secondary={category}
            primaryTypographyProps={{ typography: 'body2' }}
            secondaryTypographyProps={{
              component: 'span',
              color: 'text.disabled',
            }}
          />
        </Stack>
      </TableCell>

      <TableCell>
        <Typography variant="body2" noWrap>
          {location}
        </Typography>
      </TableCell>

      <TableCell>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Iconify icon="material-symbols:star-rounded" sx={{ color: 'warning.main' }} />
          <Typography variant="body2">{rating}</Typography>
        </Stack>
      </TableCell>

      <TableCell>
        <Label
          variant="soft"
          color={(status === 'active' && 'success') || 'error'}
        >
          {status}
        </Label>
      </TableCell>

      <TableCell align="right">
        <IconButton color="default" onClick={onEditRow}>
          <Iconify icon="solar:pen-bold" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
} 