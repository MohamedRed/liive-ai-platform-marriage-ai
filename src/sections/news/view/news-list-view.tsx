import type { IPostItem, IPostFilters } from 'src/types/blog';

import { useState, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useDebounce } from 'src/hooks/use-debounce';
import { useSetState } from 'src/hooks/use-set-state';

import { orderBy } from 'src/utils/helper';

import { POST_SORT_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetPosts, useSearchPosts } from 'src/actions/blog';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { PostSort } from '../post-sort';
import { PostSearch } from '../post-search';
import { PostListHorizontal } from '../post-list-horizontal';

// ----------------------------------------------------------------------

type NewsTypeValue = 'all' | 'positive' | 'negative';

interface NewsFilters extends IPostFilters {
  newsType: NewsTypeValue;
}

// We need to create default filters with newsType
const defaultFilters: NewsFilters = {
  publish: 'all',
  newsType: 'all',
};

// ----------------------------------------------------------------------

export function NewsListView() {
  const [sortBy, setSortBy] = useState('latest');

  const { state: filters, setState: setFilters } = useSetState<NewsFilters>(defaultFilters);

  const [searchQuery, setSearchQuery] = useState('');

  const debouncedQuery = useDebounce(searchQuery);

  const { positivePosts, negativePosts, allPosts } = {
    // This would be replaced with actual data from an API
    positivePosts: [], 
    negativePosts: [],
    allPosts: []
  };

  const { searchResults, searchLoading } = useSearchPosts(debouncedQuery);

  const dataFiltered = applyFilter({
    inputData: filters.newsType === 'positive' ? positivePosts : 
              filters.newsType === 'negative' ? negativePosts : allPosts,
    filters,
    sortBy,
  });

  const handleSortBy = useCallback((newValue: string) => {
    setSortBy(newValue);
  }, []);

  const handleFilters = useCallback((name: string, value: string | boolean) => {
    setFilters({ [name]: value });
  }, [setFilters]);

  const handleSearch = useCallback((inputValue: string) => {
    setSearchQuery(inputValue);
  }, []);

  const handleFilterNewsType = useCallback(
    (event: React.SyntheticEvent, newValue: NewsTypeValue) => {
      handleFilters('newsType', newValue);
    },
    [handleFilters]
  );

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="News Feed"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'News', href: paths.dashboard.news.root },
          { name: 'List' },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.news.root}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Refresh News
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack
        spacing={3}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-end', sm: 'center' }}
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <PostSearch
          query={debouncedQuery}
          results={searchResults}
          onSearch={handleSearch}
          loading={searchLoading}
          hrefItem={(title: string) => paths.dashboard.news.details(title)}
        />

        <PostSort sort={sortBy} onSort={handleSortBy} sortOptions={POST_SORT_OPTIONS} />
      </Stack>

      <Tabs
        value={filters.newsType}
        onChange={handleFilterNewsType}
        sx={{
          mb: { xs: 3, md: 5 },
          '& .MuiTabs-indicator': {
            height: 3,
          },
        }}
      >
        {[
          { value: 'all', label: 'All News', count: 0 },
          { value: 'positive', label: 'Positive News', count: 0 },
          { value: 'negative', label: 'Negative News', count: 0 },
        ].map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            iconPosition="end"
            icon={
              <Label
                variant={filters.newsType === tab.value ? 'filled' : 'soft'}
                color={
                  (tab.value === 'positive' && 'success') ||
                  (tab.value === 'negative' && 'error') ||
                  'default'
                }
              >
                {tab.count}
              </Label>
            }
          />
        ))}
      </Tabs>

      {filters.newsType === 'positive' && (
        <Box mb={5}>
          <Typography variant="h4" sx={{ mb: 3 }}>Positive News</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Stories that inspire hope and highlight positive developments around the world.
          </Typography>
          <Paper sx={{ p: 3, mb: 3, bgcolor: (theme) => theme.palette.background.neutral }}>
            <Typography variant="subtitle1" fontWeight="bold">Why Positive News Matters</Typography>
            <Typography variant="body2">
              Research shows that consuming a balance of positive and negative news helps maintain a healthier mental outlook and provides a more accurate view of the world.
            </Typography>
          </Paper>
          
          <PostListHorizontal posts={dataFiltered} loading={false} />
        </Box>
      )}

      {filters.newsType === 'negative' && (
        <Box mb={5}>
          <Typography variant="h4" sx={{ mb: 3 }}>Negative News</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Important issues and challenges facing our world, presented with context and potential solutions.
          </Typography>
          <Paper sx={{ p: 3, mb: 3, bgcolor: (theme) => theme.palette.background.neutral }}>
            <Typography variant="subtitle1" fontWeight="bold">Understanding Context</Typography>
            <Typography variant="body2">
              Each negative news story includes historical context, expert analysis, and information about solutions being developed to address these challenges.
            </Typography>
          </Paper>
          
          <PostListHorizontal posts={dataFiltered} loading={false} />
        </Box>
      )}

      {filters.newsType === 'all' && (
        <>
          <Box mb={5}>
            <Typography variant="h4" sx={{ mb: 3 }}>Positive News</Typography>
            <PostListHorizontal posts={positivePosts} loading={false} />
          </Box>
          
          <Box mb={5}>
            <Typography variant="h4" sx={{ mb: 3 }}>Negative News</Typography>
            <PostListHorizontal posts={negativePosts} loading={false} />
          </Box>
        </>
      )}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

interface ApplyFilterProps {
  inputData: IPostItem[];
  filters: NewsFilters;
  sortBy: string;
}

const applyFilter = ({ inputData, filters, sortBy }: ApplyFilterProps) => {
  const { publish, newsType } = filters;

  if (sortBy === 'latest') {
    inputData = orderBy(inputData, ['createdAt'], ['desc']);
  }

  if (sortBy === 'oldest') {
    inputData = orderBy(inputData, ['createdAt'], ['asc']);
  }

  if (sortBy === 'popular') {
    inputData = orderBy(inputData, ['totalViews'], ['desc']);
  }

  if (publish !== 'all') {
    inputData = inputData.filter((post) => post.publish === publish);
  }

  return inputData;
};
