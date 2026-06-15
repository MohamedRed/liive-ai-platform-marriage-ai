import type { IHijraClient } from '@livve-1/database-types';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Pagination from '@mui/material/Pagination';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  clients?: IHijraClient[];
};

export function HijraDetailsClients({ clients }: Props) {
  const [connected, setConnected] = useState<string[]>([]);

  const handleConnect = useCallback(
    (clientId: string) => {
      const selected = connected.includes(clientId)
        ? connected.filter((id) => id !== clientId)
        : [...connected, clientId];

      setConnected(selected);
    },
    [connected]
  );

  return (
    <>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Families who registered for this package
      </Typography>
      
      <Box
        gap={3}
        display="grid"
        gridTemplateColumns={{ xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
      >
        {clients?.map((client) => (
          <ClientItem
            key={client.id}
            client={client}
            selected={connected.includes(client.id)}
            onSelected={() => handleConnect(client.id)}
          />
        ))}
      </Box>

      <Pagination count={10} sx={{ mt: { xs: 5, md: 8 }, mx: 'auto' }} />
    </>
  );
}

// ----------------------------------------------------------------------

type ClientItemProps = {
  selected: boolean;
  client: IHijraClient;
  onSelected: () => void;
};

function ClientItem({ selected, client, onSelected }: ClientItemProps) {
  return (
    <Card sx={{ p: 3, gap: 2, display: 'flex' }}>
      <Avatar alt={client.name} src={client.avatarUrl} sx={{ width: 48, height: 48 }} />

      <Stack spacing={2} flexGrow={1}>
        <ListItemText
          primary={client.name}
          secondary={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Iconify icon="solar:users-group-rounded-bold" width={16} />
              Family of {client.familyMembers}
            </Stack>
          }
          secondaryTypographyProps={{
            mt: 0.5,
            component: 'span',
            typography: 'caption',
            color: 'text.disabled',
          }}
        />

        <Stack spacing={1} direction="row">
          <IconButton
            size="small"
            color="error"
            sx={{
              borderRadius: 1,
              bgcolor: (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.08),
              '&:hover': {
                bgcolor: (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.16),
              },
            }}
          >
            <Iconify width={18} icon="solar:phone-bold" />
          </IconButton>

          <IconButton
            size="small"
            color="info"
            sx={{
              borderRadius: 1,
              bgcolor: (theme) => varAlpha(theme.vars.palette.info.mainChannel, 0.08),
              '&:hover': {
                bgcolor: (theme) => varAlpha(theme.vars.palette.info.mainChannel, 0.16),
              },
            }}
          >
            <Iconify width={18} icon="solar:chat-round-dots-bold" />
          </IconButton>

          <IconButton
            size="small"
            color="primary"
            sx={{
              borderRadius: 1,
              bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
              '&:hover': {
                bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
              },
            }}
          >
            <Iconify width={18} icon="fluent:mail-24-filled" />
          </IconButton>
        </Stack>
      </Stack>

      <Button
        size="small"
        variant={selected ? 'text' : 'outlined'}
        color={selected ? 'success' : 'inherit'}
        startIcon={
          selected ? <Iconify width={18} icon="eva:checkmark-fill" sx={{ mr: -0.75 }} /> : null
        }
        onClick={onSelected}
      >
        {selected ? 'Connected' : 'Connect'}
      </Button>
    </Card>
  );
} 