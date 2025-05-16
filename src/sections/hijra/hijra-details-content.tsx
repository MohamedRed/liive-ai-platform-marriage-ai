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
import { HIJRA_SERVICE_OPTIONS } from 'src/_mock/_hijra';

import type { IHijraItem } from '@livve-1/database-types';

// ----------------------------------------------------------------------

type Props = {
  hijraPackage?: IHijraItem;
};

export function HijraDetailsContent({ hijraPackage }: Props) {
  const theme = useTheme();
  const [openGuides, setOpenGuides] = useState(false);
  const [openBenefits, setOpenBenefits] = useState(false);
  const [openRequirements, setOpenRequirements] = useState(false);
  const [openHousingOptions, setOpenHousingOptions] = useState(false);

  const slides = hijraPackage?.images.map((slide) => ({ src: slide })) || [];

  const {
    selected: selectedImage,
    open: openLightbox,
    onOpen: handleOpenLightbox,
    onClose: handleCloseLightbox,
  } = useLightBox(slides);

  const renderGallery = (
    <>
      <Box
        gap={1}
        display="grid"
        gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Image
          alt={slides[0]?.src || ''}
          src={slides[0]?.src || ''}
          ratio="1/1"
          onClick={() => slides[0] && handleOpenLightbox(slides[0].src)}
          sx={{
            borderRadius: 2,
            cursor: 'pointer',
            transition: (theme) => theme.transitions.create('opacity'),
            '&:hover': { opacity: 0.8 },
          }}
        />

        <Box gap={1} display="grid" gridTemplateColumns="repeat(2, 1fr)">
          {slides.slice(1, 5).map((slide) => (
            <Image
              key={slide.src}
              alt={slide.src}
              src={slide.src}
              ratio="1/1"
              onClick={() => handleOpenLightbox(slide.src)}
              sx={{
                borderRadius: 2,
                cursor: 'pointer',
                transition: (theme) => theme.transitions.create('opacity'),
                '&:hover': { opacity: 0.8 },
              }}
            />
          ))}
        </Box>
      </Box>

      <Lightbox
        index={selectedImage}
        slides={slides}
        open={openLightbox}
        close={handleCloseLightbox}
      />
    </>
  );

  const renderHead = (
    <>
      <Stack
        spacing={1}
        direction="row"
        alignItems="center"
        sx={{ mb: 2, color: 'primary.main' }}
      >
        <Iconify icon="solar:flag-bold" />
        <Typography variant="subtitle2">{hijraPackage?.destination}</Typography>
      </Stack>

      <Stack spacing={3} direction={{ xs: 'column', md: 'row' }}>
        <Typography variant="h3" sx={{ flexGrow: 1 }}>
          {hijraPackage?.name}
        </Typography>

        <Stack spacing={0.5} direction="row" alignItems="center">
          <Typography variant="h4">{fCurrency(hijraPackage?.price || 0)}</Typography>

          <Box
            sx={{
              typography: 'subtitle2',
              color: (theme) =>
                theme.palette.mode === 'light' ? 'text.secondary' : 'text.primary',
            }}
          >
            / person
          </Box>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Iconify icon="eva:star-fill" sx={{ color: 'warning.main' }} />
        <Typography variant="body2">{`${hijraPackage?.ratingNumber} (${hijraPackage?.clients.length} reviews)`}</Typography>
      </Stack>
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
          value: `${fDate(hijraPackage?.available.startDate)} - ${fDate(hijraPackage?.available.endDate)}`,
          icon: <Iconify icon="solar:calendar-date-bold" />,
        },
        {
          label: 'Contact Names',
          value: hijraPackage?.guides.map((guide) => guide.name).join(', '),
          icon: <Iconify icon="solar:user-rounded-bold" />,
        },
        {
          label: 'Duration',
          value: hijraPackage?.duration,
          icon: <Iconify icon="solar:clock-circle-bold" />,
        },
        {
          label: 'Contact Phones',
          value: hijraPackage?.guides.map((guide) => guide.phoneNumber).join(', '),
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

  const renderContent = (
    <>
      <Markdown children={hijraPackage?.content} />

      <Stack spacing={3} sx={{ mt: 5 }}>
        <Typography variant="h6">Services</Typography>

        <Box
          rowGap={2}
          display="grid"
          gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
        >
          {HIJRA_SERVICE_OPTIONS.map((service) => (
            <Stack
              key={service.label}
              spacing={1}
              direction="row"
              alignItems="center"
              sx={{
                ...(!(hijraPackage?.services.includes(service.value)) && { color: 'text.disabled' }),
              }}
            >
              <Iconify
                icon={
                  hijraPackage?.services.includes(service.value)
                    ? 'eva:checkmark-circle-2-fill'
                    : 'eva:checkmark-circle-2-outline'
                }
                sx={{
                  color: hijraPackage?.services.includes(service.value)
                    ? 'primary.main'
                    : 'text.disabled',
                }}
              />
              {service.label}
            </Stack>
          ))}
        </Box>
      </Stack>

      {/* Guides Section */}
      <Stack spacing={3} sx={{ mt: 5 }}>
        <Button
          color="inherit"
          onClick={() => setOpenGuides(!openGuides)}
          endIcon={
            <Iconify
              icon={
                openGuides ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          }
          sx={{ justifyContent: 'space-between', fontWeight: 'fontWeightMedium' }}
        >
          <Typography variant="h6">Your guides in {hijraPackage?.destination}</Typography>
        </Button>

        <Collapse in={openGuides}>
          <Box
            gap={3}
            display="grid"
            gridTemplateColumns={{ xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
          >
            {hijraPackage?.guides.map((guide) => (
              <Card key={guide.id} sx={{ p: 2 }}>
                <Stack spacing={2} alignItems="center">
                  <Image
                    alt={guide.name}
                    src={guide.avatarUrl}
                    sx={{ borderRadius: '50%', width: 80, height: 80 }}
                  />
                  <ListItemText
                    primary={guide.name}
                    secondary={`${guide.yearsInCountry} years in ${hijraPackage.destination}`}
                    primaryTypographyProps={{ align: 'center', typography: 'subtitle1' }}
                    secondaryTypographyProps={{ align: 'center', component: 'span' }}
                  />
                  <Stack direction="row" spacing={1}>
                    {guide.languages.map((language) => (
                      <Chip key={language} label={language} size="small" />
                    ))}
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Box>
        </Collapse>
      </Stack>

      {/* Benefits Section */}
      <Stack spacing={3} sx={{ mt: 5 }}>
        <Button
          color="inherit"
          onClick={() => setOpenBenefits(!openBenefits)}
          endIcon={
            <Iconify
              icon={
                openBenefits ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          }
          sx={{ justifyContent: 'space-between', fontWeight: 'fontWeightMedium' }}
        >
          <Typography variant="h6">Package benefits</Typography>
        </Button>

        <Collapse in={openBenefits}>
          <Box
            rowGap={2}
            display="grid"
            gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
          >
            {hijraPackage?.benefits.map((benefit) => (
              <Stack key={benefit} spacing={1} direction="row" alignItems="center">
                <Iconify icon="eva:checkmark-circle-2-fill" sx={{ color: 'success.main' }} />
                {benefit}
              </Stack>
            ))}
          </Box>
        </Collapse>
      </Stack>

      {/* Requirements Section */}
      <Stack spacing={3} sx={{ mt: 5 }}>
        <Button
          color="inherit"
          onClick={() => setOpenRequirements(!openRequirements)}
          endIcon={
            <Iconify
              icon={
                openRequirements ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          }
          sx={{ justifyContent: 'space-between', fontWeight: 'fontWeightMedium' }}
        >
          <Typography variant="h6">Requirements</Typography>
        </Button>

        <Collapse in={openRequirements}>
          <Box
            rowGap={2}
            display="grid"
            gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
          >
            {hijraPackage?.requirements.map((requirement) => (
              <Stack key={requirement} spacing={1} direction="row" alignItems="center">
                <Iconify icon="eva:arrow-right-fill" sx={{ color: 'info.main' }} />
                {requirement}
              </Stack>
            ))}
          </Box>
        </Collapse>
      </Stack>

      {/* Housing Options Section */}
      <Stack spacing={3} sx={{ mt: 5, mb: 5 }}>
        <Button
          color="inherit"
          onClick={() => setOpenHousingOptions(!openHousingOptions)}
          endIcon={
            <Iconify
              icon={
                openHousingOptions ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          }
          sx={{ justifyContent: 'space-between', fontWeight: 'fontWeightMedium' }}
        >
          <Typography variant="h6">Housing options</Typography>
        </Button>

        <Collapse in={openHousingOptions}>
          <Box
            rowGap={2}
            display="grid"
            gridTemplateColumns={{ xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
          >
            {hijraPackage?.housingOptions.map((option) => (
              <Stack key={option} spacing={1} direction="row" alignItems="center">
                <Iconify icon="eva:home-fill" sx={{ color: 'warning.main' }} />
                {option}
              </Stack>
            ))}
          </Box>
        </Collapse>
      </Stack>

      <Divider sx={{ borderStyle: 'dashed', mt: 5, mb: 5 }} />

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          component={RouterLink}
          href="#contact"
          color="inherit"
          variant="outlined"
          size="large"
          startIcon={<Iconify icon="eva:email-fill" />}
        >
          Contact
        </Button>
        <Button
          component={RouterLink}
          href="#book"
          variant="contained"
          size="large"
          startIcon={<Iconify icon="solar:book-bold" />}
        >
          Book Now
        </Button>
      </Stack>
    </>
  );

  return (
    <>
      {renderGallery}

      <Stack sx={{ maxWidth: 720, mx: 'auto' }}>
        {renderHead}

        <Divider sx={{ borderStyle: 'dashed', my: 5 }} />

        {renderOverview}

        <Divider sx={{ borderStyle: 'dashed', mt: 5, mb: 2 }} />

        {renderContent}
      </Stack>
    </>
  );
} 