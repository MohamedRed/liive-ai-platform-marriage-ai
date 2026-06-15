import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApp } from 'firebase/app';

// Get Storage instance from existing Firebase app
const storage = getStorage(getApp());

// Define folder paths for different upload types
const FOLDERS = {
  HIJRA_IMAGES: 'hijra_images',
  PROFILE_IMAGES: 'profile_images',
};

export const firebaseStorage = {
  /**
   * Upload a single file to Firebase Storage
   * @param file File to upload
   * @param folder Folder path in storage
   * @returns Promise with the download URL
   */
  uploadFile: async (file: File, folder: string = FOLDERS.HIJRA_IMAGES): Promise<string> => {
    try {
      // Generate a unique filename to avoid collisions
      const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `${folder}/${uniqueFileName}`);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);
      
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },
  
  /**
   * Upload multiple files to Firebase Storage
   * @param files Array of files to upload
   * @param folder Folder path in storage
   * @returns Promise with array of download URLs
   */
  uploadMultipleFiles: async (files: File[], folder: string = FOLDERS.HIJRA_IMAGES): Promise<string[]> => {
    try {
      const uploadPromises = files.map(file => firebaseStorage.uploadFile(file, folder));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    }
  },
  
  /**
   * Delete a file from Firebase Storage by URL
   * @param url The file URL to delete
   * @returns Promise<void>
   */
  deleteFile: async (url: string): Promise<void> => {
    try {
      // Extract the file path from the URL
      const fileRef = ref(storage, getPathFromUrl(url));
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },
  
  /**
   * Get the folder constants
   */
  FOLDERS
};

/**
 * Helper function to extract file path from Firebase Storage URL
 */
function getPathFromUrl(url: string): string {
  try {
    // Firebase Storage URLs follow this pattern:
    // https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[encoded_path]?alt=media&token=[token]
    
    // Extract the encoded path
    const match = url.match(/\/o\/(.+?)\?/);
    if (!match || !match[1]) {
      throw new Error('Invalid Firebase Storage URL format');
    }
    
    // Decode the path
    const decodedPath = decodeURIComponent(match[1]);
    return decodedPath;
  } catch (error) {
    console.error('Error extracting path from URL:', error);
    throw error;
  }
} 