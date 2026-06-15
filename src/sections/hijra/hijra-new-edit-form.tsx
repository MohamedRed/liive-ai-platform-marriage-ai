import type { IHijraItem } from '@livve-1/database-types';

import { useMemo, useEffect, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import { toast } from 'sonner';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { Form, Field } from 'src/components/hook-form';

import { HIJRA_DESTINATION_OPTIONS } from 'src/_mock/_hijra';
import { HIJRA_SERVICE_OPTIONS } from '@livve-1/database-types';
import { hijraFirestore } from 'src/services/firebase/hijra';
import { firebaseStorage } from 'src/services/firebase/storage';

// ----------------------------------------------------------------------

type Props = {
  currentPackage?: IHijraItem;
};

export function HijraNewEditForm({ currentPackage }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const NewHijraSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    content: z.string().min(1, 'Content is required'),
    images: z.array(z.any()).min(1, 'Images is required'),
    duration: z.string().min(1, 'Duration is required'),
    price: z.number().min(0, 'Price should not be $0.00'),
    destination: z.string().min(1, 'Destination is required'),
    services: z.array(z.string()).min(1, 'Services is required'),
    priceSale: z.number().optional(),
    tags: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
    benefits: z.array(z.string()).optional(),
    housingOptions: z.array(z.string()).optional(),
    available: z.object({
      startDate: z.any(),
      endDate: z.any()
    }).optional(),
    guides: z.array(z.any()).optional(),
    clients: z.array(z.any()).optional()
  });

  const defaultValues = useMemo(
    () => ({
      name: currentPackage?.name || '',
      content: currentPackage?.content || '',
      images: currentPackage?.images || [],
      duration: currentPackage?.duration || '',
      price: currentPackage?.price || 0,
      priceSale: currentPackage?.priceSale || 0,
      tags: currentPackage?.tags || [],
      services: currentPackage?.services || [],
      destination: currentPackage?.destination || '',
      requirements: currentPackage?.requirements || [],
      benefits: currentPackage?.benefits || [],
      housingOptions: currentPackage?.housingOptions || [],
      available: currentPackage?.available || {
        startDate: Date.now(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).getTime(),
      },
      guides: currentPackage?.guides || [],
      clients: currentPackage?.clients || []
    }),
    [currentPackage]
  );

  const methods = useForm({
    resolver: zodResolver(NewHijraSchema),
    defaultValues,
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting: formIsSubmitting },
  } = methods;

  useEffect(() => {
    if (currentPackage) {
      reset(defaultValues);
    }
  }, [currentPackage, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      setIsSubmitting(true);
      
      if (currentPackage?.id) {
        // Update existing package
        await hijraFirestore.updatePackage(currentPackage.id, data);
        toast.success('Package updated successfully!');
      } else {
        // Create new package
        await hijraFirestore.createPackage(data as Omit<IHijraItem, 'id'>);
        toast.success('Package created successfully!');
      }
      
      reset();
      router.push(paths.dashboard.hijra.root);
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Error saving package');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleRemoveFile = useCallback(
    async (inputFile: File | string) => {
      try {
        const fileUrl = typeof inputFile === 'string' ? inputFile : '';
        
        // If it's a Firebase Storage URL, delete it
        if (fileUrl && fileUrl.startsWith('https://firebasestorage.googleapis.com')) {
          await firebaseStorage.deleteFile(fileUrl);
        }
        
        // Remove from form state
        const filtered = watch('images').filter((file: File | string) => file !== inputFile);
        setValue('images', filtered);
      } catch (error) {
        console.error('Error removing file:', error);
        toast.error('Error removing image');
      }
    },
    [setValue, watch]
  );

  const handleRemoveAllFiles = useCallback(async () => {
    try {
      const currentImages = watch('images');
      
      // Delete all Firebase Storage images
      await Promise.all(
        currentImages
          .filter((url: any) => typeof url === 'string' && url.startsWith('https://firebasestorage.googleapis.com'))
          .map((url: string) => firebaseStorage.deleteFile(url))
      );
      
      // Clear images in form
      setValue('images', []);
    } catch (error) {
      console.error('Error removing all files:', error);
      toast.error('Error removing images');
    }
  }, [setValue, watch]);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      try {
        setUploadingImages(true);
        
        // Upload files to Firebase Storage and get URLs
        const uploadedUrls = await firebaseStorage.uploadMultipleFiles(files);
        
        // Add URLs to the form state
        const currentImages = watch('images') || [];
        setValue('images', [...currentImages, ...uploadedUrls]);
        
        toast.success(`${uploadedUrls.length} images uploaded successfully`);
      } catch (error) {
        console.error('Error uploading images:', error);
        toast.error('Error uploading images');
      } finally {
        setUploadingImages(false);
      }
    },
    [setValue, watch]
  );

  const renderDetails = (
    <Card>
      <CardHeader title="Details" subheader="Title, description, images..." sx={{ mb: 3 }} />

      <Divider />

      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Name</Typography>
            <Field.Text name="name" placeholder="Ex: Hijra to Istanbul..." />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Content</Typography>
            <Field.Editor name="content" sx={{ height: 500 }} />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Images</Typography>
            <Field.Upload
              multiple
              thumbnail
              name="images"
              maxSize={3145728}
              onRemove={handleRemoveFile}
              onRemoveAll={handleRemoveAllFiles}
              helperText="Maximum 5 images, 3MB each"
              onDrop={async (files) => {
                if (files && files.length > 0) {
                  await handleUploadFiles(files);
                }
              }}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderProperties = (
    <Card>
      <CardHeader title="Properties" subheader="Additional package details..." sx={{ mb: 3 }} />

      <Divider />

      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Duration</Typography>
            <Field.Text name="duration" placeholder="Ex: 3 months" />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Destination</Typography>
            <Field.Select
              name="destination"
              label="Destination"
              placeholder="Select a destination"
            >
              {HIJRA_DESTINATION_OPTIONS.map((option) => (
                <option key={option.code} value={option.label}>
                  {option.label}
                </option>
              ))}
            </Field.Select>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Services</Typography>
            <Field.MultiCheckbox
              name="services"
              options={HIJRA_SERVICE_OPTIONS.map((service) => ({
                value: service.value,
                label: service.label
              }))}
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Price</Typography>
            <Field.Text
              name="price"
              placeholder="0.00"
              type="number"
              InputProps={{ startAdornment: '$' }}
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Sale Price</Typography>
            <Field.Text
              name="priceSale"
              placeholder="0.00"
              type="number"
              InputProps={{ startAdornment: '$' }}
              helperText="Sale price must be lower than regular price"
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Tags</Typography>
            <Field.Autocomplete
              name="tags"
              placeholder="+ Tags"
              multiple
              freeSolo
              disableCloseOnSelect
              options={[]}
              renderTags={(selected, getTagProps) =>
                selected.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                    color="info"
                    variant="soft"
                  />
                ))
              }
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Benefits</Typography>
            <Field.Autocomplete
              name="benefits"
              placeholder="+ Benefits"
              multiple
              freeSolo
              disableCloseOnSelect
              options={[]}
              renderTags={(selected, getTagProps) =>
                selected.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                    color="success"
                    variant="soft"
                  />
                ))
              }
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Requirements</Typography>
            <Field.Autocomplete
              name="requirements"
              placeholder="+ Requirements"
              multiple
              freeSolo
              disableCloseOnSelect
              options={[]}
              renderTags={(selected, getTagProps) =>
                selected.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                    color="warning"
                    variant="soft"
                  />
                ))
              }
            />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Housing Options</Typography>
            <Field.Autocomplete
              name="housingOptions"
              placeholder="+ Housing Options"
              multiple
              freeSolo
              disableCloseOnSelect
              options={[]}
              renderTags={(selected, getTagProps) =>
                selected.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                    color="primary"
                    variant="soft"
                  />
                ))
              }
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderActions = (
    <Stack direction="row" alignItems="center" flexWrap="wrap">
      <FormControlLabel
        control={<Switch defaultChecked inputProps={{ id: 'publish-switch' }} />}
        label="Publish"
        sx={{ flexGrow: 1, pl: 3 }}
      />

      <LoadingButton
        type="submit"
        variant="contained"
        size="large"
        loading={isSubmitting}
        sx={{ ml: 2 }}
      >
        {!currentPackage ? 'Create package' : 'Save changes'}
      </LoadingButton>
    </Stack>
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={{ xs: 3, md: 5 }} sx={{ mx: 'auto', maxWidth: { xs: 720, xl: 880 } }}>
        {renderDetails}

        {renderProperties}

        {renderActions}
      </Stack>
    </Form>
  );
} 