import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { firestore } from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";

import { QuestionLayer } from "@livve-1/database-types";

export const MATCHING_TOPIC_ENV = "USER_PROFILE_UPDATED_PUBSUB_TOPIC";
export const MATCHING_EVENT_OUTBOX_COLLECTION = "MATCHING_EVENT_OUTBOX";
const MAX_REPUBLISH_BATCH_SIZE = 25;
const MAX_REPUBLISH_ATTEMPTS = 5;

const pubSub = new PubSub();

export type MatchingEventPayload = {
  event_type: "qa_answer_updated";
  user_id: string;
  triggering_qa: {
    qa_id: string;
    question: string;
    answer: string;
    layer: QuestionLayer;
    section?: string;
  };
  published_at: string;
};

export type MatchingEventParams = {
  userID: string;
  questionId: string;
  questionText: string;
  answer: string;
  layer: QuestionLayer;
  section?: string;
};

export function buildMatchingEventPayload(params: MatchingEventParams): MatchingEventPayload {
  return {
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
}

export function createMatchingEventRef(db: firestore.Firestore) {
  return db.collection(MATCHING_EVENT_OUTBOX_COLLECTION).doc();
}

export function queueMatchingEvent(
  transaction: firestore.Transaction,
  matchingEventRef: firestore.DocumentReference,
  payload: MatchingEventPayload,
  timestamp: firestore.Timestamp,
): void {
  transaction.set(matchingEventRef, {
    status: "pending",
    attempts: 0,
    payload,
    userId: payload.user_id,
    questionId: payload.triggering_qa.qa_id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function publishMatchingEvent(payload: MatchingEventPayload): Promise<void> {
  const topicName = process.env[MATCHING_TOPIC_ENV];
  if (!topicName) {
    throw new Error(`${MATCHING_TOPIC_ENV} is not configured; matching event remains queued.`);
  }

  await pubSub.topic(topicName).publishMessage({
    data: Buffer.from(JSON.stringify(payload)),
    attributes: {
      event_type: payload.event_type,
      user_id: payload.user_id,
      question_id: payload.triggering_qa.qa_id,
    },
  });
}

export async function markMatchingEventPublished(
  db: firestore.Firestore,
  matchingEventId: string,
): Promise<void> {
  await db.collection(MATCHING_EVENT_OUTBOX_COLLECTION).doc(matchingEventId).set({
    status: "published",
    publishedAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function markMatchingEventPublishFailed(
  db: firestore.Firestore,
  matchingEventId: string,
  error: unknown,
): Promise<void> {
  await db.collection(MATCHING_EVENT_OUTBOX_COLLECTION).doc(matchingEventId).set({
    status: "publish_failed",
    attempts: firestore.FieldValue.increment(1),
    lastError: error instanceof Error ? error.message : String(error),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function markMatchingEventDeadLetter(
  db: firestore.Firestore,
  matchingEventId: string,
  error: unknown,
): Promise<void> {
  await db.collection(MATCHING_EVENT_OUTBOX_COLLECTION).doc(matchingEventId).set({
    status: "dead_letter",
    lastError: error instanceof Error ? error.message : String(error),
    deadLetteredAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function publishQueuedMatchingEvent(
  db: firestore.Firestore,
  doc: firestore.QueryDocumentSnapshot,
): Promise<"published" | "failed" | "dead_letter"> {
  const data = doc.data();
  const payload = data.payload as MatchingEventPayload | undefined;

  if (data.attempts >= MAX_REPUBLISH_ATTEMPTS) {
    await markMatchingEventDeadLetter(db, doc.id, "Maximum matching outbox publish attempts exceeded");
    return "dead_letter";
  }

  if (!payload || payload.event_type !== "qa_answer_updated" || !payload.triggering_qa?.qa_id) {
    await markMatchingEventPublishFailed(db, doc.id, "Invalid matching outbox payload");
    return "failed";
  }

  try {
    await publishMatchingEvent(payload);
    await markMatchingEventPublished(db, doc.id);
    return "published";
  } catch (error) {
    logger.error(`Failed to publish queued matching event ${doc.id}:`, error);
    await markMatchingEventPublishFailed(db, doc.id, error);
    return "failed";
  }
}

export async function republishPendingMatchingEventsHandler(): Promise<void> {
  const db = admin.firestore();
  const snapshot = await db
    .collection(MATCHING_EVENT_OUTBOX_COLLECTION)
    .where("status", "in", ["pending", "publish_failed"])
    .orderBy("createdAt", "asc")
    .limit(MAX_REPUBLISH_BATCH_SIZE)
    .get();

  let published = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const doc of snapshot.docs) {
    const result = await publishQueuedMatchingEvent(db, doc);
    if (result === "published") {
      published += 1;
    } else if (result === "dead_letter") {
      deadLettered += 1;
    } else {
      failed += 1;
    }
  }

  logger.info("Republished pending Marriage AI matching events", {
    scanned: snapshot.size,
    published,
    failed,
    deadLettered,
  });
}
