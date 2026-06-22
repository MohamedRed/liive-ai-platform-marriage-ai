import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from 'firebase-admin';
import { firestore } from "firebase-admin";

import {
  QuestionsAnswers,
  WaliInfo,
  RelationshipType,
  LEGACY_COLLECTIONS
} from '@livve-1/database-types';

import {
  buildMatchingEventPayload,
  createMatchingEventRef,
  markMatchingEventPublishFailed,
  markMatchingEventPublished,
  publishMatchingEvent,
  queueMatchingEvent,
  republishPendingMatchingEventsHandler,
} from "./matching-events";
import {
  buildAcceptedMatchUpdate,
  MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION,
  parseAcceptMatchPayload,
} from "./match-acceptance";
import {
  processPendingMatchAcceptanceNotificationsHandler,
} from "./match-notifications";
import {
  parseUpdateUserAnswersPayload,
  requireAuthenticatedUid,
} from "./request-validation";
import {
  authorizeSupervisedChatAccess,
  buildSupervisedChatMessageWrite,
  parseGetSupervisedChatMessagesPayload,
  parseSendSupervisedChatMessagePayload,
  sanitizeSupervisedChatMessages,
  SUPERVISED_CHAT_MESSAGES_SUBCOLLECTION,
  SUPERVISED_CHATS_COLLECTION,
} from "./supervised-chat";
import { buildVerifiedWaliRelationPayload } from "./wali-verification";

/**
 * Get user's questions and answers
 */
export const getUserQA = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);

  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();

    const qaDoc = await db
      .collection(LEGACY_COLLECTIONS.QUESTIONS_ANSWERS)
      .doc(userID)
      .get();

    if (!qaDoc.exists) {
      return { questions: {} };
    }

    return qaDoc.data() as QuestionsAnswers;
  } catch (error) {
    logger.error(`Error retrieving QA data for ${userID}:`, error);
    throw new Error("Failed to retrieve QA data");
  }
});

/**
 * Update user's answers
 */
export const updateUserAnswers = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);
  const { questionId, question, answer, layer, section } = parseUpdateUserAnswersPayload(request.data);
  const timestamp = firestore.Timestamp.now();

  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();

    let questionTextForEvent = typeof question === 'string' && question.trim() ? question.trim() : questionId;
    const sectionForStorage = typeof section === 'string' && section.trim() ? section.trim() : undefined;
    const matchingEventRef = createMatchingEventRef(db);
    let matchingEventPayload = buildMatchingEventPayload({
      userID,
      questionId,
      questionText: questionTextForEvent,
      answer,
      layer,
      section: sectionForStorage,
    });

    await db.runTransaction(async (transaction) => {
      const qaRef = db.collection(LEGACY_COLLECTIONS.QUESTIONS_ANSWERS).doc(userID);
      const qaDoc = await transaction.get(qaRef);

      if (!qaDoc.exists) {
        // Create new QA document if it doesn't exist
        transaction.set(qaRef, {
          userId: userID,
          questions: {
            [questionId]: {
              question: questionTextForEvent,
              answer,
              layer,
              section: sectionForStorage,
              createdAt: timestamp,
              updatedAt: timestamp
            }
          }
        });
      } else {
        // Update existing question or add new one
        const qaData = qaDoc.data() as QuestionsAnswers;
        const questions = qaData.questions || {};

        // Get existing question data if it exists
        const existingQuestion = questions[questionId];
        questionTextForEvent = typeof question === 'string' && question.trim()
          ? question.trim()
          : existingQuestion?.question || questionId;

        // Create or update question
        questions[questionId] = {
          question: questionTextForEvent,
          answer,
          layer,
          section: sectionForStorage ?? existingQuestion?.section,
          createdAt: existingQuestion?.createdAt || timestamp,
          updatedAt: timestamp
        };

        transaction.update(qaRef, { questions });
      }

      // Add to edit logs
      const editLogRef = db.collection(LEGACY_COLLECTIONS.QA_EDIT_LOGS).doc();
      transaction.set(editLogRef, {
        userId: userID,
        questionId,
        previousAnswer: qaDoc.exists
          ? ((qaDoc.data() as QuestionsAnswers).questions || {})[questionId]?.answer || ""
          : "",
        newAnswer: answer,
        createdAt: timestamp,
        metadata: {
          deviceInfo: request.rawRequest.headers['user-agent'],
          ipAddress: request.rawRequest.ip
        }
      });
      // Persist matching outbox entry in the same transaction as the answer and audit log.
      matchingEventPayload = buildMatchingEventPayload({
        userID,
        questionId,
        questionText: questionTextForEvent,
        answer,
        layer,
        section: sectionForStorage,
      });
      queueMatchingEvent(transaction, matchingEventRef, matchingEventPayload, timestamp);
    });

    try {
      await publishMatchingEvent(matchingEventPayload);
      await markMatchingEventPublished(db, matchingEventRef.id);
      return { success: true, matchingEventId: matchingEventRef.id, matchingStatus: "published" };
    } catch (publishError) {
      logger.error(`Matching event publish failed for outbox ${matchingEventRef.id}:`, publishError);
      await markMatchingEventPublishFailed(db, matchingEventRef.id, publishError);
      return { success: true, matchingEventId: matchingEventRef.id, matchingStatus: "publish_failed" };
    }
  } catch (error) {
    logger.error(`Error updating answer for ${userID}, question ${request.data.questionId}:`, error);
    throw new Error("Failed to update answer");
  }
});

