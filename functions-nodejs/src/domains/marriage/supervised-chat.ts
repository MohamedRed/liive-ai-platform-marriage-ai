import { HttpsError } from "firebase-functions/v2/https";

export const SUPERVISED_CHATS_COLLECTION = "SUPERVISED_CHATS";
export const SUPERVISED_CHAT_MESSAGES_SUBCOLLECTION = "MESSAGES";

interface AcceptedMatchLike {
  id?: unknown;
  matchedUserId?: unknown;
  matched_user_id?: unknown;
  userId?: unknown;
  user_id?: unknown;
  status?: unknown;
  acceptance?: unknown;
  waliId?: unknown;
}

export interface SendSupervisedChatMessagePayload {
  matchedUserId: string;
  message: string;
  idempotencyKey?: string;
}

export interface GetSupervisedChatMessagesPayload {
  matchedUserId: string;
  limit: number;
}

export interface SupervisedChatAccessInput {
  requesterUserId: string;
  matchedUserId: string;
  requesterMatchDocument: unknown;
  matchedUserMatchDocument: unknown;
}

export interface SupervisedChatAccessResult {
  chatId: string;
  participantIds: [string, string];
  waliIds: [string, string];
}

export interface SupervisedChatMessageWriteInput {
  senderUserId: string;
  matchedUserId: string;
  message: string;
  requesterMatchDocument: unknown;
  matchedUserMatchDocument: unknown;
  timestamp: unknown;
  idempotencyKey?: string;
}

export interface SupervisedChatMessageWriteResult extends SupervisedChatAccessResult {
  chatRecord: Record<string, unknown>;
  messageRecord: Record<string, unknown>;
  auditEvent: Record<string, unknown>;
}

export interface SupervisedChatMessageReadRecord {
  id: string;
  chatId: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  createdAt: unknown;
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

function roomSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function supervisedChatId(userId: string, matchedUserId: string): string {
  const first = roomSafe(trimRequiredString(userId, "userId"));
  const second = roomSafe(trimRequiredString(matchedUserId, "matchedUserId"));
  return `marriage_chat_${[first, second].sort().join("_")}`;
}

export function parseSendSupervisedChatMessagePayload(data: unknown): SendSupervisedChatMessagePayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Supervised chat message payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const message = trimRequiredString(payload.message ?? payload.body, "message");
  if (message.length > 2000) {
    throw new HttpsError("invalid-argument", "message must be at most 2000 characters.");
  }

  return {
    matchedUserId: trimRequiredString(payload.matchedUserId, "matchedUserId"),
    message,
    idempotencyKey: trimOptionalString(payload.idempotencyKey),
  };
}

export function parseGetSupervisedChatMessagesPayload(data: unknown): GetSupervisedChatMessagesPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Supervised chat read payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const limit = payload.limit === undefined ? 50 : payload.limit;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 100) {
    throw new HttpsError("invalid-argument", "limit must be an integer between 1 and 100.");
  }

  return {
    matchedUserId: trimRequiredString(payload.matchedUserId, "matchedUserId"),
    limit: limit as number,
  };
}

function candidateIds(candidate: AcceptedMatchLike): string[] {
  return [candidate.id, candidate.matchedUserId, candidate.matched_user_id, candidate.userId, candidate.user_id]
    .map((value) => trimOptionalString(value))
    .filter((value): value is string => Boolean(value));
}

function acceptanceObject(candidate: AcceptedMatchLike): Record<string, unknown> | undefined {
  if (candidate.acceptance && typeof candidate.acceptance === "object" && !Array.isArray(candidate.acceptance)) {
    return candidate.acceptance as Record<string, unknown>;
  }
  return undefined;
}

function isAccepted(candidate: AcceptedMatchLike): boolean {
  if (candidate.status === "accepted") {
    return true;
  }
  return acceptanceObject(candidate)?.status === "accepted";
}

function waliId(candidate: AcceptedMatchLike): string | undefined {
  return trimOptionalString(acceptanceObject(candidate)?.waliId) ?? trimOptionalString(candidate.waliId);
}

function matchesArray(matchDocument: unknown, ownerLabel: string): AcceptedMatchLike[] {
  if (!matchDocument || typeof matchDocument !== "object" || Array.isArray(matchDocument)) {
    throw new HttpsError("failed-precondition", `${ownerLabel} match document is unavailable.`);
  }
  const matches = (matchDocument as Record<string, unknown>).matches;
  if (!Array.isArray(matches)) {
    throw new HttpsError("failed-precondition", `${ownerLabel} match list is unavailable.`);
  }
  return matches.filter((candidate): candidate is AcceptedMatchLike => Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)));
}

