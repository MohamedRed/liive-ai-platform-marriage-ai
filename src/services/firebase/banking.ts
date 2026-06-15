import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  getFirestore
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { 
  IBankingAccount, 
  IBankingCard, 
  IBankingTransaction, 
  IBankingContact,
  IBankingBudget,
  IBankingNotification,
  IFinancialAccount,
  ICashBackReward,
  IBankingSettings
} from '@livve-1/database-types';

// Get Firestore instance from existing Firebase app
const db = getFirestore(getApp());

// ----------------------------------------------------------------------

// Converter functions for date fields
const convertFirestoreTimestampsToDates = (data: any) => {
  const result = { ...data };
  
  Object.keys(result).forEach((key) => {
    // Convert Timestamp objects to Date
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate();
    }
    
    // Recursively convert nested objects
    if (result[key] && typeof result[key] === 'object' && !(result[key] instanceof Date)) {
      result[key] = convertFirestoreTimestampsToDates(result[key]);
    }
  });
  
  return result;
};

const convertDatesToFirestoreTimestamps = (data: any) => {
  const result = { ...data };
  
  Object.keys(result).forEach((key) => {
    // Convert Date objects to Timestamp
    if (result[key] instanceof Date) {
      result[key] = Timestamp.fromDate(result[key]);
    }
    
    // Recursively convert nested objects
    if (result[key] && typeof result[key] === 'object' && !(result[key] instanceof Timestamp)) {
      result[key] = convertDatesToFirestoreTimestamps(result[key]);
    }
  });
  
  return result;
};

// ----------------------------------------------------------------------
// Banking Account Services

