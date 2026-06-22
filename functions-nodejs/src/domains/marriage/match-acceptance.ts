import { HttpsError } from "firebase-functions/v2/https";

export const MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX_COLLECTION = "MATCH_ACCEPTANCE_NOTIFICATION_OUTBOX";

const MAX_STATE_CHANGE_REASON_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

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

export interface DeclineMatchPayload {
  matchedUserId: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface UnmatchPayload {
  matchedUserId: string;
  reason?: string;
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

export interface DeclinedMatchUpdateInput {
  userId: string;
  matchedUserId: string;
  matches: unknown;
  reason?: string;
  timestamp: unknown;
  idempotencyKey?: string;
}

export interface UnmatchedMatchUpdateInput {
  userId: string;
  matchedUserId: string;
  matches: unknown;
  reason?: string;
  timestamp: unknown;
  idempotencyKey?: string;
}

export interface AcceptedMatchUpdateResult {
  matches: Record<string, unknown>[];
  acceptedMatch: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
  notificationOutboxEvent?: Record<string, unknown>;
}

export interface DeclinedMatchUpdateResult {
  matches: Record<string, unknown>[];
  declinedMatch: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
}

export interface UnmatchedMatchUpdateResult {
  matches: Record<string, unknown>[];
  unmatchedMatch: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
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

function boundedOptionalString(value: unknown, fieldName: string, maxLength: number): string | undefined {
  const trimmed = trimOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} must be ${maxLength} characters or fewer.`);
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

export function parseDeclineMatchPayload(data: unknown): DeclineMatchPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Match decline payload is required.");
  }

  const payload = data as Record<string, unknown>;
  return {
    matchedUserId: trimRequiredString(payload.matchedUserId, "matchedUserId"),
    reason: boundedOptionalString(payload.reason, "reason", MAX_STATE_CHANGE_REASON_LENGTH),
    idempotencyKey: boundedOptionalString(payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

export function parseUnmatchPayload(data: unknown): UnmatchPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Unmatch payload is required.");
  }

  const payload = data as Record<string, unknown>;
  return {
    matchedUserId: trimRequiredString(payload.matchedUserId, "matchedUserId"),
    reason: boundedOptionalString(payload.reason, "reason", MAX_STATE_CHANGE_REASON_LENGTH),
    idempotencyKey: boundedOptionalString(payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

function candidateIds(candidate: Record<string, unknown>): string[] {
  return [candidate.id, candidate.matchedUserId, candidate.matched_user_id, candidate.userId, candidate.user_id]
    .map((value) => trimOptionalString(value))
    .filter((value): value is string => Boolean(value));
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function isAcceptedMatch(candidate: Record<string, unknown>): boolean {
  if (candidate.status === "accepted") {
    return true;
  }
  return objectRecord(candidate.acceptance)?.status === "accepted";
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

export function buildDeclinedMatchUpdate(input: DeclinedMatchUpdateInput): DeclinedMatchUpdateResult {
  const userId = trimRequiredString(input.userId, "userId");
  const matchedUserId = trimRequiredString(input.matchedUserId, "matchedUserId");
  const reason = boundedOptionalString(input.reason, "reason", MAX_STATE_CHANGE_REASON_LENGTH);
  const idempotencyKey = boundedOptionalString(input.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH);

  if (!Array.isArray(input.matches)) {
    throw new HttpsError("failed-precondition", "Match list is unavailable for decline.");
  }

  let declinedMatch: Record<string, unknown> | undefined;
  const matches = input.matches.map((matchCandidate) => {
    if (!matchCandidate || typeof matchCandidate !== "object" || Array.isArray(matchCandidate)) {
      return matchCandidate as Record<string, unknown>;
    }

    const candidate = matchCandidate as Record<string, unknown>;
    if (!candidateIds(candidate).includes(matchedUserId)) {
      return candidate;
    }

    declinedMatch = {
      ...candidate,
      status: "declined",
      decline: {
        status: "declined",
        declinedBy: userId,
        declinedAt: input.timestamp,
        ...(reason ? { reason } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    };
    return declinedMatch;
  }) as Record<string, unknown>[];

  if (!declinedMatch) {
    throw new HttpsError("not-found", "Match candidate is not available for decline.");
  }

  return {
    matches,
    declinedMatch,
    auditEvent: {
      type: "match_declined",
      actorUserId: userId,
      matchedUserId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
    },
  };
}

export function buildUnmatchedMatchUpdate(input: UnmatchedMatchUpdateInput): UnmatchedMatchUpdateResult {
  const userId = trimRequiredString(input.userId, "userId");
  const matchedUserId = trimRequiredString(input.matchedUserId, "matchedUserId");
  const reason = boundedOptionalString(input.reason, "reason", MAX_STATE_CHANGE_REASON_LENGTH);
  const idempotencyKey = boundedOptionalString(input.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH);

  if (!Array.isArray(input.matches)) {
    throw new HttpsError("failed-precondition", "Match list is unavailable for unmatch.");
  }

  let unmatchedMatch: Record<string, unknown> | undefined;
  const matches = input.matches.map((matchCandidate) => {
    if (!matchCandidate || typeof matchCandidate !== "object" || Array.isArray(matchCandidate)) {
      return matchCandidate as Record<string, unknown>;
    }

    const candidate = matchCandidate as Record<string, unknown>;
    if (!candidateIds(candidate).includes(matchedUserId)) {
      return candidate;
    }
    if (!isAcceptedMatch(candidate)) {
      throw new HttpsError("failed-precondition", "Only accepted matches can be unmatched.");
    }

    unmatchedMatch = {
      ...candidate,
      status: "unmatched",
      acceptance: {
        ...objectRecord(candidate.acceptance),
        status: "revoked",
        revokedBy: userId,
        revokedAt: input.timestamp,
      },
      unmatch: {
        status: "unmatched",
        unmatchedBy: userId,
        unmatchedAt: input.timestamp,
        ...(reason ? { reason } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    };
    return unmatchedMatch;
  }) as Record<string, unknown>[];

  if (!unmatchedMatch) {
    throw new HttpsError("not-found", "Match candidate is not available for unmatch.");
  }

  return {
    matches,
    unmatchedMatch,
    auditEvent: {
      type: "match_unmatched",
      actorUserId: userId,
      matchedUserId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
    },
  };
}
