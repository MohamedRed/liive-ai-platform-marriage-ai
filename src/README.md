# Marriage AI Application

This application provides tools and services for marriage-related assistance.

## Firebase Storage Integration

### Image Uploads for Hijra Domain

The Hijra domain uses Firebase Storage for image management. Images are uploaded to a dedicated folder in Firebase Storage:

- Folder: `hijra_images`
- Image naming pattern: `{timestamp}_{filename}`

The upload flow works as follows:

1. When users select files in the form, they are uploaded immediately to Firebase Storage
2. The download URLs are added to the form state
3. When the form is submitted, the image URLs are saved in Firestore

Delete operations:
- When removing a single image, it is deleted from both the form state and Firebase Storage
- When removing all images or canceling, all images are deleted from Firebase Storage

Implementation files:
- `src/services/firebase/storage.ts` - Firebase Storage service
- `src/sections/hijra/hijra-new-edit-form.tsx` - Form integration

### Setup

To use Firebase Storage, make sure your Firebase configuration includes storage settings in your environment variables:

```
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
``` 