export const getBankingAccounts = async (userId: string): Promise<IBankingAccount[]> => {
  try {
    const accountsRef = collection(db, 'bankingAccounts');
    const q = query(accountsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingAccount[];
    
    return accounts;
  } catch (error) {
    console.error('Error getting banking accounts:', error);
    throw error;
  }
};

export const getBankingAccount = async (accountId: string): Promise<IBankingAccount | null> => {
  try {
    const accountRef = doc(db, 'bankingAccounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (accountSnap.exists()) {
      return {
        id: accountSnap.id,
        ...convertFirestoreTimestampsToDates(accountSnap.data()),
      } as IBankingAccount;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting banking account:', error);
    throw error;
  }
};

export const createBankingAccount = async (account: Omit<IBankingAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<IBankingAccount> => {
  try {
    const accountRef = doc(collection(db, 'bankingAccounts'));
    
    const newAccount = {
      ...account,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(accountRef, convertDatesToFirestoreTimestamps(newAccount));
    
    const createdAccount = await getDoc(accountRef);
    
    return {
      id: accountRef.id,
      ...convertFirestoreTimestampsToDates(createdAccount.data() as any),
    } as IBankingAccount;
  } catch (error) {
    console.error('Error creating banking account:', error);
    throw error;
  }
};

export const updateBankingAccount = async (accountId: string, account: Partial<IBankingAccount>): Promise<void> => {
  try {
    const accountRef = doc(db, 'bankingAccounts', accountId);
    
    const updatedAccount = {
      ...account,
      updatedAt: serverTimestamp(),
    };
    
    await updateDoc(accountRef, convertDatesToFirestoreTimestamps(updatedAccount));
  } catch (error) {
    console.error('Error updating banking account:', error);
    throw error;
  }
};

export const deleteBankingAccount = async (accountId: string): Promise<void> => {
  try {
    const accountRef = doc(db, 'bankingAccounts', accountId);
    await deleteDoc(accountRef);
  } catch (error) {
    console.error('Error deleting banking account:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------
// Banking Card Services

export const getBankingCards = async (userId: string): Promise<IBankingCard[]> => {
  try {
    const cardsRef = collection(db, 'bankingCards');
    const q = query(cardsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const cards = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingCard[];
    
    return cards;
  } catch (error) {
    console.error('Error getting banking cards:', error);
    throw error;
  }
};

export const getBankingCardsByAccount = async (accountId: string): Promise<IBankingCard[]> => {
  try {
    const cardsRef = collection(db, 'bankingCards');
    const q = query(cardsRef, where('accountId', '==', accountId), orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const cards = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingCard[];
    
    return cards;
  } catch (error) {
    console.error('Error getting banking cards by account:', error);
    throw error;
  }
};

export const getBankingCard = async (cardId: string): Promise<IBankingCard | null> => {
  try {
    const cardRef = doc(db, 'bankingCards', cardId);
    const cardSnap = await getDoc(cardRef);
    
    if (cardSnap.exists()) {
      return {
        id: cardSnap.id,
        ...convertFirestoreTimestampsToDates(cardSnap.data()),
      } as IBankingCard;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting banking card:', error);
    throw error;
  }
};

export const createBankingCard = async (card: Omit<IBankingCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<IBankingCard> => {
  try {
    const cardRef = doc(collection(db, 'bankingCards'));
    
    const newCard = {
      ...card,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(cardRef, convertDatesToFirestoreTimestamps(newCard));
    
    const createdCard = await getDoc(cardRef);
    
    return {
      id: cardRef.id,
      ...convertFirestoreTimestampsToDates(createdCard.data() as any),
    } as IBankingCard;
  } catch (error) {
    console.error('Error creating banking card:', error);
    throw error;
  }
};

export const updateBankingCard = async (cardId: string, card: Partial<IBankingCard>): Promise<void> => {
  try {
    const cardRef = doc(db, 'bankingCards', cardId);
    
    const updatedCard = {
      ...card,
      updatedAt: serverTimestamp(),
    };
    
    await updateDoc(cardRef, convertDatesToFirestoreTimestamps(updatedCard));
  } catch (error) {
    console.error('Error updating banking card:', error);
    throw error;
  }
};

export const deleteBankingCard = async (cardId: string): Promise<void> => {
  try {
    const cardRef = doc(db, 'bankingCards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    console.error('Error deleting banking card:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------
// Banking Transaction Services

export const getBankingTransactions = async (
  userId: string, 
  limitCount: number = 20
): Promise<IBankingTransaction[]> => {
  try {
    const transactionsRef = collection(db, 'bankingTransactions');
    const q = query(
      transactionsRef, 
      where('userId', '==', userId), 
      orderBy('date', 'desc'), 
      firestoreLimit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingTransaction[];
    
    return transactions;
  } catch (error) {
    console.error('Error getting banking transactions:', error);
    throw error;
  }
};

export const getBankingTransactionsByAccount = async (
  accountId: string, 
  limitCount: number = 20
): Promise<IBankingTransaction[]> => {
  try {
    const transactionsRef = collection(db, 'bankingTransactions');
    const q = query(
      transactionsRef, 
      where('accountId', '==', accountId), 
      orderBy('date', 'desc'), 
      firestoreLimit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingTransaction[];
    
    return transactions;
  } catch (error) {
    console.error('Error getting banking transactions by account:', error);
    throw error;
  }
};

export const createBankingTransaction = async (
  transaction: Omit<IBankingTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IBankingTransaction> => {
  try {
    const transactionRef = doc(collection(db, 'bankingTransactions'));
    
    const newTransaction = {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(transactionRef, convertDatesToFirestoreTimestamps(newTransaction));
    
    const createdTransaction = await getDoc(transactionRef);
    
    return {
      id: transactionRef.id,
      ...convertFirestoreTimestampsToDates(createdTransaction.data() as any),
    } as IBankingTransaction;
  } catch (error) {
    console.error('Error creating banking transaction:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------
// Banking Contact Services

export const getBankingContacts = async (userId: string): Promise<IBankingContact[]> => {
  try {
    const contactsRef = collection(db, 'bankingContacts');
    const q = query(contactsRef, where('userId', '==', userId), orderBy('name', 'asc'));
    
    const querySnapshot = await getDocs(q);
    const contacts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertFirestoreTimestampsToDates(doc.data()),
    })) as IBankingContact[];
    
    return contacts;
  } catch (error) {
    console.error('Error getting banking contacts:', error);
    throw error;
  }
};

export const createBankingContact = async (
  contact: Omit<IBankingContact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IBankingContact> => {
  try {
    const contactRef = doc(collection(db, 'bankingContacts'));
    
    const newContact = {
      ...contact,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(contactRef, convertDatesToFirestoreTimestamps(newContact));
    
    const createdContact = await getDoc(contactRef);
    
    return {
      id: contactRef.id,
      ...convertFirestoreTimestampsToDates(createdContact.data() as any),
    } as IBankingContact;
  } catch (error) {
    console.error('Error creating banking contact:', error);
    throw error;
  }
};

export const updateBankingContact = async (
  contactId: string, 
  contact: Partial<IBankingContact>
): Promise<void> => {
  try {
    const contactRef = doc(db, 'bankingContacts', contactId);
    
    const updatedContact = {
      ...contact,
      updatedAt: serverTimestamp(),
    };
    
    await updateDoc(contactRef, convertDatesToFirestoreTimestamps(updatedContact));
  } catch (error) {
    console.error('Error updating banking contact:', error);
    throw error;
  }
};

export const deleteBankingContact = async (contactId: string): Promise<void> => {
  try {
    const contactRef = doc(db, 'bankingContacts', contactId);
    await deleteDoc(contactRef);
  } catch (error) {
    console.error('Error deleting banking contact:', error);
    throw error;
  }
}; 