import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

type OrderTableRowProps = {
  row: {
    id: string;
    restaurantId: string;
    customerName: string;
    amount: number;
    status: string;
    createdAt: Date;
  };
  selected: boolean;
  onSelectRow: () => void;
  onViewRow: () => void;
};

export default function OrderTableRow({
  row,
  selected,
  onSelectRow,
  onViewRow,
}: OrderTableRowProps) {
  const { id, restaurantId, customerName, amount, status, createdAt } = row;

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'success';
    if (status === 'processing') return 'warning';
    if (status === 'cancelled') return 'error';
    return 'default';
  };

  return (
    <TableRow hover selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onClick={onSelectRow} />
      </TableCell>

      <TableCell>
        <Link
          noWrap
          color="inherit"
          variant="subtitle2"
          onClick={onViewRow}
          sx={{ cursor: 'pointer' }}
        >
          #{id}
        </Link>
      </TableCell>

      <TableCell>
        <Typography variant="body2" noWrap>
          Restaurant #{restaurantId}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2" noWrap>
          {customerName}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2" noWrap>
          {fCurrency(amount)}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2" noWrap>
          {formatDate(createdAt)}
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
        <IconButton color="default" onClick={onViewRow}>
          <Iconify icon="solar:eye-bold" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
} 