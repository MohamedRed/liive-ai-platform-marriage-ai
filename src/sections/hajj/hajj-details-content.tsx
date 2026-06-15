import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import { alpha, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

import { Image } from 'src/components/image';
import { Iconify } from 'src/components/iconify';
import { Markdown } from 'src/components/markdown';
import { Lightbox, useLightBox } from 'src/components/lightbox';
import { HAJJ_SERVICE_OPTIONS } from '@livve-1/database-types';

import type { IHajjItem } from '@livve-1/database-types';

// ----------------------------------------------------------------------

type Props = {
  hajjPackage?: IHajjItem;
};

export function HajjDetailsContent({ hajjPackage }: Props) {
  const theme = useTheme();

  const slides = hajjPackage?.images.map((img) => ({ src: img })) || [];
  const lightbox = useLightBox(slides);

  const [openDescription, setOpenDescription] = useState(true);
  const [openInclusions, setOpenInclusions] = useState(true);
  const [openExclusions, setOpenExclusions] = useState(true);
  const [openAccommodation, setOpenAccommodation] = useState(true);

  const handleOpenDescription = () => {
    setOpenDescription(!openDescription);
  };

  const handleOpenInclusions = () => {
    setOpenInclusions(!openInclusions);
  };

  const handleOpenExclusions = () => {
    setOpenExclusions(!openExclusions);
  };

  const handleOpenAccommodation = () => {
    setOpenAccommodation(!openAccommodation);
  };

  const renderGallery = (
    <>
      <Box
        gap={1}
        display="grid"
        gridTemplateColumns={{
          xs: 'repeat(1, 1fr)',
          md: 'repeat(3, 1fr)',
        }}
        sx={{ mb: 3 }}
      >
        {hajjPackage?.images.map((img, index) => (
          <Image
            key={index}
            alt={img}
            src={img}
            ratio="1/1"
            onClick={() => lightbox.onOpen(img)}
            sx={{
              borderRadius: 2,
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>

      <Lightbox
        open={lightbox.open}
        close={lightbox.onClose}
        slides={slides}
        index={lightbox.selected}
      />
    </>
  );

  const renderHead = (
    <>
      <Box 
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Stack>
          <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
            {hajjPackage?.name}
          </Typography>
          <Chip
            label={hajjPackage?.packageType}
            color={
              hajjPackage?.packageType === 'Hajj' 
                ? 'primary' 
                : hajjPackage?.packageType === 'Umra' 
                  ? 'info' 
                  : 'warning'
            }
            sx={{ maxWidth: 120, mb: 1 }}
          />
        </Stack>
        
        <Stack
          spacing={2}
          direction="row"
          alignItems="center"
          justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
        >
          <Typography variant="h4" sx={{ mt: 0.5 }}>
            {fCurrency(hajjPackage?.price || 0)}
          </Typography>

          <Box sx={{ width: 2, height: 20, borderRadius: 1, bgcolor: 'text.disabled' }} />

          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              per person
            </Typography>

            <Stack direction="row" alignItems="center">
              <Iconify icon="mingcute:star-fill" sx={{ color: 'warning.main' }} />
              <Iconify icon="mingcute:star-fill" sx={{ color: 'warning.main' }} />
              <Iconify icon="mingcute:star-fill" sx={{ color: 'warning.main' }} />
              <Iconify icon="mingcute:star-fill" sx={{ color: 'warning.main' }} />
              <Iconify icon="mingcute:star-fill" sx={{ color: 'text.disabled' }} />
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </>
  );

  const renderOverview = (
    <Box
      gap={3}
      display="grid"
      gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
    >
      {[
        {
          label: 'Available',
          value: `${fDate(hajjPackage?.available.startDate)} - ${fDate(hajjPackage?.available.endDate)}`,
          icon: <Iconify icon="solar:calendar-date-bold" />,
        },
        {
          label: 'Contact Names',
          value: hajjPackage?.guides.map((guide) => guide.name).join(', '),
          icon: <Iconify icon="solar:user-rounded-bold" />,
        },
        {
          label: 'Duration',
          value: hajjPackage?.duration,
          icon: <Iconify icon="solar:clock-circle-bold" />,
        },
        {
          label: 'Contact Phones',
          value: hajjPackage?.guides.map((guide) => guide.phoneNumber).join(', '),
          icon: <Iconify icon="solar:phone-bold" />,
        },
      ].map((item) => (
        <Stack key={item.label} spacing={1.5} direction="row">
          {item.icon}
          <ListItemText
            primary={item.label}
            secondary={item.value}
            primaryTypographyProps={{ mb: 0.5, typography: 'body2', color: 'text.secondary' }}
            secondaryTypographyProps={{
              component: 'span',
              color: 'text.primary',
              typography: 'subtitle2',
            }}
          />
        </Stack>
      ))}
    </Box>
  );

  const renderDescription = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        onClick={handleOpenDescription}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.72,
          },
        }}
      >
        <Typography variant="h5">Description</Typography>
        <Iconify
          icon={openDescription ? 'mingcute:up-line' : 'mingcute:down-line'}
          width={20}
          height={20}
        />
      </Stack>

      <Collapse in={openDescription}>
        <Markdown>{hajjPackage?.content}</Markdown>
      </Collapse>
    </Stack>
  );

  const renderInclusions = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        onClick={handleOpenInclusions}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.72,
          },
        }}
      >
        <Typography variant="h5">Inclusions</Typography>
        <Iconify
          icon={openInclusions ? 'mingcute:up-line' : 'mingcute:down-line'}
          width={20}
          height={20}
        />
      </Stack>

      <Collapse in={openInclusions}>
        <Stack spacing={2}>
          {hajjPackage?.inclusions.map((inclusion) => (
            <Stack key={inclusion} direction="row" alignItems="center" spacing={2}>
              <Iconify icon="mingcute:check-circle-fill" sx={{ color: 'success.main' }} />
              <Typography variant="body2">{inclusion}</Typography>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );

  const renderExclusions = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        onClick={handleOpenExclusions}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.72,
          },
        }}
      >
        <Typography variant="h5">Exclusions</Typography>
        <Iconify
          icon={openExclusions ? 'mingcute:up-line' : 'mingcute:down-line'}
          width={20}
          height={20}
        />
      </Stack>

      <Collapse in={openExclusions}>
        <Stack spacing={2}>
          {hajjPackage?.exclusions.map((exclusion) => (
            <Stack key={exclusion} direction="row" alignItems="center" spacing={2}>
              <Iconify icon="mingcute:close-circle-fill" sx={{ color: 'error.main' }} />
              <Typography variant="body2">{exclusion}</Typography>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );

  const renderAccommodation = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        onClick={handleOpenAccommodation}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.72,
          },
        }}
      >
        <Typography variant="h5">Accommodation Options</Typography>
        <Iconify
          icon={openAccommodation ? 'mingcute:up-line' : 'mingcute:down-line'}
          width={20}
          height={20}
        />
      </Stack>

      <Collapse in={openAccommodation}>
        <Stack spacing={2}>
          {hajjPackage?.accommodationOptions.map((option) => (
            <Stack key={option} direction="row" alignItems="center" spacing={2}>
              <Iconify icon="mingcute:hotel-fill" sx={{ color: 'info.main' }} />
              <Typography variant="body2">{option}</Typography>
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );

  const renderServices = (
    <Stack spacing={3} sx={{ p: 3, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
      <Typography variant="h5">Services</Typography>

      <Box
        rowGap={2}
        display="grid"
        gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
      >
        {HAJJ_SERVICE_OPTIONS.map((service) => (
          <Stack
            key={service.label}
            spacing={1}
            direction="row"
            alignItems="center"
            sx={{
              ...(hajjPackage?.services.includes(service.value) && {
                color: 'text.primary',
              }),
              ...(!hajjPackage?.services.includes(service.value) && {
                color: 'text.disabled',
              }),
            }}
          >
            <Iconify
              icon={
                hajjPackage?.services.includes(service.value)
                  ? 'mingcute:check-circle-fill'
                  : 'mingcute:forbid-line'
              }
            />
            <Typography variant="body2">{service.label}</Typography>
          </Stack>
        ))}
      </Box>
    </Stack>
  );

  return (
    <>
      {renderGallery}

      <Stack sx={{ maxWidth: 720, mx: 'auto' }}>
        {renderHead}

        <Divider sx={{ borderStyle: 'dashed', my: 5 }} />

        {renderOverview}

        <Divider sx={{ borderStyle: 'dashed', mt: 5, mb: 2 }} />

        {renderDescription}

        {renderInclusions}

        {renderExclusions}

        {renderAccommodation}

        {renderServices}
      </Stack>
    </>
  );
} 