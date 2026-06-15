import { useState, useCallback, useEffect } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import {
  useTable,
  emptyRows,
  TableNoData,
  getComparator,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useCityData } from '../hooks';
import OrderTableRow from './order-table-row';
import OrderTableToolbar from './order-table-toolbar';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'id', label: 'Order ID' },
  { id: 'restaurantId', label: 'Restaurant' },
  { id: 'customerName', label: 'Customer' },
  { id: 'amount', label: 'Amount' },
  { id: 'createdAt', label: 'Date' },
  { id: 'status', label: 'Status' },
  { id: '' },
];

const defaultFilters = {
  name: '',
  status: 'all',
};

// ----------------------------------------------------------------------

export default function CityOrderList() {
  const router = useRouter();
  
  const { 
    orders, 
    loading, 
    error, 
    getOrders 
  } = useCityData();
  
  const table = useTable({ defaultOrderBy: 'createdAt' });

  const [filters, setFilters] = useState(defaultFilters);

  useEffect(() => {
    getOrders();
  }, [getOrders]);

  const dataFiltered = applyFilter({
    inputData: orders,
    comparator: getComparator(table.order, table.orderBy),
    filters,
  });

  const handleFilters = useCallback(
    (name: string, value: string | string[]) => {
      table.onResetPage();
      setFilters((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    },
    [table]
  );

  const handleViewRow = useCallback(
    (id: string) => {
      router.push(paths.dashboard.city.order.details(id));
    },
    [router]
  );

  const notFound = !dataFiltered.length && !loading;

  if (error) {
    return (
      <Container maxWidth={false}>
        <Card sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error.main" paragraph>
            {error}
          </Typography>
          <Button 
            color="primary" 
            variant="contained" 
            onClick={() => getOrders()}
          >
            Retry
          </Button>
        </Card>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth={false}>
        <Card sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
            Loading orders...
          </Typography>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth={false}>
      <Card>
        <OrderTableToolbar
          filters={filters}
          onFilters={handleFilters}
        />

        {notFound ? (
          <TableNoData notFound={notFound} />
        ) : (
          <>
            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table size={table.dense ? 'small' : 'medium'}>
                  <TableHeadCustom
                    order={table.order}
                    orderBy={table.orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={orders.length}
                    numSelected={table.selected.length}
                    onSort={table.onSort}
                  />

                  <TableBody>
                    {dataFiltered
                      .slice(
                        table.page * table.rowsPerPage,
                        table.page * table.rowsPerPage + table.rowsPerPage
                      )
                      .map((row) => (
                        <OrderTableRow
                          key={row.id}
                          row={row}
                          selected={table.selected.includes(row.id)}
                          onSelectRow={() => table.onSelectRow(row.id)}
                          onViewRow={() => handleViewRow(row.id)}
                        />
                      ))}

                    <TableEmptyRows
                      height={72}
                      emptyRows={emptyRows(table.page, table.rowsPerPage, orders.length)}
                    />
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={dataFiltered.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>
    </Container>
  );
}

// ----------------------------------------------------------------------

function applyFilter({
  inputData,
  comparator,
  filters,
}: {
  inputData: any[];
  comparator: (a: any, b: any) => number;
  filters: {
    name: string;
    status: string;
  };
}) {
  const { name, status } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index] as const);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter(
      (order) => order.customerName.toLowerCase().indexOf(name.toLowerCase()) !== -1
    );
  }

  if (status !== 'all') {
    inputData = inputData.filter((order) => order.status === status);
  }

  return inputData;
} 