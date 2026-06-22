import { HttpsError } from "firebase-functions/v2/https";

export const MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION = "MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX";

interface WaliRelationLike {
  userId?: unknown;
  waliId?: unknown;
  status?: unknown;
}

export interface AcceptMatchPayload {
  matchedUserId: string;
  notifyWali: boolean;
  idempotencyKey?: string;
}

export interface AcceptedMatchUpdateInput {
  userId: string;
  matchedUserId: string;
  matches: unknown;
  waliRelation: WaliRelationLike | null | undefined;
  notifyWali: boolean;
  timestamp: unknown;
  idempotencyKey?: string;
}

export interface AcceptedMatchUpdateResult {
  matches: Record<string, unknown>[];
  acceptedMatch: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
  notificationOutboxEvent?: Record<string, unknown>;
}

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function trimRequiredString(value: unknown, fieldName: string): string {
  const trimmed = trimOptionalString(value);
  if (!trimmed) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  return trimmed;
}

export function parseAcceptMatchPayload(data: unknown): AcceptMatchPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Match acceptance payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const notifyWali = payload.notifyWali ?? true;
  if (typeof notifyWali !== "boolean") {
    throw new HttpsError("invalid-argument", "notifyWali must be a boolean when provided.");
  }

  return {
    matchedUserId: trimRequiredString(payload.matchedUserId, "matchedUserId"),
    notifyWali,
    idempotencyKey: trimOptionalString(payload.idempotencyKey),
  };
}

function candidateIds(candidate: Record<string, unknown>): string[] {
  return [candidate.id, candidate.matchedUserId, candidate.matched_user_id, candidate.userId, candidate.user_id]
    .map((value) => trimOptionalString(value))
    .filter((value): value is string => Boolean(value));
}

export function isVerifiedWaliRelationForUser(waliRelation: WaliRelationLike | null | undefined, userId: string): waliRelation is WaliRelationLike & { waliId: string } {
  return Boolean(
    waliRelation &&
    waliRelation.status === "verified" &&
    trimOptionalString(waliRelation.userId) === userId &&
    trimOptionalString(waliRelation.waliId),
  );
}

export function buildAcceptedMatchUpdate(input: AcceptedMatchUpdateInput): AcceptedMatchUpdateResult {
  const userId = trimRequiredString(input.userId, "userId");
  const matchedUserId = trimRequiredString(input.matchedUserId, "matchedUserId");

  if (!Array.isArray(input.matches)) {
    throw new HttpsError("failed-precondition", "Match list is unavailable for acceptance.");
  }

  if (!isVerifiedWaliRelationForUser(input.waliRelation, userId)) {
    throw new HttpsError("failed-precondition", "A verified wali relationship is required before accepting a match.");
  }

  const waliId = trimRequiredString(input.waliRelation.waliId, "waliId");
  let acceptedMatch: Record<string, unknown> | undefined;
  const matches = input.matches.map((matchCandidate) => {
    if (!matchCandidate || typeof matchCandidate !== "object" || Array.isArray(matchCandidate)) {
      return matchCandidate as Record<string, unknown>;
    }

    const candidate = matchCandidate as Record<string, unknown>;
    if (!candidateIds(candidate).includes(matchedUserId)) {
      return candidate;
    }

    acceptedMatch = {
      ...candidate,
      status: "accepted",
      acceptance: {
        status: "accepted",
        acceptedBy: userId,
        acceptedAt: input.timestamp,
        waliId,
        waliNotificationStatus: input.notifyWali ? "queued" : "not_requested",
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
    };
    return acceptedMatch;
  }) as Record<string, unknown>[];

  if (!acceptedMatch) {
    throw new HttpsError("not-found", "Match candidate is not available for acceptance.");
  }

  const auditEvent = {
    type: "match_acceptance",
    actorUserId: userId,
    matchedUserId,
    waliId,
    notifyWali: input.notifyWali,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    createdAt: input.timestamp,
  };

  return {
    matches,
    acceptedMatch,
    auditEvent,
    ...(input.notifyWali ? {
      notificationOutboxEvent: {
        type: "wali_match_acceptance_requested",
        status: "pending",
        attempts: 0,
        userId,
        matchedUserId,
        waliId,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        payload: {
          userId,
          matchedUserId,
          waliId,
          notificationType: "match_acceptance_requested",
        },
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      },
    } : {}),
  };
}
