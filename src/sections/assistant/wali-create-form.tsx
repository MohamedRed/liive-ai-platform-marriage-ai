import type {IUserItem} from 'src/types/user';
import type {UpdateData, DocumentReference, Timestamp} from "firebase/firestore";

import {z as zod} from 'zod';
import {firstValueFrom} from "rxjs";
import {useForm} from 'react-hook-form';
import {httpsCallable} from "rxfire/functions";
import {useMemo, useState, useEffect} from 'react';
import {zodResolver} from '@hookform/resolvers/zod';
import {doc, getDoc, updateDoc} from "firebase/firestore";
import {isValidPhoneNumber} from 'react-phone-number-input/input';
import {useFirestore, useFunctions, useFirestoreDocData} from "reactfire";

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from "@mui/material/Typography";
import LoadingButton from '@mui/lab/LoadingButton';

import {toast} from 'src/components/snackbar';
import {Form, Field, schemaHelper} from 'src/components/hook-form';

import {Label} from "../../components/label";
import {useAuthContext} from "../../auth/hooks";
import { 
  COLLECTIONS, 
  UserInfo,
  WaliUserProvidedInfo,
  WaliInfo,
  RelationshipType
} from '@liive-marriage-ai/database-types';

// ----------------------------------------------------------------------

export type UserProfileType = {
  id?: string; // Firestore document ID
  questions_answers: {question: string, answer: string, createdAt: number}[];
  wali?: {
    firebaseUID: string;
    relationship: string; // e.g., "father", "brother", "uncle"
  };
  identityVerification: {
    sessionID: string;
    status: string; // e.g., "verified", "pending"
    updatedAt: Timestamp;
  };
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dob?: { day: number; month: number; year: number }; // Optional Date of Birth
  address?: {
    city?: string;
  };
};

export type NewWaliSchemaType = zod.infer<typeof NewWaliSchema>;

export const NewWaliSchema = zod.object({
  firstName: zod.string().min(1, { message: 'First name is required!' }),
  lastName: zod.string().min(1, { message: 'Last name is required!' }),
  email: zod
    .string()
    .min(1, { message: 'Email is required!' })
    .email({ message: 'Email must be a valid email address!' }),
  phoneNumber: schemaHelper.phoneNumber({ isValidPhoneNumber }),
  country: schemaHelper.objectOrNull<string | null>({
    message: { required_error: 'Country is required!' },
  }),
  address: zod.string().min(1, { message: 'Address is required!' }),
  state: zod.string().min(1, { message: 'State is required!' }),
  city: zod.string().min(1, { message: 'City is required!' }),
  relationship: zod.nativeEnum(RelationshipType),
  zipCode: zod.string().min(1, { message: 'Zip code is required!' }),
});

export type WaliProfileType = {initialInformation: NewWaliSchemaType, onboardedInformation: NewWaliSchemaType}

interface CreateWaliResponse {
  result: string;
}

// ----------------------------------------------------------------------

type Props = {
  currentUser?: IUserItem & {firstName: string, lastName: string, relationship: string};
};

