import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type TransitRouteRowProps = {
  row: {
    id: string;
    name: string;
    type: string;
    stops: number;
    status: string;
  };
  selected: boolean;
  onSelectRow: () => void;
  onViewRow: () => void;
  onEditRow: () => void;
};

export default function TransitRouteRow({
  row,
  selected,
  onSelectRow,
  onViewRow,
  onEditRow,
}: TransitRouteRowProps) {
  const { id, name, type, stops, status } = row;

  const getRouteTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bus':
        return 'mdi:bus';
      case 'tram':
        return 'mdi:tram';
      case 'subway':
        return 'mdi:subway';
      case 'train':
        return 'mdi:train';
      default:
        return 'mdi:transit-connection';
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'operational') return 'success';
    if (status === 'limited') return 'warning';
    if (status === 'closed') return 'error';
    return 'default';
  };

  return (
    <TableRow hover selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onClick={onSelectRow} />
      </TableCell>

      <TableCell>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Iconify icon={getRouteTypeIcon(type)} width={24} />

          <Link
            noWrap
            color="inherit"
            variant="subtitle2"
            onClick={onViewRow}
            sx={{ cursor: 'pointer' }}
          >
            {name}
          </Link>
        </Stack>
      </TableCell>

      <TableCell>
        <Chip 
          label={type} 
          size="small" 
          color={
            type === 'bus' ? 'default' : 
            type === 'tram' ? 'primary' :
            type === 'subway' ? 'secondary' : 
            'default'
          }
          variant="soft"
        />
      </TableCell>

      <TableCell>
        <Typography variant="body2">
          {stops}
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