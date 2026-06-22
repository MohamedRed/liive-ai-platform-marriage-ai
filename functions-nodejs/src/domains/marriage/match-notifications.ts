import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { firestore } from "firebase-admin";
import { LEGACY_COLLECTIONS } from "@livve-1/database-types";

import { MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION } from "./match-acceptance";

export const MATCH_NOTIFICATION_MAX_ATTEMPTS = 5;
const MATCH_NOTIFICATION_BATCH_SIZE = 25;

type MatchNotificationDeliveryResult = "sent" | "failed" | "dead_letter" | "skipped";

interface MatchAcceptanceNotificationEvent {
  type?: unknown;
  status?: unknown;
  attempts?: unknown;
  userId?: unknown;
  matchedUserId?: unknown;
  waliId?: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function notificationOutboxRef(db: firestore.Firestore, notificationId: string): firestore.DocumentReference {
  return db.collection(MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION).doc(notificationId);
}

async function markNotificationSent(
  db: firestore.Firestore,
  notificationId: string,
  fcmMessageId: string,
): Promise<void> {
  await notificationOutboxRef(db, notificationId).set({
    status: "sent",
    fcmMessageId,
    sentAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markNotificationSkipped(
  db: firestore.Firestore,
  notificationId: string,
  reason: string,
): Promise<void> {
  await notificationOutboxRef(db, notificationId).set({
    status: "skipped",
    lastError: reason,
    skippedAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markNotificationFailed(
  db: firestore.Firestore,
  notificationId: string,
  error: unknown,
): Promise<void> {
  await notificationOutboxRef(db, notificationId).set({
    status: "delivery_failed",
    attempts: firestore.FieldValue.increment(1),
    lastError: errorMessage(error),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markNotificationDeadLetter(
  db: firestore.Firestore,
  notificationId: string,
  reason: string,
): Promise<void> {
  await notificationOutboxRef(db, notificationId).set({
    status: "dead_letter",
    lastError: reason,
    deadLetteredAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

function getWaliFcmToken(settings: unknown): string | undefined {
  if (!settings || typeof settings !== "object") {
    return undefined;
  }
  const notification = (settings as { notification?: unknown }).notification;
  if (!notification || typeof notification !== "object") {
    return undefined;
  }
  return stringField((notification as { fcmToken?: unknown }).fcmToken);
}

function parseNotificationEvent(data: MatchAcceptanceNotificationEvent): {
  attempts: number;
  userId: string;
  matchedUserId: string;
  waliId: string;
} {
  const userId = stringField(data.userId);
  const matchedUserId = stringField(data.matchedUserId);
  const waliId = stringField(data.waliId);

  if (data.type !== "wali_match_acceptance_requested" || !userId || !matchedUserId || !waliId) {
    throw new Error("Invalid match acceptance notification outbox payload");
  }

  return {
    attempts: typeof data.attempts === "number" ? data.attempts : 0,
    userId,
    matchedUserId,
    waliId,
  };
}

export async function deliverMatchAcceptanceNotification(
  db: firestore.Firestore,
  messaging: admin.messaging.Messaging,
  doc: firestore.QueryDocumentSnapshot,
): Promise<MatchNotificationDeliveryResult> {
  let event: ReturnType<typeof parseNotificationEvent>;
  try {
    event = parseNotificationEvent(doc.data() as MatchAcceptanceNotificationEvent);
  } catch (error) {
    await markNotificationDeadLetter(db, doc.id, errorMessage(error));
    return "dead_letter";
  }

  if (event.attempts >= MATCH_NOTIFICATION_MAX_ATTEMPTS) {
    await markNotificationDeadLetter(db, doc.id, "Maximum match notification delivery attempts exceeded");
    return "dead_letter";
  }

  const settingsDoc = await db.collection(LEGACY_COLLECTIONS.USER_SETTINGS).doc(event.waliId).get();
  const fcmToken = settingsDoc.exists ? getWaliFcmToken(settingsDoc.data()) : undefined;

  if (!fcmToken) {
    await markNotificationSkipped(db, doc.id, "Wali FCM token is missing");
    return "skipped";
  }

  try {
    const fcmMessageId = await messaging.send({
      token: fcmToken,
      notification: {
        title: "Match acceptance needs wali review",
        body: "A match was accepted and is ready for your wali review.",
      },
      data: {
        type: "wali_match_acceptance_requested",
        userId: event.userId,
        matchedUserId: event.matchedUserId,
        waliId: event.waliId,
      },
    });
    await markNotificationSent(db, doc.id, fcmMessageId);
    return "sent";
  } catch (error) {
    logger.error(`Failed to deliver match acceptance notification ${doc.id}:`, error);
    await markNotificationFailed(db, doc.id, error);
    return "failed";
  }
}

export async function processPendingMatchAcceptanceNotificationsHandler(): Promise<void> {
  const db = admin.firestore();
  const messaging = admin.messaging();
  const snapshot = await db
    .collection(MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION)
    .where("status", "in", ["pending", "delivery_failed"])
    .orderBy("createdAt", "asc")
    .limit(MATCH_NOTIFICATION_BATCH_SIZE)
    .get();

  const counts: Record<MatchNotificationDeliveryResult, number> = {
    sent: 0,
    failed: 0,
    dead_letter: 0,
    skipped: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await deliverMatchAcceptanceNotification(db, messaging, doc);
    counts[result] += 1;
  }

  logger.info("Processed pending Marriage AI match acceptance notifications", {
    scanned: snapshot.size,
    ...counts,
  });
}
