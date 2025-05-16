import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy as firestoreOrderBy,
  serverTimestamp
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { IHijraItem, HIJRA_COLLECTION } from '@livve-1/database-types';

// Get Firestore instance from existing Firebase app
const db = getFirestore(getApp());

// Collection reference
const COLLECTION_NAME = 'hijra_packages';
const hijraCollection = collection(db, HIJRA_COLLECTION);

// Helper function to convert Firestore data to our model
const convertFirestoreDataToHijraItem = (doc: any): IHijraItem => {
  const data = doc.data();
  
  // Convert Firestore timestamps to Date objects
  const available = {
    startDate: data.available?.startDate?.toDate() || new Date(),
    endDate: data.available?.endDate?.toDate() || new Date()
  };
  
  return {
    id: doc.id,
    ...data,
    available,
    createdAt: data.createdAt?.toDate() || new Date()
  } as IHijraItem;
};

// Helper function to prepare data for Firestore
const prepareDataForFirestore = (data: Partial<IHijraItem>) => {
  const firestoreData = { ...data };
  
  // Convert dates to Firestore timestamps
  if (firestoreData.available) {
    const startDate = firestoreData.available.startDate 
      ? new Date(firestoreData.available.startDate) 
      : new Date();
      
    const endDate = firestoreData.available.endDate 
      ? new Date(firestoreData.available.endDate) 
      : new Date();
    
    // Create a temporary object to hold Firestore timestamps
    // We'll convert them to IDateValue (timestamp) when saved to Firestore
    const availableForFirestore = {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate)
    };
    
    // @ts-ignore - Firestore timestamps are compatible with IDateValue at runtime
    firestoreData.available = availableForFirestore;
  }
  
  // Remove id to avoid saving it to Firestore
  if ('id' in firestoreData) {
    delete firestoreData.id;
  }
  
  return firestoreData;
};

// Hijra CRUD operations
export const hijraFirestore = {
  // Get all Hijra packages
  getPackages: async (): Promise<IHijraItem[]> => {
    try {
      const q = query(hijraCollection, firestoreOrderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(convertFirestoreDataToHijraItem);
    } catch (error) {
      console.error('Error getting Hijra packages:', error);
      throw error;
    }
  },
  
  // Get a single Hijra package by ID
  getPackageById: async (id: string): Promise<IHijraItem | null> => {
    try {
      const docRef = doc(hijraCollection, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return convertFirestoreDataToHijraItem(docSnap);
    } catch (error) {
      console.error(`Error getting Hijra package with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Create a new Hijra package
  createPackage: async (data: Omit<IHijraItem, 'id'>): Promise<string> => {
    try {
      // Create a new document reference
      const newDocRef = doc(hijraCollection);
      
      // Prepare data for Firestore
      const firestoreData = prepareDataForFirestore(data);
      
      // Add createdAt field
      await setDoc(newDocRef, {
        ...firestoreData,
        createdAt: serverTimestamp()
      });
      
      return newDocRef.id;
    } catch (error) {
      console.error('Error creating Hijra package:', error);
      throw error;
    }
  },
  
  // Update an existing Hijra package
  updatePackage: async (id: string, data: Partial<IHijraItem>): Promise<void> => {
    try {
      const docRef = doc(hijraCollection, id);
      
      // Prepare data for Firestore
      const firestoreData = prepareDataForFirestore(data);
      
      // Add updatedAt field
      await updateDoc(docRef, {
        ...firestoreData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`Error updating Hijra package with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Delete a Hijra package
  deletePackage: async (id: string): Promise<void> => {
    try {
      const docRef = doc(hijraCollection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting Hijra package with ID ${id}:`, error);
      throw error;
    }
  }
}; 