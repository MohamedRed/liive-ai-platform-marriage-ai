import { onCall } from "firebase-functions/v2/https";
import * as functions from 'firebase-functions/v1';
import { logger } from "firebase-functions";
import * as admin from 'firebase-admin';
import { firestore } from "firebase-admin";
import { UserRecord } from "firebase-admin/auth";

import { 
  UserInfo,
  UserSettings,
  LEGACY_COLLECTIONS
} from '@livve-1/database-types';

/**
 * Get user profile information
 */
export async function getUserProfile(userID: string): Promise<UserInfo> {
  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    const userDoc = await db
      .collection(LEGACY_COLLECTIONS.USER_INFO)
      .doc(userID)
      .get();

    if (!userDoc.exists) {
      throw new Error(`User profile not found for ID: ${userID}`);
    }

    return userDoc.data() as UserInfo;
  } catch (error) {
    console.error(`Error retrieving user profile for ${userID}:`, error);
    throw new Error("Failed to retrieve user profile");
  }
}

/**
 * Get user notification settings
 */
export async function getUserSettings(userID: string): Promise<UserSettings | null> {
  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    const settingsDoc = await db
      .collection(LEGACY_COLLECTIONS.USER_SETTINGS)
      .doc(userID)
      .get();

    if (!settingsDoc.exists) {
      return null;
    }

    return settingsDoc.data() as UserSettings;
  } catch (error) {
    console.error(`Error retrieving user settings for ${userID}:`, error);
    return null;
  }
}

/**
 * Update user profile information
 */
export const updateUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Unauthorized. You must be logged in to update your profile.");
  }

  const userID = request.auth.uid;
  const data = request.data;
  const timestamp = firestore.Timestamp.now();

  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    
    // Validate data fields here...
    
    await db
      .collection(LEGACY_COLLECTIONS.USER_INFO)
      .doc(userID)
      .update({
        ...data,
        updatedAt: timestamp
      });

    logger.info(`User profile updated for ${userID}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error updating user profile for ${userID}:`, error);
    throw new Error("Failed to update user profile");
  }
});

/**
 * Update user notification settings
 */
export const updateUserSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Unauthorized. You must be logged in to update your settings.");
  }

  const userID = request.auth.uid;
  const settings = request.data;
  const timestamp = firestore.Timestamp.now();

  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    
    // Validate settings here...
    
    await db
      .collection(LEGACY_COLLECTIONS.USER_SETTINGS)
      .doc(userID)
      .set({
        ...settings,
        updatedAt: timestamp
      }, { merge: true });

    logger.info(`User settings updated for ${userID}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error updating user settings for ${userID}:`, error);
    throw new Error("Failed to update user settings");
  }
});

/**
 * Creates initial documents for a newly created user.
 * Triggered when a new Firebase Authentication user is created.
 */
export const createUserDocuments = functions.auth.user().onCreate(async (user: UserRecord) => {
  const userID: string = user.uid;
  const email: string | undefined = user.email;
  const displayName: string | undefined = user.displayName;
  const timestamp = firestore.Timestamp.now();

  logger.info(`New user created: ${userID}, Email: ${email}`);

  try {
    // Using legacy collections until migration is complete
    const db = admin.firestore();
    const userRef = db.collection(LEGACY_COLLECTIONS.USER_INFO).doc(userID);

    // Create the initial user profile document
    await userRef.set({
      userId: userID,
      email: email || null,
      displayName: displayName || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      userMetadata: {
        acceptedTerms: false,
      }
    });

    logger.info(`Successfully created initial UserInfo document for user: ${userID}`);

    // Create default settings document
    const settingsRef = db.collection(LEGACY_COLLECTIONS.USER_SETTINGS).doc(userID);
    await settingsRef.set({
      userId: userID,
      notification: {
        fcmToken: null,
        updatedAt: timestamp.toDate().toISOString(),
        preferences: {
          enabled: true,
        }
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    logger.info(`Successfully created default UserSettings document for user: ${userID}`);

    // Create empty QuestionsAnswers document
    const qaRef = db.collection(LEGACY_COLLECTIONS.QUESTIONS_ANSWERS).doc(userID);
    await qaRef.set({
      userId: userID,
      questions: {}
    });
    logger.info(`Successfully created empty QuestionsAnswers document for user: ${userID}`);

  } catch (error) {
    logger.error(`Error creating documents for user ${userID}:`, error);
  }
});

/**
 * Log an audit event
 */
export async function logAuditEvent(
  userID: string,
  action: string,
  domain: string,
  source: 'user' | 'system' | 'admin'
): Promise<void> {
  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    
    await db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).add({
      userId: userID,
      action,
      domain,
      source,
      timestamp: firestore.Timestamp.now()
    });
    
    logger.info(`Audit log created for user ${userID}, action: ${action}`);
  } catch (error) {
    logger.error(`Error creating audit log for ${userID}:`, error);
  }
} 