/**
 * Get Wali information
 */
export async function getWaliInfo(waliID: string): Promise<WaliInfo | null> {
  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();

    const waliDoc = await db
      .collection(LEGACY_COLLECTIONS.WALI_INFO)
      .doc(waliID)
      .get();

    if (!waliDoc.exists) {
      return null;
    }

    return waliDoc.data() as WaliInfo;
  } catch (error) {
    logger.error(`Error retrieving Wali info for ${waliID}:`, error);
    return null;
  }
}

/**
 * Update Wali verification status
 */
export async function updateWaliVerificationStatus(
  userID: string,
  waliID: string,
  status: RelationshipType
): Promise<void> {
  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    const timestamp = firestore.Timestamp.now();

    await db
      .collection(LEGACY_COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS)
      .doc(`${userID.trim()}_${waliID.trim()}`)
      .set(buildVerifiedWaliRelationPayload(userID, waliID, status, timestamp), { merge: true });

    logger.info(`Wali verification updated for user ${userID} and wali ${waliID}`);
  } catch (error) {
    logger.error(`Error updating Wali verification for user ${userID} and wali ${waliID}:`, error);
    throw new Error("Failed to update Wali verification");
  }
}

export const acceptMatch = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);
  const { matchedUserId, notifyWali, idempotencyKey } = parseAcceptMatchPayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    const waliSnapshot = await db
      .collection(LEGACY_COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS)
      .where("userId", "==", userID)
      .where("status", "==", "verified")
      .limit(1)
      .get();
    const waliRelation = waliSnapshot.docs[0]?.data();

    if (!waliRelation) {
      throw new HttpsError("failed-precondition", "A verified wali relationship is required before accepting a match.");
    }

    return await db.runTransaction(async (transaction) => {
      const matchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(userID);
      const matchDoc = await transaction.get(matchRef);
      const matchData = matchDoc.exists ? matchDoc.data() : undefined;
      const acceptedUpdate = buildAcceptedMatchUpdate({
        userId: userID,
        matchedUserId,
        matches: matchData?.matches,
        waliRelation,
        notifyWali,
        timestamp,
        idempotencyKey,
      });

      transaction.set(matchRef, {
        matches: acceptedUpdate.matches,
        lastAcceptedMatchId: matchedUserId,
        matchAcceptanceUpdatedAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });

      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();
      transaction.set(auditRef, acceptedUpdate.auditEvent);

      if (acceptedUpdate.notificationOutboxEvent) {
        const notificationRef = db.collection(MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION).doc();
        transaction.set(notificationRef, acceptedUpdate.notificationOutboxEvent);
      }

      return {
        status: "accepted",
        wali_notification_status: notifyWali ? "queued" : "not_requested",
        chat_id: null,
      };
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error accepting match for ${userID}/${matchedUserId}:`, error);
    throw new HttpsError("internal", "Failed to accept match");
  }
});

export const sendSupervisedChatMessage = onCall(async (request) => {
  const senderUserId = requireAuthenticatedUid(request.auth);
  const { matchedUserId, message, idempotencyKey } = parseSendSupervisedChatMessagePayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    return await db.runTransaction(async (transaction) => {
      const requesterMatchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(senderUserId);
      const matchedUserMatchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(matchedUserId);
      const requesterMatchDoc = await transaction.get(requesterMatchRef);
      const matchedUserMatchDoc = await transaction.get(matchedUserMatchRef);

      const chatWrite = buildSupervisedChatMessageWrite({
        senderUserId,
        matchedUserId,
        message,
        requesterMatchDocument: requesterMatchDoc.exists ? requesterMatchDoc.data() : undefined,
        matchedUserMatchDocument: matchedUserMatchDoc.exists ? matchedUserMatchDoc.data() : undefined,
        timestamp,
        idempotencyKey,
      });

      const chatRef = db.collection(SUPERVISED_CHATS_COLLECTION).doc(chatWrite.chatId);
      const messageRef = chatRef.collection(SUPERVISED_CHAT_MESSAGES_SUBCOLLECTION).doc();
      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();

      transaction.set(chatRef, chatWrite.chatRecord, { merge: true });
      transaction.set(messageRef, {
        ...chatWrite.messageRecord,
        id: messageRef.id,
      });
      transaction.set(auditRef, {
        ...chatWrite.auditEvent,
        messageId: messageRef.id,
      });

      return {
        status: "sent",
        chatId: chatWrite.chatId,
        messageId: messageRef.id,
      };
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error sending supervised chat message for ${senderUserId}/${matchedUserId}:`, error);
    throw new HttpsError("internal", "Failed to send supervised chat message");
  }
});

