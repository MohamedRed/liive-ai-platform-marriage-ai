import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Unstable_Grid2';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import { LoadingButton } from '@mui/lab';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';
import { RHFTextField, RHFSelect, Form } from 'src/components/hook-form';
import { fCurrency } from 'src/utils/format-number';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { EmptyContent } from 'src/components/empty-content';
import { Label } from 'src/components/label';

// Mock components for demonstration
// In a real implementation, you would import these from the actual components
const CustomAvatar = ({ children, color, ...props }: any) => (
  <Avatar sx={{ bgcolor: `${color}.main` }} {...props}>{children}</Avatar>
);

// Mock the snackbar functionality for this example
const useSnackbar = () => ({
  enqueueSnackbar: (message: string) => console.log(message),
});

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Item' },
  { id: 'category', label: 'Category' },
  { id: 'price', label: 'Price', align: 'right' },
  { id: 'status', label: 'Status' },
  { id: '', label: '' },
];

const MENU_CATEGORIES = [
  'Appetizers',
  'Main Courses',
  'Pasta',
  'Pizza',
  'Salads',
  'Desserts',
  'Beverages',
];

const ITEM_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'sold_out', label: 'Sold Out' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

// ----------------------------------------------------------------------

export default function MenuManagement() {
  const { enqueueSnackbar } = useSnackbar();

  const [menuItems, setMenuItems] = useState([
    { id: '1', name: 'Margherita Pizza', category: 'Pizza', price: 12.99, status: 'available' },
    { id: '2', name: 'Pasta Carbonara', category: 'Pasta', price: 14.50, status: 'available' },
    { id: '3', name: 'Tiramisu', category: 'Desserts', price: 7.99, status: 'available' },
    { id: '4', name: 'Caesar Salad', category: 'Salads', price: 9.50, status: 'available' },
    { id: '5', name: 'Bruschetta', category: 'Appetizers', price: 8.25, status: 'available' },
    { id: '6', name: 'Lasagna', category: 'Main Courses', price: 15.99, status: 'sold_out' },
    { id: '7', name: 'Red Wine', category: 'Beverages', price: 18.50, status: 'available' },
  ]);

  const [openDialog, setOpenDialog] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleAddItem = () => {
    setEditingItem(null);
    setOpenDialog(true);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleSaveItem = (formData: any) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      if (editingItem) {
        // Update existing item
        setMenuItems(
          menuItems.map((item) => (item.id === editingItem.id ? { ...formData, id: item.id } : item))
        );
        enqueueSnackbar('Menu item updated successfully');
      } else {
        // Add new item
        const newId = String(menuItems.length + 1);
        setMenuItems([...menuItems, { ...formData, id: newId }]);
        enqueueSnackbar('Menu item added successfully');
      }
      setLoading(false);
      handleCloseDialog();
    }, 800);
  };

  const handleConfirmDelete = (id: string) => {
    setItemToDelete(id);
    setOpenConfirm(true);
  };

  const handleCloseConfirm = () => {
    setItemToDelete(null);
    setOpenConfirm(false);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setMenuItems(menuItems.filter((item) => item.id !== itemToDelete));
      setLoading(false);
      setOpenConfirm(false);
      enqueueSnackbar('Menu item deleted successfully');
    }, 500);
  };

  const getStatusColor = (status: string) => {
    if (status === 'available') return 'success';
    if (status === 'sold_out') return 'error';
    return 'warning';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'available') return 'Available';
    if (status === 'sold_out') return 'Sold Out';
    return 'Coming Soon';
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Pizza':
        return 'solar:pizza-bold-duotone';
      case 'Pasta':
        return 'solar:bowl-bold-duotone';
      case 'Desserts':
        return 'solar:cake-bold-duotone';
      case 'Salads':
        return 'solar:leaf-bold-duotone';
      case 'Appetizers':
        return 'solar:hand-bold-duotone';
      case 'Beverages':
        return 'solar:cup-bold-duotone';
      default:
        return 'solar:restaurant-bold-duotone';
    }
  };

  return (
    <>
      {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
      
      <Card>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            py: 2.5,
            px: 3,
            borderBottom: (theme) => `solid 1px ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6">Menu Items</Typography>

          <Button
            variant="contained"
            color="primary"
            startIcon={<Iconify icon="eva:plus-fill" />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </Stack>

        <TableContainer sx={{ position: 'relative', overflow: 'unset', px: 3, py: 2 }}>
          <Scrollbar>
            <Table size="medium">
              <TableHeadCustom headLabel={TABLE_HEAD} />

              <TableBody>
                {menuItems.length > 0 ? (
                  menuItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <CustomAvatar
                            alt={item.name}
                            src={`/assets/images/menu/${item.id}.jpg`}
                            color={
                              item.category === 'Pizza'
                                ? 'primary'
                                : item.category === 'Pasta'
                                ? 'info'
                                : item.category === 'Desserts'
                                ? 'error'
                                : item.category === 'Beverages'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            <Iconify icon={getCategoryIcon(item.category)} />
                          </CustomAvatar>

                          <Typography variant="subtitle2" noWrap>
                            {item.name}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Chip 
                          label={item.category} 
                          size="small" 
                          variant="soft"
                          color={
                            item.category === 'Pizza'
                              ? 'primary'
                              : item.category === 'Pasta'
                              ? 'info'
                              : item.category === 'Desserts'
                              ? 'error'
                              : item.category === 'Beverages'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </TableCell>

                      <TableCell align="right">{fCurrency(item.price)}</TableCell>

                      <TableCell>
                        <Label color={getStatusColor(item.status)} variant="soft">
                          {getStatusLabel(item.status)}
                        </Label>
                      </TableCell>

                      <TableCell align="right">
                        <IconButton color="primary" onClick={() => handleEditItem(item)}>
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>

                        <IconButton color="error" onClick={() => handleConfirmDelete(item.id)}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyContent
                        title="No menu items"
                        description="Start by adding some menu items to your restaurant"
                        sx={{ py: 5 }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            ...(loading && {
              pointerEvents: 'none',
            }),
          },
        }}
      >
        <DialogTitle>
          {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        </DialogTitle>
        
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        
        <DialogContent sx={{ px: 3, py: 2 }}>
          <Box component="form" sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid xs={12}>
                <RHFTextField
                  name="name"
                  label="Item Name"
                  defaultValue={editingItem?.name || ''}
                />
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFSelect
                  name="category"
                  label="Category"
                  defaultValue={editingItem?.category || ''}
                >
                  {MENU_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Iconify icon={getCategoryIcon(category)} />
                        <span>{category}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>

              <Grid xs={12} sm={6}>
                <RHFTextField
                  name="price"
                  label="Price"
                  type="number"
                  defaultValue={editingItem?.price || ''}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>

              <Grid xs={12}>
                <RHFSelect
                  name="status"
                  label="Status"
                  defaultValue={editingItem?.status || 'available'}
                >
                  {ITEM_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: `${getStatusColor(option.value)}.main`,
                            mr: 1,
                          }}
                        />
                        {option.label}
                      </Stack>
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={handleCloseDialog}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <LoadingButton 
            type="button" 
            variant="contained"
            loading={loading}
            onClick={() => {
              // Collect form data - this would be handled by a proper form library in production
              const form = document.querySelector('form');
              if (form) {
                const formData = new FormData(form);
                const data = {
                  name: formData.get('name') as string,
                  category: formData.get('category') as string,
                  price: parseFloat(formData.get('price') as string),
                  status: formData.get('status') as string,
                };
                handleSaveItem(data);
              }
            }}
          >
            {editingItem ? 'Update' : 'Create'}
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onClose={handleCloseConfirm}
        title="Delete"
        content="Are you sure you want to delete this menu item?"
        action={
          <LoadingButton
            variant="contained"
            color="error"
            loading={loading}
            onClick={handleDeleteItem}
          >
            Delete
          </LoadingButton>
        }
      />
    </>
  );
} 