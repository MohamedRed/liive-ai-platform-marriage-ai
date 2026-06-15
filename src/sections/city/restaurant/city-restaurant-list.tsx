import { useState, useCallback, useEffect } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
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
import RestaurantTableRow from './restaurant-table-row';
import RestaurantTableToolbar from './restaurant-table-toolbar';
import RestaurantForm from './restaurant-form';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Restaurant' },
  { id: 'category', label: 'Category' },
  { id: 'location', label: 'Location' },
  { id: 'rating', label: 'Rating' },
  { id: 'status', label: 'Status' },
  { id: '' },
];

const defaultFilters = {
  name: '',
  category: [],
  status: 'all',
};

// ----------------------------------------------------------------------

export default function CityRestaurantList() {
  const router = useRouter();
  
  const { 
    restaurants, 
    loading, 
    error, 
    getRestaurants 
  } = useCityData();
  
  const table = useTable({ defaultOrderBy: 'name' });

  const [filters, setFilters] = useState(defaultFilters);
  const [openModal, setOpenModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any>(null);

  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  const dataFiltered = applyFilter({
    inputData: restaurants,
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
      const restaurant = restaurants.find(r => r.id === id);
      setEditingRestaurant(restaurant);
      setOpenModal(true);
    },
    [restaurants]
  );

  const handleEditRow = useCallback(
    (id: string) => {
      const restaurant = restaurants.find(r => r.id === id);
      setEditingRestaurant(restaurant);
      setOpenModal(true);
    },
    [restaurants]
  );

  const handleAddRestaurant = useCallback(() => {
    setEditingRestaurant(null);
    setOpenModal(true);
  }, []);

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingRestaurant(null);
  };

  const handleSaveRestaurant = (restaurantData: any) => {
    // In a real implementation, this would save to the backend
    console.log('Saving restaurant:', restaurantData);
    getRestaurants(); // Refresh the list after saving
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
            onClick={() => getRestaurants()}
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
            Loading restaurants...
          </Typography>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth={false}>
      <Card>
        <RestaurantTableToolbar
          filters={filters}
          onFilters={handleFilters}
          onAddRestaurant={handleAddRestaurant}
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
                    rowCount={restaurants.length}
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
                        <RestaurantTableRow
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
                      emptyRows={emptyRows(table.page, table.rowsPerPage, restaurants.length)}
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

      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingRestaurant ? 'Edit Restaurant' : 'Add New Restaurant'}
        </DialogTitle>
        <DialogContent>
          <RestaurantForm 
            restaurant={editingRestaurant} 
            onSave={handleSaveRestaurant} 
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
    category: string[];
    status: string;
  };
}) {
  const { name, category, status } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index] as const);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter(
      (restaurant) => restaurant.name.toLowerCase().indexOf(name.toLowerCase()) !== -1
    );
  }

  if (category.length) {
    inputData = inputData.filter((restaurant) => category.includes(restaurant.category));
  }

  if (status !== 'all') {
    inputData = inputData.filter((restaurant) => restaurant.status === status);
  }

  return inputData;
} 