import type { IPostItem } from 'src/types/blog';

import { useState, useEffect, useCallback } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Unstable_Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fShortenNumber } from 'src/utils/format-number';

import { POST_PUBLISH_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Markdown } from 'src/components/markdown';
import { EmptyContent } from 'src/components/empty-content';

import { PostDetailsHero } from '../post-details-hero';
import { PostCommentList } from '../post-comment-list';
import { PostCommentForm } from '../post-comment-form';
import { PostDetailsSkeleton } from '../post-skeleton';
import { PostDetailsToolbar } from '../post-details-toolbar';

// ----------------------------------------------------------------------

interface Source {
  name: string;
  title: string;
  organization: string;
  imageUrl?: string;
  credentials: string;
}

interface NewsItem extends IPostItem {
  isPositive: boolean;
  context: string;
  history: string;
  solutions: string;
  sources: Source[];
}

type Props = {
  news?: NewsItem;
  loading?: boolean;
  error?: any;
};

export function NewsDetailsView({ news, loading, error }: Props) {
  const [publish, setPublish] = useState('');

  const handleChangePublish = useCallback((newValue: string) => {
    setPublish(newValue);
  }, []);

  useEffect(() => {
    if (news) {
      setPublish(news.publish);
    }
  }, [news]);

  if (loading) {
    return <PostDetailsSkeleton />;
  }

  if (error) {
    return (
      <Container sx={{ my: 5 }}>
        <EmptyContent
          filled
          title="News article not found!"
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.news.root}
              startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
              sx={{ mt: 3 }}
            >
              Back to News
            </Button>
          }
          sx={{ py: 10 }}
        />
      </Container>
    );
  }

  if (!news) {
    return null;
  }

  return (
    <DashboardContent maxWidth={false} disablePadding>
      <Container maxWidth={false} sx={{ px: { sm: 5 } }}>
        <PostDetailsToolbar
          backLink={paths.dashboard.news.root}
          editLink={paths.dashboard.news.edit(`${news.title}`)}
          liveLink={news.isPositive ? paths.dashboard.news.positive : paths.dashboard.news.negative}
          publish={`${publish}`}
          onChangePublish={handleChangePublish}
          publishOptions={POST_PUBLISH_OPTIONS}
        />
      </Container>

      <PostDetailsHero title={`${news.title}`} coverUrl={`${news.coverUrl}`} />

      <Stack
        sx={{
          pb: 5,
          mx: 'auto',
          maxWidth: 720,
          mt: { xs: 5, md: 10 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Typography variant="subtitle1">{news.description}</Typography>

        <Markdown children={news.content} />

        {/* Context Section */}
        <Paper sx={{ p: 3, mt: 5, bgcolor: (theme) => theme.palette.background.neutral }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Context</Typography>
          <Typography variant="body1">{news.context}</Typography>
        </Paper>

        {/* Historical Background */}
        <Paper sx={{ p: 3, mt: 3, bgcolor: (theme) => theme.palette.background.neutral }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Historical Background</Typography>
          <Typography variant="body1">{news.history}</Typography>
        </Paper>

        {/* Solutions */}
        {news.solutions && (
          <Paper sx={{ p: 3, mt: 3, bgcolor: (theme) => theme.palette.background.neutral }}>
            <Typography variant="h5" sx={{ mb: 2 }}>Potential Solutions</Typography>
            <Typography variant="body1">{news.solutions}</Typography>
          </Paper>
        )}

        {/* Expert Sources */}
        <Box sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ mb: 3 }}>Expert Sources</Typography>
          <Grid container spacing={3}>
            {news.sources.map((source, index) => (
              <Grid key={index} xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      {source.imageUrl && (
                        <Avatar
                          alt={source.name}
                          src={source.imageUrl}
                          sx={{ width: 56, height: 56 }}
                        />
                      )}
                      <Box>
                        <Typography variant="subtitle1">{source.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {source.title}, {source.organization}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2">{source.credentials}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ mt: 6, mb: 6 }} />

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="subtitle2">Share:</Typography>

          <AvatarGroup>
            {[
              'dashicons:facebook',
              'ant-design:twitter-outlined',
              'ph:instagram-logo',
              'mdi:linkedin',
            ].map((icon) => (
              <Avatar
                key={icon}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'primary.main' },
                }}
              >
                <Iconify width={16} icon={icon} />
              </Avatar>
            ))}
          </AvatarGroup>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 3 }}>
          <Button
            size="small"
            color="primary"
            startIcon={<Iconify icon="solar:heart-bold" />}
          >
            Like
          </Button>

          <Box sx={{ typography: 'subtitle2' }}>{fShortenNumber(news.totalViews)} views</Box>

          <Box sx={{ typography: 'subtitle2' }}>{fShortenNumber(news.totalShares)} shares</Box>

          <Box sx={{ typography: 'subtitle2' }}>{fShortenNumber(news.totalComments)} comments</Box>
        </Stack>

        <Divider sx={{ mt: 6, mb: 6 }} />

        <Typography variant="h4" sx={{ mb: 5 }}>
          Comments
        </Typography>

        <PostCommentList comments={news.comments} />

        <Divider sx={{ mt: 6, mb: 6 }} />

        <PostCommentForm />
      </Stack>
    </DashboardContent>
  );
}
