import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from 'firebase-admin';
import { firestore } from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";

import {
  QuestionsAnswers,
  WaliInfo,
  RelationshipType,
  QuestionLayer,
  LEGACY_COLLECTIONS
} from '@livve-1/database-types';

const pubSub = new PubSub();
const MATCHING_TOPIC_ENV = "USER_PROFILE_UPDATED_PUBSUB_TOPIC";

async function publishMatchingEvent(params: {
  userID: string;
  questionId: string;
  questionText: string;
  answer: string;
  layer: QuestionLayer;
  section?: string;
}): Promise<void> {
  const topicName = process.env[MATCHING_TOPIC_ENV];
  if (!topicName) {
    throw new Error(`${MATCHING_TOPIC_ENV} is not configured; refusing to save answer without triggering matching.`);
  }

  const payload = {
    event_type: "qa_answer_updated",
    user_id: params.userID,
    triggering_qa: {
      qa_id: params.questionId,
      question: params.questionText,
      answer: params.answer,
      layer: params.layer,
      section: params.section,
    },
    published_at: new Date().toISOString(),
  };

  await pubSub.topic(topicName).publishMessage({
    data: Buffer.from(JSON.stringify(payload)),
    attributes: {
      event_type: "qa_answer_updated",
      user_id: params.userID,
      question_id: params.questionId,
    },
  });
}

/**
 * Get user's questions and answers
 */
export const getUserQA = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Unauthorized. You must be logged in to access your QA data.");
  }

  const userID = request.auth.uid;

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
  if (!request.auth) {
    throw new Error("Unauthorized. You must be logged in to update your answers.");
  }

  const userID = request.auth.uid;
  const { questionId, question, answer, layer, section } = request.data;
  const timestamp = firestore.Timestamp.now();

  try {
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();

    // Validate input
    const validLayers = Object.values(QuestionLayer).filter((value) => typeof value === 'number');
    if (typeof questionId !== 'string' || !questionId.trim() || typeof answer !== 'string' || !validLayers.includes(layer)) {
      throw new Error("Invalid input. Question ID, answer, and a valid question layer are required.");
    }

    let questionTextForEvent = typeof question === 'string' && question.trim() ? question.trim() : questionId;
    const sectionForStorage = typeof section === 'string' && section.trim() ? section.trim() : undefined;

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
    });

    await publishMatchingEvent({
      userID,
      questionId,
      questionText: questionTextForEvent,
      answer,
      layer,
      section: sectionForStorage,
    });

    return { success: true };
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
      .doc(`${userID}_${waliID}`)
      .set({
        userId: userID,
        waliId: waliID,
        relationship: status,
        status: 'verified',
        verificationMetadata: {
          attempts: 1
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }, { merge: true });

    logger.info(`Wali verification updated for user ${userID} and wali ${waliID}`);
  } catch (error) {
    logger.error(`Error updating Wali verification for user ${userID} and wali ${waliID}:`, error);
    throw new Error("Failed to update Wali verification");
  }
}
