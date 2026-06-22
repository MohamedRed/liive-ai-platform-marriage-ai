import { HttpsError } from "firebase-functions/v2/https";
import { QuestionLayer } from "@livve-1/database-types";

interface CallableAuthLike {
  uid?: unknown;
}

export interface UpdateUserAnswersPayload {
  questionId: string;
  question?: string;
  answer: string;
  layer: QuestionLayer;
  section?: string;
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

export function requireAuthenticatedUid(auth: CallableAuthLike | null | undefined): string {
  if (!auth || typeof auth.uid !== "string" || !auth.uid.trim()) {
    throw new HttpsError("unauthenticated", "You must be logged in to use Marriage AI.");
  }
  return auth.uid.trim();
}

export function isQuestionLayer(value: unknown): value is QuestionLayer {
  return Object.values(QuestionLayer)
    .filter((layerValue) => typeof layerValue === "number")
    .includes(value as QuestionLayer);
}

export function parseUpdateUserAnswersPayload(data: unknown): UpdateUserAnswersPayload {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Answer update payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const questionId = trimRequiredString(payload.questionId, "questionId");
  const answer = trimRequiredString(payload.answer, "answer");
  const layer = payload.layer;

  if (!isQuestionLayer(layer)) {
    throw new HttpsError("invalid-argument", "A valid question layer is required.");
  }

  return {
    questionId,
    question: trimOptionalString(payload.question),
    answer,
    layer,
    section: trimOptionalString(payload.section),
  };
}