function requireAcceptedWaliMatch(
  matchDocument: unknown,
  targetUserId: string,
  ownerLabel: string,
  missingMatchMessage: string,
  missingWaliMessage: string,
): string {
  const targetId = trimRequiredString(targetUserId, "targetUserId");
  const candidate = matchesArray(matchDocument, ownerLabel).find((matchCandidate) => candidateIds(matchCandidate).includes(targetId));

  if (!candidate || !isAccepted(candidate)) {
    throw new HttpsError("failed-precondition", missingMatchMessage);
  }

  const verifiedWaliId = waliId(candidate);
  if (!verifiedWaliId) {
    throw new HttpsError("failed-precondition", missingWaliMessage);
  }
  return verifiedWaliId;
}

export function authorizeSupervisedChatAccess(input: SupervisedChatAccessInput): SupervisedChatAccessResult {
  const requesterUserId = trimRequiredString(input.requesterUserId, "requesterUserId");
  const matchedUserId = trimRequiredString(input.matchedUserId, "matchedUserId");
  const senderWaliId = requireAcceptedWaliMatch(
    input.requesterMatchDocument,
    matchedUserId,
    "Requester",
    "Requester must have an accepted match before supervised chat.",
    "Requester accepted match is missing wali authorization.",
  );
  const matchedUserWaliId = requireAcceptedWaliMatch(
    input.matchedUserMatchDocument,
    requesterUserId,
    "Matched user",
    "Matched user must have a reciprocal accepted match before supervised chat.",
    "Matched user accepted match is missing wali authorization.",
  );

  return {
    chatId: supervisedChatId(requesterUserId, matchedUserId),
    participantIds: [requesterUserId, matchedUserId].sort() as [string, string],
    waliIds: [senderWaliId, matchedUserWaliId].sort() as [string, string],
  };
}

export function sanitizeSupervisedChatMessages(rawMessages: unknown[]): SupervisedChatMessageReadRecord[] {
  return rawMessages.flatMap((rawMessage) => {
    if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) {
      return [];
    }
    const message = rawMessage as Record<string, unknown>;
    const id = trimOptionalString(message.id);
    const chatId = trimOptionalString(message.chatId);
    const senderUserId = trimOptionalString(message.senderUserId);
    const recipientUserId = trimOptionalString(message.recipientUserId);
    const body = trimOptionalString(message.body);

    if (!id || !chatId || !senderUserId || !recipientUserId || !body || !message.createdAt) {
      return [];
    }

    return [{
      id,
      chatId,
      senderUserId,
      recipientUserId,
      body,
      createdAt: message.createdAt,
    }];
  });
}

export function buildSupervisedChatMessageWrite(input: SupervisedChatMessageWriteInput): SupervisedChatMessageWriteResult {
  const senderUserId = trimRequiredString(input.senderUserId, "senderUserId");
  const matchedUserId = trimRequiredString(input.matchedUserId, "matchedUserId");
  const message = trimRequiredString(input.message, "message");
  if (message.length > 2000) {
    throw new HttpsError("invalid-argument", "message must be at most 2000 characters.");
  }

  const access = authorizeSupervisedChatAccess({
    requesterUserId: senderUserId,
    matchedUserId,
    requesterMatchDocument: input.requesterMatchDocument,
    matchedUserMatchDocument: input.matchedUserMatchDocument,
  });
  const baseMetadata = {
    chatId: access.chatId,
    participantIds: access.participantIds,
    waliIds: access.waliIds,
    updatedAt: input.timestamp,
  };

  return {
    ...access,
    chatRecord: {
      ...baseMetadata,
      status: "active",
      supervision: "wali_supervised",
      lastMessageAt: input.timestamp,
      createdAt: input.timestamp,
    },
    messageRecord: {
      ...baseMetadata,
      senderUserId,
      recipientUserId: matchedUserId,
      body: message,
      waliVisible: true,
      createdAt: input.timestamp,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    },
    auditEvent: {
      type: "supervised_chat_message_sent",
      actorUserId: senderUserId,
      matchedUserId,
      chatId: access.chatId,
      waliIds: access.waliIds,
      createdAt: input.timestamp,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    },
  };
}
