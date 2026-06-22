import { HttpsError } from "firebase-functions/v2/https";

export const USER_SAFETY_BLOCKS_COLLECTION = "USER_SAFETY_BLOCKS";
export const USER_SAFETY_REPORTS_COLLECTION = "USER_SAFETY_REPORTS";
export const USER_SAFETY_ESCALATIONS_COLLECTION = "USER_SAFETY_ESCALATIONS";
export const USER_SAFETY_WARNINGS_COLLECTION = "USER_SAFETY_WARNINGS";

const MAX_BLOCK_REASON_LENGTH = 500;
const MAX_REPORT_DESCRIPTION_LENGTH = 2000;
const MAX_MODERATOR_NOTE_LENGTH = 2000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

const REPORT_CATEGORIES = new Set([
  "harassment",
  "inappropriate",
  "fake_profile",
  "safety_concern",
  "spam",
  "other",
]);

const REPORT_REVIEW_STATUSES = new Set([
  "under_review",
  "resolved",
  "dismissed",
  "escalated",
]);

const REPORT_RESOLUTIONS = new Set([
  "no_action",
  "user_warned",
  "profile_suspended",
  "escalated",
  "other",
]);

export interface BlockMarriageUserPayload {
  targetUserId: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface ReportMarriageUserPayload {
  targetUserId: string;
  category: string;
  description?: string;
  idempotencyKey?: string;
}

export interface ReviewMarriageReportPayload {
  reportId: string;
  status: string;
  resolution?: string;
  moderatorNote?: string;
  idempotencyKey?: string;
}

export interface ModeratorAuthLike {
  uid?: unknown;
  token?: unknown;
}

export interface MarriageSafetyWriteInput<TPayload> {
  actorUserId: string;
  payload: TPayload;
  timestamp: unknown;
}

export interface MarriageSafetyBlockWrite {
  blockId: string;
  blockRecord: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
}

export interface MarriageSafetyReportWrite {
  reportRecord: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
}

export interface MarriageSafetyReportReviewWriteInput {
  moderatorUserId: string;
  payload: ReviewMarriageReportPayload;
  existingReport: Record<string, unknown>;
  timestamp: unknown;
}

export interface MarriageSafetyReportReviewWrite {
  reportUpdate: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
  targetUserId?: string;
  targetUserUpdate?: Record<string, unknown>;
  escalationRecord?: Record<string, unknown>;
  warningRecord?: Record<string, unknown>;
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

function canonicalActorTarget(actorUserId: unknown, targetUserId: unknown): { actorUserId: string; targetUserId: string } {
  const actor = trimRequiredString(actorUserId, "actorUserId");
  const target = trimRequiredString(targetUserId, "targetUserId");
  if (actor === target) {
    throw new HttpsError("invalid-argument", "targetUserId must be different from the authenticated user.");
  }
  return { actorUserId: actor, targetUserId: target };
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function requireMarriageSafetyModerator(auth: ModeratorAuthLike | null | undefined): string {
  const uid = trimOptionalString(auth?.uid);
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required to review marriage safety reports.");
  }

  const token = objectRecord(auth?.token) ?? {};
  const roles = stringArray(token.roles);
  const hasModeratorClaim = token.admin === true ||
    token.moderator === true ||
    token.marriageModerator === true ||
    token.marriage_moderator === true ||
    roles.includes("admin") ||
    roles.includes("moderator") ||
    roles.includes("marriage_moderator");

  if (!hasModeratorClaim) {
    throw new HttpsError("permission-denied", "A marriage safety moderator role is required.");
  }

  return uid;
}

export function parseBlockMarriageUserPayload(data: unknown): BlockMarriageUserPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Block user payload is required.");
  }

