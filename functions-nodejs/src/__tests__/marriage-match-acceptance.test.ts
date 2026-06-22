import { HttpsError } from "firebase-functions/v2/https";
import {
  buildAcceptedMatchUpdate,
  parseAcceptMatchPayload,
} from "../domains/marriage/match-acceptance";

describe("match acceptance state machine", () => {
  const timestamp = { seconds: 123, nanoseconds: 456 };
  const verifiedWaliRelation = {
    userId: "user-1",
    waliId: "wali-1",
    status: "verified",
    relationship: "father",
  };

  it("parses accept-match payloads with canonical ids and idempotency keys", () => {
    expect(parseAcceptMatchPayload({
      matchedUserId: " match-1 ",
      notifyWali: true,
      idempotencyKey: " key-1 ",
    })).toEqual({
      matchedUserId: "match-1",
      notifyWali: true,
      idempotencyKey: "key-1",
    });
  });

  it("rejects malformed accept-match payloads", () => {
    for (const payload of [undefined, null, {}, { matchedUserId: "" }, { matchedUserId: "match-1", notifyWali: "yes" }]) {
      expect(() => parseAcceptMatchPayload(payload)).toThrow(HttpsError);
    }
  });

  it("requires a verified wali relation before accepting a match", () => {
    expect(() => buildAcceptedMatchUpdate({
      userId: "user-1",
      matchedUserId: "match-1",
      matches: [{ id: "match-1", ai_score: 92 }],
      waliRelation: { ...verifiedWaliRelation, status: "pending" },
      notifyWali: true,
      timestamp,
      idempotencyKey: "accept-1",
    })).toThrow(HttpsError);
  });

  it("accepts only an existing match and returns audited Firestore updates", () => {
    const result = buildAcceptedMatchUpdate({
      userId: "user-1",
      matchedUserId: "match-1",
      matches: [
        { id: "other-match", ai_score: 84 },
        { id: "match-1", ai_score: 92, suggested_questions: [] },
      ],
      waliRelation: verifiedWaliRelation,
      notifyWali: true,
      timestamp,
      idempotencyKey: "accept-1",
    });

    expect(result.matches[0]).toEqual({ id: "other-match", ai_score: 84 });
    expect(result.acceptedMatch).toMatchObject({
      id: "match-1",
      status: "accepted",
      acceptance: {
        status: "accepted",
        acceptedBy: "user-1",
        waliId: "wali-1",
        waliNotificationStatus: "queued",
        idempotencyKey: "accept-1",
      },
    });
    expect(result.auditEvent).toMatchObject({
      type: "match_acceptance",
      actorUserId: "user-1",
      matchedUserId: "match-1",
      waliId: "wali-1",
      notifyWali: true,
    });
    expect(result.notificationOutboxEvent).toMatchObject({
      type: "wali_match_acceptance_requested",
      status: "pending",
      userId: "user-1",
      matchedUserId: "match-1",
      waliId: "wali-1",
      attempts: 0,
      idempotencyKey: "accept-1",
    });
  });

  it("does not queue wali notification outbox records when notification is not requested", () => {
    const result = buildAcceptedMatchUpdate({
      userId: "user-1",
      matchedUserId: "match-1",
      matches: [{ id: "match-1", ai_score: 92 }],
      waliRelation: verifiedWaliRelation,
      notifyWali: false,
      timestamp,
    });

    expect(result.acceptedMatch).toMatchObject({
      acceptance: { waliNotificationStatus: "not_requested" },
    });
    expect(result.notificationOutboxEvent).toBeUndefined();
  });

  it("omits undefined idempotency keys from Firestore-bound records", () => {
    const result = buildAcceptedMatchUpdate({
      userId: "user-1",
      matchedUserId: "match-1",
      matches: [{ id: "match-1", ai_score: 92 }],
      waliRelation: verifiedWaliRelation,
      notifyWali: true,
      timestamp,
    });

    expect(result.auditEvent).not.toHaveProperty("idempotencyKey");
    expect(result.notificationOutboxEvent).not.toHaveProperty("idempotencyKey");
  });

  it("rejects acceptances for missing match candidates", () => {
    expect(() => buildAcceptedMatchUpdate({
      userId: "user-1",
      matchedUserId: "missing-match",
      matches: [{ id: "match-1" }],
      waliRelation: verifiedWaliRelation,
      notifyWali: true,
      timestamp,
    })).toThrow(HttpsError);
  });
});
