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
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

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
import TransitRouteRow from './transit-route-row';
import TransitRouteToolbar from './transit-route-toolbar';
import TransitRouteForm from './transit-route-form';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Route Name' },
  { id: 'type', label: 'Type' },
  { id: 'stops', label: 'Stops' },
  { id: 'status', label: 'Status' },
  { id: '' },
];

const defaultFilters = {
  name: '',
  type: [],
  status: 'all',
};

// ----------------------------------------------------------------------

export default function CityPublicTransit() {
  const router = useRouter();
  
  const { 
    transitRoutes, 
    loading, 
    error, 
    getTransitRoutes 
  } = useCityData();
  
  const table = useTable({ defaultOrderBy: 'name' });

  const [filters, setFilters] = useState(defaultFilters);
  const [openModal, setOpenModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);

  useEffect(() => {
    getTransitRoutes();
  }, [getTransitRoutes]);

  const dataFiltered = applyFilter({
    inputData: transitRoutes,
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
      const route = transitRoutes.find(r => r.id === id);
      setEditingRoute(route);
      setOpenModal(true);
    },
    [transitRoutes]
  );

  const handleEditRow = useCallback(
    (id: string) => {
      const route = transitRoutes.find(r => r.id === id);
      setEditingRoute(route);
      setOpenModal(true);
    },
    [transitRoutes]
  );

  const handleAddRoute = useCallback(() => {
    setEditingRoute(null);
    setOpenModal(true);
  }, []);

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingRoute(null);
  };

  const handleSaveRoute = (routeData: any) => {
    // In a real implementation, this would save to the backend
    console.log('Saving transit route:', routeData);
    getTransitRoutes(); // Refresh the list after saving
    handleCloseModal();
  };

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
            onClick={() => getTransitRoutes()}
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
            Loading transit routes...
          </Typography>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth={false}>
      <Stack spacing={3}>
        <Card>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 3 }}>
            <Typography variant="h6">Public Transit Management</Typography>
            <Button
              variant="contained"
              startIcon={<Iconify icon="eva:plus-fill" />}
              onClick={handleAddRoute}
            >
              Add Route
            </Button>
          </Stack>
          
          <TransitRouteToolbar
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
                      rowCount={transitRoutes.length}
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
                          <TransitRouteRow
                            key={row.id}
                            row={row}
                            selected={table.selected.includes(row.id)}
                            onSelectRow={() => table.onSelectRow(row.id)}
                            onViewRow={() => handleViewRow(row.id)}
                            onEditRow={() => handleEditRow(row.id)}
                          />
                        ))}

                      <TableEmptyRows
                        height={72}
                        emptyRows={emptyRows(table.page, table.rowsPerPage, transitRoutes.length)}
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
      </Stack>

      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingRoute ? 'Edit Transit Route' : 'Add New Transit Route'}
        </DialogTitle>
        <DialogContent>
          <TransitRouteForm 
            route={editingRoute} 
            onSave={handleSaveRoute} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
        </DialogActions>
      </Dialog>
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
    type: string[];
    status: string;
  };
}) {
  const { name, type, status } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index] as const);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter(
      (route) => route.name.toLowerCase().indexOf(name.toLowerCase()) !== -1
    );
  }

  if (type.length) {
    inputData = inputData.filter((route) => type.includes(route.type));
  }

  if (status !== 'all') {
    inputData = inputData.filter((route) => route.status === status);
  }

  return inputData;
} 