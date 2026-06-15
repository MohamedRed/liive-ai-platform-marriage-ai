import type { IHijraItem, IHijraFilters } from '@livve-1/database-types';

import { useState, useCallback, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { LoadingButton } from '@mui/lab';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';
import { useSetState } from 'src/hooks/use-set-state';

import { orderBy } from 'src/utils/helper';
import { fIsAfter, fIsBetween } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { HIJRA_SERVICE_OPTIONS } from 'src/_mock/_hijra';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { LoadingScreen } from 'src/components/loading-screen';

import { HijraList } from '../../hijra/hijra-list';
import { HijraSort } from '../../hijra/hijra-sort';
import { HijraSearch } from '../../hijra/hijra-search';
import { HijraFilters } from '../../hijra/hijra-filters';
import { HijraFiltersResult } from '../../hijra/hijra-filters-result';

// Firestore service
import { hijraFirestore } from 'src/services/firebase/hijra';

// ----------------------------------------------------------------------

const defaultFilters: IHijraFilters = {
  services: [],
  destination: [],
  guides: [],
  startDate: null,
  endDate: null,
};

// ----------------------------------------------------------------------

export function HijraListView() {
  const openFilters = useBoolean();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<IHijraItem[]>([]);
  const [sortBy, setSortBy] = useState('latest');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<IHijraFilters>(defaultFilters);

  // Load packages from Firestore
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        const data = await hijraFirestore.getPackages();
        setPackages(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching Hijra packages:', err);
        setError('Failed to load Hijra packages. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handleSortBy = useCallback((newValue: string) => {
    setSortBy(newValue);
  }, []);

  const handleSearch = useCallback((inputValue: string) => {
    setSearch(inputValue);
  }, []);

  const handleFilters = useCallback((name: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const handleDeletePackage = useCallback(async (id: string) => {
    try {
      await hijraFirestore.deletePackage(id);
      // Remove the deleted package from the state
      setPackages((prevPackages) => prevPackages.filter((pkg) => pkg.id !== id));
    } catch (err) {
      console.error('Error deleting package:', err);
      // Could add a toast notification here
    }
  }, []);

  const dataFiltered = applyFilter({
    inputData: packages,
    filters,
    search,
    sortBy,
  });

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Hijra Packages"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Hijra', href: paths.dashboard.hijra.root },
          { name: 'List' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.hijra.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            New Package
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack
        spacing={2.5}
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-end', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Stack
          spacing={1}
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          sx={{ width: 1 }}
        >
          <HijraSearch
            search={search}
            onSearch={handleSearch}
            sx={{ width: { xs: 1, md: 260 } }}
          />

          <Stack direction="row" spacing={1} flexGrow={1} sx={{ width: 1 }}>
            <HijraFilters
              open={openFilters.value}
              onOpen={openFilters.onTrue}
              onClose={openFilters.onFalse}
              //
              filters={filters}
              onFilters={handleFilters}
              //
              serviceOptions={HIJRA_SERVICE_OPTIONS.map((option) => option.label)}
              onResetFilters={handleResetFilters}
              //
            />
          </Stack>
        </Stack>

        <HijraSort sort={sortBy} onSort={handleSortBy} />
      </Stack>

      {loading && <LoadingScreen />}

      {error && (
        <EmptyContent
          filled
          title="Error"
          description={error}
          action={
            <LoadingButton
              variant="contained"
              onClick={() => window.location.reload()}
            >
              Retry
            </LoadingButton>
          }
        />
      )}

      {!loading && !error && (
        <>
          <HijraFiltersResult
            filters={filters}
            onResetFilters={handleResetFilters}
            //
            canReset={
              !!filters.services.length ||
              !!filters.destination.length ||
              !!filters.guides.length ||
              (!!filters.startDate && !!filters.endDate)
            }
            //
            onFilters={handleFilters}
            //
            results={dataFiltered.length}
            sx={{ mb: { xs: 3, md: 5 } }}
          />

          {!dataFiltered.length ? (
            <EmptyContent
              filled
              title="No Data"
              description="No Hijra packages found"
              action={
                <Button
                  component={RouterLink}
                  href={paths.dashboard.hijra.new}
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  variant="contained"
                >
                  Create New Package
                </Button>
              }
            />
          ) : (
            <HijraList packages={dataFiltered} onDelete={handleDeletePackage} />
          )}
        </>
      )}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function applyFilter({
  inputData,
  filters,
  search,
  sortBy,
}: {
  inputData: IHijraItem[];
  filters: IHijraFilters;
  search: string;
  sortBy: string;
}) {
  const { services, destination, guides, startDate, endDate } = filters;

  // SORT BY
  if (sortBy === 'latest') {
    inputData = orderBy(inputData, ['createdAt'], ['desc']);
  }

  if (sortBy === 'oldest') {
    inputData = orderBy(inputData, ['createdAt'], ['asc']);
  }

  if (sortBy === 'popular') {
    // Sort by number of clients
    inputData = [...inputData].sort((a, b) => (b.clients?.length || 0) - (a.clients?.length || 0));
  }

  // FILTERS
  if (search) {
    inputData = inputData.filter(
      (item) =>
        item.name.toLowerCase().indexOf(search.toLowerCase()) !== -1 ||
        item.content.toLowerCase().indexOf(search.toLowerCase()) !== -1
    );
  }

  if (services.length) {
    inputData = inputData.filter((item) =>
      item.services.some((service) => services.includes(service))
    );
  }

  if (destination.length) {
    inputData = inputData.filter((item) => destination.includes(item.destination));
  }

  if (guides.length) {
    inputData = inputData.filter((item) =>
      item.guides.some((guide) => 
        guides.some(g => typeof g === 'string' ? g === guide.id : g.id === guide.id)
      )
    );
  }

  if (startDate && endDate) {
    inputData = inputData.filter((item) =>
      fIsBetween(
        item.available.startDate,
        startDate,
        endDate
      ) ||
      fIsBetween(
        item.available.endDate,
        startDate,
        endDate
      ) ||
      (fIsAfter(item.available.startDate, startDate) &&
        fIsAfter(endDate, item.available.endDate))
    );
  }

  return inputData;
} 