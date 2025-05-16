import type { IHajjItem } from '@livve-1/database-types';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination, { paginationClasses } from '@mui/material/Pagination';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { HajjItem } from './hajj-item';

// ----------------------------------------------------------------------

type Props = {
  packages: IHajjItem[];
  onDelete?: (id: string) => void;
};

export function HajjList({ packages, onDelete }: Props) {
  const router = useRouter();

  const handleView = useCallback(
    (id: string) => {
      router.push(paths.dashboard.hajj.details(id));
    },
    [router]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(paths.dashboard.hajj.edit(id));
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
        {packages.map((hajjPackage) => (
          <HajjItem
            key={hajjPackage.id}
            package={hajjPackage}
            onView={() => handleView(hajjPackage.id)}
            onEdit={() => handleEdit(hajjPackage.id)}
            onDelete={() => handleDelete(hajjPackage.id)}
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