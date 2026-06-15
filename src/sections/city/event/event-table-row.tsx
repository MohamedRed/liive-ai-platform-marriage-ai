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

type EventTableRowProps = {
  row: {
    id: string;
    name: string;
    category: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    photoUrl: string;
  };
  selected: boolean;
  onSelectRow: () => void;
  onViewRow: () => void;
  onEditRow: () => void;
};

export default function EventTableRow({
  row,
  selected,
  onSelectRow,
  onViewRow,
  onEditRow,
}: EventTableRowProps) {
  const { name, category, location, startDate, endDate, status, photoUrl } = row;

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  };

  const formatDateRange = (start: Date, end: Date) => {
    if (start.toDateString() === end.toDateString()) {
      return formatDate(start);
    }
    
    const startOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const endOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    
    return `${new Date(start).toLocaleDateString('en-US', startOptions)} - ${new Date(end).toLocaleDateString('en-US', endOptions)}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'upcoming') return 'info';
    if (status === 'active') return 'success';
    if (status === 'completed') return 'default';
    return 'error';
  };

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
        <Typography variant="body2" noWrap>
          {formatDateRange(startDate, endDate)}
        </Typography>
      </TableCell>

      <TableCell>
        <Label
          variant="soft"
          color={getStatusColor(status)}
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