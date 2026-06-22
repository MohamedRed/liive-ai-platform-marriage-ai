import { HttpsError } from "firebase-functions/v2/https";
import { QuestionLayer } from "@livve-1/database-types";
import {
  parseUpdateUserAnswersPayload,
  requireAuthenticatedUid,
} from "../domains/marriage/request-validation";

describe("marriage callable request validation", () => {
  it("requires an authenticated callable user id", () => {
    expect(requireAuthenticatedUid({ uid: "user-1" })).toBe("user-1");

    expect(() => requireAuthenticatedUid(undefined)).toThrow(HttpsError);
    expect(() => requireAuthenticatedUid(null)).toThrow("You must be logged in");
    expect(() => requireAuthenticatedUid({})).toThrow("You must be logged in");
  });

  it("parses and canonicalizes updateUserAnswers payloads", () => {
    expect(parseUpdateUserAnswersPayload({
      questionId: " q-1 ",
      question: " What matters? ",
      answer: " Faith and character ",
      layer: QuestionLayer.LAYER_2_FOUNDATIONAL,
      section: " values ",
    })).toEqual({
      questionId: "q-1",
      question: "What matters?",
      answer: "Faith and character",
      layer: QuestionLayer.LAYER_2_FOUNDATIONAL,
      section: "values",
    });
  });

  it("rejects malformed updateUserAnswers payloads with invalid-argument errors", () => {
    const invalidPayloads = [
      undefined,
      null,
      {},
      { questionId: "", answer: "answer", layer: QuestionLayer.LAYER_2_FOUNDATIONAL },
      { questionId: "q-1", answer: "", layer: QuestionLayer.LAYER_2_FOUNDATIONAL },
      { questionId: "q-1", answer: "answer", layer: "not-a-layer" },
    ];

    for (const payload of invalidPayloads) {
      expect(() => parseUpdateUserAnswersPayload(payload)).toThrow(HttpsError);
    }
  });
});