  const payload = data as Record<string, unknown>;
  return {
    targetUserId: trimRequiredString(payload.targetUserId, "targetUserId"),
    reason: boundedOptionalString(payload.reason, "reason", MAX_BLOCK_REASON_LENGTH),
    idempotencyKey: boundedOptionalString(payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

export function parseReportMarriageUserPayload(data: unknown): ReportMarriageUserPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Report user payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const category = trimOptionalString(payload.category) ?? "other";
  if (!REPORT_CATEGORIES.has(category)) {
    throw new HttpsError("invalid-argument", "category is not supported.");
  }

  return {
    targetUserId: trimRequiredString(payload.targetUserId, "targetUserId"),
    category,
    description: boundedOptionalString(payload.description, "description", MAX_REPORT_DESCRIPTION_LENGTH),
    idempotencyKey: boundedOptionalString(payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

export function parseReviewMarriageReportPayload(data: unknown): ReviewMarriageReportPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Report review payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const status = trimOptionalString(payload.status) ?? "under_review";
  if (!REPORT_REVIEW_STATUSES.has(status)) {
    throw new HttpsError("invalid-argument", "status is not supported.");
  }

  const resolution = boundedOptionalString(payload.resolution, "resolution", 64);
  if (resolution && !REPORT_RESOLUTIONS.has(resolution)) {
    throw new HttpsError("invalid-argument", "resolution is not supported.");
  }

  return {
    reportId: trimRequiredString(payload.reportId, "reportId"),
    status,
    ...(resolution ? { resolution } : {}),
    moderatorNote: boundedOptionalString(payload.moderatorNote, "moderatorNote", MAX_MODERATOR_NOTE_LENGTH),
    idempotencyKey: boundedOptionalString(payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH),
  };
}

export function buildMarriageSafetyBlockWrite(
  input: MarriageSafetyWriteInput<BlockMarriageUserPayload>,
): MarriageSafetyBlockWrite {
  const { actorUserId, targetUserId } = canonicalActorTarget(input.actorUserId, input.payload.targetUserId);
  const reason = boundedOptionalString(input.payload.reason, "reason", MAX_BLOCK_REASON_LENGTH);
  const idempotencyKey = boundedOptionalString(input.payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH);
  const blockId = `${actorUserId}_${targetUserId}`;

  return {
    blockId,
    blockRecord: {
      actorUserId,
      targetUserId,
      status: "active",
      ...(reason ? { reason } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    },
    auditEvent: {
      type: "marriage_user_blocked",
      actorUserId,
      targetUserId,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
    },
  };
}

export function buildMarriageSafetyReportWrite(
  input: MarriageSafetyWriteInput<ReportMarriageUserPayload>,
): MarriageSafetyReportWrite {
  const { actorUserId, targetUserId } = canonicalActorTarget(input.actorUserId, input.payload.targetUserId);
  const category = trimOptionalString(input.payload.category) ?? "other";
  if (!REPORT_CATEGORIES.has(category)) {
    throw new HttpsError("invalid-argument", "category is not supported.");
  }
  const description = boundedOptionalString(input.payload.description, "description", MAX_REPORT_DESCRIPTION_LENGTH);
  const idempotencyKey = boundedOptionalString(input.payload.idempotencyKey, "idempotencyKey", MAX_IDEMPOTENCY_KEY_LENGTH);

  return {
    reportRecord: {
      reporterUserId: actorUserId,
      targetUserId,
      category,
      ...(description ? { description } : {}),
      status: "pending_review",
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    },
    auditEvent: {
      type: "marriage_user_reported",
      actorUserId,
      targetUserId,
      category,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: input.timestamp,
    },
  };
}

export function buildMarriageSafetyReportReviewWrite(
  input: MarriageSafetyReportReviewWriteInput,
): MarriageSafetyReportReviewWrite {
  const moderatorUserId = trimRequiredString(input.moderatorUserId, "moderatorUserId");
  const payload = parseReviewMarriageReportPayload(input.payload);
  const reporterUserId = trimOptionalString(input.existingReport.reporterUserId);
  const targetUserId = trimOptionalString(input.existingReport.targetUserId);
  const category = trimOptionalString(input.existingReport.category);

  const reportUpdate = {
    status: payload.status,
    ...(payload.resolution ? { resolution: payload.resolution } : {}),
    ...(payload.moderatorNote ? { moderatorNote: payload.moderatorNote } : {}),
    ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
    reviewedBy: moderatorUserId,
    reviewedAt: input.timestamp,
    updatedAt: input.timestamp,
  };
  const targetUserUpdate = payload.resolution === "profile_suspended" && targetUserId ? {
    status: "suspended",
    accountStatus: "suspended",
    safety: {
      moderationStatus: "suspended",
      suspendedBy: moderatorUserId,
      suspensionReportId: payload.reportId,
      suspendedAt: input.timestamp,
    },
    updatedAt: input.timestamp,
  } : undefined;
  const escalationRecord = (payload.status === "escalated" || payload.resolution === "escalated") ? {
    reportId: payload.reportId,
    ...(reporterUserId ? { reporterUserId } : {}),
    ...(targetUserId ? { targetUserId } : {}),
    ...(category ? { category } : {}),
    status: "open",
    priority: "high",
    escalatedBy: moderatorUserId,
    ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  } : undefined;
  const warningRecord = payload.resolution === "user_warned" && targetUserId ? {
    reportId: payload.reportId,
    ...(reporterUserId ? { reporterUserId } : {}),
    targetUserId,
    ...(category ? { category } : {}),
    status: "active",
    warningType: "report_resolution",
    warnedBy: moderatorUserId,
    ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  } : undefined;

  return {
    reportUpdate,
    ...(targetUserId && targetUserUpdate ? { targetUserId, targetUserUpdate } : {}),
    ...(escalationRecord ? { escalationRecord } : {}),
    ...(warningRecord ? { warningRecord } : {}),
    auditEvent: {
      type: "marriage_report_reviewed",
      moderatorUserId,
      reportId: payload.reportId,
      ...(reporterUserId ? { reporterUserId } : {}),
      ...(targetUserId ? { targetUserId } : {}),
      ...(category ? { category } : {}),
      status: payload.status,
      ...(payload.resolution ? { resolution: payload.resolution } : {}),
      ...(payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : {}),
      createdAt: input.timestamp,
    },
  };
}
