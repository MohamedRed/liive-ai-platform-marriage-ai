import { useState, useEffect } from 'react';
import {
  Button,
  Snackbar,
  Alert,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import { Iconify } from 'src/components/iconify';
import usePWA from 'src/hooks/use-pwa';

export default function PWAUpdateNotification() {
  const { isUpdateAvailable, offlineReady, updateServiceWorker } = usePWA();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable || offlineReady) {
      setOpen(true);
    }
  }, [isUpdateAvailable, offlineReady]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleUpdate = () => {
    updateServiceWorker();
    handleClose();
  };

  if (!isUpdateAvailable && !offlineReady) return null;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={handleClose}
    >
      <Alert 
        severity={isUpdateAvailable ? 'info' : 'success'}
        sx={{ width: '100%', alignItems: 'center' }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isUpdateAvailable && (
              <Button 
                color="info" 
                size="small" 
                onClick={handleUpdate}
                startIcon={<Iconify icon="mdi:update" />}
              >
                Update
              </Button>
            )}
            <IconButton size="small" onClick={handleClose} color="inherit">
              <Iconify icon="mdi:close" />
            </IconButton>
          </Box>
        }
      >
        <Typography variant="body2">
          {isUpdateAvailable
            ? 'A new version is available!'
            : 'App ready to work offline'}
        </Typography>
      </Alert>
    </Snackbar>
  );
} 