export const getSupervisedChatMessages = onCall(async (request) => {
  const requesterUserId = requireAuthenticatedUid(request.auth);
  const { matchedUserId, limit } = parseGetSupervisedChatMessagesPayload(request.data);
  const db = admin.firestore();

  try {
    const requesterMatchDoc = await db.collection(LEGACY_COLLECTIONS.MATCHES).doc(requesterUserId).get();
    const matchedUserMatchDoc = await db.collection(LEGACY_COLLECTIONS.MATCHES).doc(matchedUserId).get();
    const access = authorizeSupervisedChatAccess({
      requesterUserId,
      matchedUserId,
      requesterMatchDocument: requesterMatchDoc.exists ? requesterMatchDoc.data() : undefined,
      matchedUserMatchDocument: matchedUserMatchDoc.exists ? matchedUserMatchDoc.data() : undefined,
    });

    const messagesSnapshot = await db
      .collection(SUPERVISED_CHATS_COLLECTION)
      .doc(access.chatId)
      .collection(SUPERVISED_CHAT_MESSAGES_SUBCOLLECTION)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const rawMessages = messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      chatId: access.chatId,
      messages: sanitizeSupervisedChatMessages(rawMessages),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error reading supervised chat messages for ${requesterUserId}/${matchedUserId}:`, error);
    throw new HttpsError("internal", "Failed to read supervised chat messages");
  }
});

export const processMatchAcceptanceNotifications = onSchedule("every 5 minutes", async () => {
  await processPendingMatchAcceptanceNotificationsHandler();
});

export const republishPendingMatchingEvents = onSchedule("every 5 minutes", async () => {
  await republishPendingMatchingEventsHandler();
});
