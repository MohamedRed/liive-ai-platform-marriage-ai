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
  buildDeclinedMatchUpdate,
  buildUnmatchedMatchUpdate,
  MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION,
  parseAcceptMatchPayload,
  parseDeclineMatchPayload,
  parseUnmatchPayload,
} from "./match-acceptance";
import {
  processPendingMatchAcceptanceNotificationsHandler,
} from "./match-notifications";
import {
  buildNotificationDeviceRegistrationWrite,
  parseRegisterNotificationDevicePayload,
} from "./notification-settings";
import {
  parseUpdateUserAnswersPayload,
  requireAuthenticatedUid,
} from "./request-validation";
import {
  buildMarriageSafetyBlockWrite,
  buildMarriageSafetyReportWrite,
  parseBlockMarriageUserPayload,
  parseReportMarriageUserPayload,
  USER_SAFETY_BLOCKS_COLLECTION,
  USER_SAFETY_REPORTS_COLLECTION,
} from "./safety";
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

export const registerNotificationDevice = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);
  const payload = parseRegisterNotificationDevicePayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const settingsRef = db.collection(LEGACY_COLLECTIONS.USER_SETTINGS).doc(userID);
      const settingsDoc = await transaction.get(settingsRef);
      const notificationWrite = buildNotificationDeviceRegistrationWrite({
        userId: userID,
        payload,
        existingSettings: settingsDoc.exists ? settingsDoc.data() : undefined,
        timestamp,
      });
      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();

      transaction.set(settingsRef, notificationWrite.settingsRecord, { merge: true });
      transaction.set(auditRef, notificationWrite.auditEvent);
    });

    return {
      status: "registered",
      platform: payload.platform ?? null,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error registering notification device for ${userID}:`, error);
    throw new HttpsError("internal", "Failed to register notification device");
  }
});

export const blockMarriageUser = onCall(async (request) => {
  const actorUserId = requireAuthenticatedUid(request.auth);
  const payload = parseBlockMarriageUserPayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const blockWrite = buildMarriageSafetyBlockWrite({
        actorUserId,
        payload,
        timestamp,
      });
      const userRef = db.collection(LEGACY_COLLECTIONS.USER_INFO).doc(actorUserId);
      const blockRef = db.collection(USER_SAFETY_BLOCKS_COLLECTION).doc(blockWrite.blockId);
      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();

      transaction.set(userRef, {
        blockedUserIds: firestore.FieldValue.arrayUnion(payload.targetUserId),
        safety: {
          blockedUserIds: firestore.FieldValue.arrayUnion(payload.targetUserId),
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      }, { merge: true });
      transaction.set(blockRef, blockWrite.blockRecord, { merge: true });
      transaction.set(auditRef, blockWrite.auditEvent);
    });

    return {
      status: "blocked",
      targetUserId: payload.targetUserId,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error blocking marriage user for ${actorUserId}/${payload.targetUserId}:`, error);
    throw new HttpsError("internal", "Failed to block marriage user");
  }
});

export const reportMarriageUser = onCall(async (request) => {
  const actorUserId = requireAuthenticatedUid(request.auth);
  const payload = parseReportMarriageUserPayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const reportWrite = buildMarriageSafetyReportWrite({
        actorUserId,
        payload,
        timestamp,
      });
      const reportRef = db.collection(USER_SAFETY_REPORTS_COLLECTION).doc();
      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();

      transaction.set(reportRef, reportWrite.reportRecord);
      transaction.set(auditRef, {
        ...reportWrite.auditEvent,
        reportId: reportRef.id,
      });
    });

    return {
      status: "reported",
      targetUserId: payload.targetUserId,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error reporting marriage user for ${actorUserId}/${payload.targetUserId}:`, error);
    throw new HttpsError("internal", "Failed to report marriage user");
  }
});

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

export const declineMatch = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);
  const { matchedUserId, reason, idempotencyKey } = parseDeclineMatchPayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    return await db.runTransaction(async (transaction) => {
      const matchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(userID);
      const matchDoc = await transaction.get(matchRef);
      const matchData = matchDoc.exists ? matchDoc.data() : undefined;
      const declinedUpdate = buildDeclinedMatchUpdate({
        userId: userID,
        matchedUserId,
        matches: matchData?.matches,
        reason,
        timestamp,
        idempotencyKey,
      });

      transaction.set(matchRef, {
        matches: declinedUpdate.matches,
        lastDeclinedMatchId: matchedUserId,
        matchDeclinedAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });

      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();
      transaction.set(auditRef, declinedUpdate.auditEvent);

      return {
        status: "declined",
        matchedUserId,
      };
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error declining match for ${userID}/${matchedUserId}:`, error);
    throw new HttpsError("internal", "Failed to decline match");
  }
});

export const unmatch = onCall(async (request) => {
  const userID = requireAuthenticatedUid(request.auth);
  const { matchedUserId, reason, idempotencyKey } = parseUnmatchPayload(request.data);
  const timestamp = firestore.Timestamp.now();
  const db = admin.firestore();

  try {
    return await db.runTransaction(async (transaction) => {
      const matchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(userID);
      const matchedUserMatchRef = db.collection(LEGACY_COLLECTIONS.MATCHES).doc(matchedUserId);
      const matchDoc = await transaction.get(matchRef);
      const matchedUserMatchDoc = await transaction.get(matchedUserMatchRef);
      const matchData = matchDoc.exists ? matchDoc.data() : undefined;
      const matchedUserMatchData = matchedUserMatchDoc.exists ? matchedUserMatchDoc.data() : undefined;

      const unmatchedUpdate = buildUnmatchedMatchUpdate({
        userId: userID,
        matchedUserId,
        matches: matchData?.matches,
        reason,
        timestamp,
        idempotencyKey,
      });

      let reciprocalUnmatchedUpdate: ReturnType<typeof buildUnmatchedMatchUpdate> | undefined;
      if (Array.isArray(matchedUserMatchData?.matches)) {
        try {
          reciprocalUnmatchedUpdate = buildUnmatchedMatchUpdate({
            userId: matchedUserId,
            matchedUserId: userID,
            matches: matchedUserMatchData?.matches,
            timestamp,
            idempotencyKey,
          });
        } catch (reciprocalError) {
          if (!(reciprocalError instanceof HttpsError)) {
            throw reciprocalError;
          }
        }
      }

      transaction.set(matchRef, {
        matches: unmatchedUpdate.matches,
        lastUnmatchedUserId: matchedUserId,
        matchUnmatchedAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });

      if (reciprocalUnmatchedUpdate) {
        transaction.set(matchedUserMatchRef, {
          matches: reciprocalUnmatchedUpdate.matches,
          lastUnmatchedUserId: userID,
          matchUnmatchedAt: timestamp,
          updatedAt: timestamp,
        }, { merge: true });
      }

      const auditRef = db.collection(LEGACY_COLLECTIONS.AUDIT_LOGS).doc();
      transaction.set(auditRef, unmatchedUpdate.auditEvent);

      return {
        status: "unmatched",
        matchedUserId,
      };
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error unmatching marriage user for ${userID}/${matchedUserId}:`, error);
    throw new HttpsError("internal", "Failed to unmatch marriage user");
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