export function WaliCreateForm({ currentUser }: Props) {
  const { user } = useAuthContext();
  const firestore = useFirestore();
  const functions = useFunctions();

  const [waliProfile, setWaliProfile] = useState<Partial<NewWaliSchemaType>>({});

  if (!user) return null;
  
  const userRef = doc(firestore, COLLECTIONS.USER_INFO, user.id);
  const { data: userProfile } = useFirestoreDocData(userRef);

  // Fetch the Wali data if available
  useEffect(() => {
    const fetchWaliData = async () => {
      if (userProfile?.wali?.firebaseUID) {
        const waliRef = doc(firestore, COLLECTIONS.WALI_USER_PROVIDED_INFO, userProfile.wali.firebaseUID);
        try {
          const waliDoc = await getDoc(waliRef);
          if (waliDoc.exists()) {
            const profile = waliDoc.data() as WaliUserProvidedInfo;
            setWaliProfile({
              firstName: profile.personalInfo.name.firstName,
              lastName: profile.personalInfo.name.lastName,
              email: profile.personalInfo.contact.email,
              phoneNumber: profile.personalInfo.contact.phoneNumber,
              country: profile.personalInfo.address.country,
              state: profile.personalInfo.address.state,
              city: profile.personalInfo.address.city,
              address: profile.personalInfo.address.street,
              relationship: profile.relationship as RelationshipType,
              zipCode: profile.personalInfo.address.postalCode,
            });
          }
        } catch (error) {
          console.error('Error fetching Wali profile:', error);
        }
      }
    };
    fetchWaliData();
  }, [userProfile, firestore]);

  const defaultValues = useMemo(
    () => ({
      firstName: waliProfile?.firstName || '',
      lastName: waliProfile?.lastName || '',
      email: waliProfile?.email || '',
      phoneNumber: waliProfile?.phoneNumber || '',
      country: waliProfile?.country || '',
      state: waliProfile?.state || '',
      city: waliProfile?.city || '',
      address: waliProfile?.address || '',
      zipCode: waliProfile?.zipCode || '',
      relationship: (waliProfile?.relationship as RelationshipType) || RelationshipType.OTHER,
    }),
    [waliProfile]
  );

  const methods = useForm<NewWaliSchemaType>({
    mode: 'onSubmit',
    resolver: zodResolver(NewWaliSchema),
    defaultValues,
  });

  const { reset, handleSubmit, formState: { isSubmitting, isDirty } } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!waliProfile || Object.keys(waliProfile).length === 0) {
        // Create a new Wali profile
        const remoteCreateWali = httpsCallable(functions, 'createWali');
        const { result } = await firstValueFrom(remoteCreateWali({ ...data })) as CreateWaliResponse;
        if (result !== 'success') throw new Error('Failed to create the Wali profile.');
        toast.success('Wali profile created successfully!');
      } else {
        // Update existing Wali profile
        const waliRef = doc(firestore, COLLECTIONS.WALI_USER_PROVIDED_INFO, userProfile.wali.firebaseUID);
        const normalizedData = NewWaliSchema.parse(data);
        await updateDoc(waliRef, {
          personalInfo: {
            name: {
              firstName: normalizedData.firstName,
              lastName: normalizedData.lastName,
            },
            contact: {
              email: normalizedData.email,
              phoneNumber: normalizedData.phoneNumber,
            },
            address: {
              street: normalizedData.address,
              city: normalizedData.city,
              state: normalizedData.state,
              country: normalizedData.country,
              postalCode: normalizedData.zipCode,
            },
          },
          relationship: normalizedData.relationship,
        });
        toast.success('Wali profile updated successfully!');
      }
    } catch (error) {
      console.error('Error saving Wali profile:', error);
      toast.error('Failed to save the Wali profile.');
    }
  });

  /* <Label
            variant={
              ((tab.value === 'all' || tab.value === filters.state.status) && 'filled') ||
              'soft'
            }
            color={
              (tab.value === 'validated' && 'success') ||
              (tab.value === 'pending' && 'warning') ||
              (tab.value === 'rejected' && 'error') ||
              'default'
            }
          >
            {['completed', 'pending', 'cancelled', 'refunded'].includes(tab.value)
              ? tableData.filter((user) => user.status === tab.value).length
              : tableData.length}
          </Label>
   */

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Box
        sx={{
          height: "100vh", // Full viewport height
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Scrollable Form Content */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto", // Enable scrolling for the content
            padding: 3,
            paddingBottom: "100px", // Reserve space for the sticky button
          }}
        >
          <Box sx={{display: "flex", alignItems: "center", pb:5}}>
              <Typography variant="h2" sx={{pr: 2}}>Wali profile</Typography>
              <Label
                variant="filled"
                color="warning"
              >
                Pending
              </Label>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Field.Text name="firstName" label="First Name" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="lastName" label="Last Name" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="relationship" label="Relationship" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="email" label="Email Address" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Phone name="phoneNumber" label="Phone Number" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.CountrySelect name="country" label="Country" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="state" label="State/Region" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="city" label="City" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="address" label="Address" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field.Text name="zipCode" label="Zip Code" />
            </Grid>
          </Grid>
        </Box>

        {/* Sticky Save Button */}
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "white",
            zIndex: 1000,
            padding: 2,
            borderTop: "1px solid #ddd",
          }}
        >
          <LoadingButton
            type="submit"
            variant="contained"
            fullWidth
            loading={isSubmitting}
            disabled={!isDirty || isSubmitting}
          >
            Save
          </LoadingButton>
        </Box>
      </Box>
    </Form>  );
}
