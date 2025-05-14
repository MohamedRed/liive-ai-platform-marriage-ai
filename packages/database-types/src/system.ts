import { Timestamp as FirestoreTimestamp } from '@firebase/firestore-types';

// Core Type Definitions
export type Timestamp = FirestoreTimestamp;

export interface SystemMetadata {
  system: {
    apiVersion: string;
    schemaVersion: number;
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
  };
}

export interface Timestamping {
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}