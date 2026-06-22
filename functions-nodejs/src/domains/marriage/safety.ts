import { HttpsError } from "firebase-functions/v2/https";

export const USER_SAFETY_BLOCKS_COLLECTION = "USER_SAFETY_BLOCKS";
export const USER_SAFETY_REPORTS_COLLECTION = "USER_SAFETY_REPORTS";

const MAX_BLOCK_REASON_LENGTH = 500;
const MAX_REPORT_DESCRIPTION_LENGTH = 2000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

const REPORT_CATEGORIES = new Set([
  "harassment",
  "inappropriate",
  "fake_profile",
  "safety_concern",
  "spam",
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
