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
  Timestamp,
  orderBy as firestoreOrderBy,
  serverTimestamp
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { IHajjItem, HAJJ_COLLECTION } from '@livve-1/database-types';

// Get Firestore instance from existing Firebase app
const db = getFirestore(getApp());

// Collection reference
const hajjCollection = collection(db, HAJJ_COLLECTION);

// Helper function to convert Firestore data to our model
const convertFirestoreDataToHajjItem = (doc: any): IHajjItem => {
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
  } as IHajjItem;
};

// Helper function to prepare data for Firestore
const prepareDataForFirestore = (data: Partial<IHajjItem>) => {
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

// Hajj CRUD operations
export const hajjFirestore = {
  // Get all Hajj packages
  getPackages: async (): Promise<IHajjItem[]> => {
    try {
      const q = query(hajjCollection, firestoreOrderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(convertFirestoreDataToHajjItem);
    } catch (error) {
      console.error('Error getting Hajj packages:', error);
      throw error;
    }
  },
  
  // Get a single Hajj package by ID
  getPackageById: async (id: string): Promise<IHajjItem | null> => {
    try {
      const docRef = doc(hajjCollection, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return convertFirestoreDataToHajjItem(docSnap);
    } catch (error) {
      console.error(`Error getting Hajj package with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Create a new Hajj package
  createPackage: async (data: Omit<IHajjItem, 'id'>): Promise<string> => {
    try {
      // Create a new document reference
      const newDocRef = doc(hajjCollection);
      
      // Prepare data for Firestore
      const firestoreData = prepareDataForFirestore(data);
      
      // Add createdAt field
      await setDoc(newDocRef, {
        ...firestoreData,
        createdAt: serverTimestamp()
      });
      
      return newDocRef.id;
    } catch (error) {
      console.error('Error creating Hajj package:', error);
      throw error;
    }
  },
  
  // Update an existing Hajj package
  updatePackage: async (id: string, data: Partial<IHajjItem>): Promise<void> => {
    try {
      const docRef = doc(hajjCollection, id);
      
      // Prepare data for Firestore
      const firestoreData = prepareDataForFirestore(data);
      
      // Add updatedAt field
      await updateDoc(docRef, {
        ...firestoreData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`Error updating Hajj package with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Delete a Hajj package
  deletePackage: async (id: string): Promise<void> => {
    try {
      const docRef = doc(hajjCollection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting Hajj package with ID ${id}:`, error);
      throw error;
    }
  }
}; 