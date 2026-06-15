import type { IHijraItem } from '@livve-1/database-types';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination, { paginationClasses } from '@mui/material/Pagination';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { HijraItem } from './hijra-item';

// ----------------------------------------------------------------------

type Props = {
  packages: IHijraItem[];
  onDelete?: (id: string) => void;
};

export function HijraList({ packages, onDelete }: Props) {
  const router = useRouter();

  const handleView = useCallback(
    (id: string) => {
      router.push(paths.dashboard.hijra.details(id));
    },
    [router]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(paths.dashboard.hijra.edit(id));
    },
    [router]
  );

  const handleDelete = useCallback((id: string) => {
    if (onDelete) {
      onDelete(id);
    } else {
      console.info('DELETE', id);
    }
  }, [onDelete]);

  return (
    <>
      <Box
        gap={3}
        display="grid"
        gridTemplateColumns={{ xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
      >
        {packages.map((hijraPackage) => (
          <HijraItem
            key={hijraPackage.id}
            package={hijraPackage}
            onView={() => handleView(hijraPackage.id)}
            onEdit={() => handleEdit(hijraPackage.id)}
            onDelete={() => handleDelete(hijraPackage.id)}
          />
        ))}
      </Box>

      {packages.length > 8 && (
        <Pagination
          count={8}
          sx={{
            mt: { xs: 5, md: 8 },
            [`& .${paginationClasses.ul}`]: { justifyContent: 'center' },
          }}
        />
      )}
    </>
  );
} 