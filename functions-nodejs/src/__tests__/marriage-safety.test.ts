import { HttpsError } from "firebase-functions/v2/https";
import {
  buildMarriageSafetyBlockWrite,
  buildMarriageSafetyReportWrite,
  parseBlockMarriageUserPayload,
  parseReportMarriageUserPayload,
} from "../domains/marriage/safety";

describe("marriage safety block/report APIs", () => {
  const timestamp = { seconds: 123, nanoseconds: 456 };

  it("parses and canonicalizes block payloads", () => {
    expect(parseBlockMarriageUserPayload({
      targetUserId: " target-user ",
      reason: "  Not comfortable  ",
      idempotencyKey: " block-1 ",
    })).toEqual({
      targetUserId: "target-user",
      reason: "Not comfortable",
      idempotencyKey: "block-1",
    });
  });

  it("rejects malformed block payloads", () => {
    for (const payload of [
      undefined,
      null,
      {},
      { targetUserId: "" },
      { targetUserId: "target-user", reason: "x".repeat(501) },
      { targetUserId: "target-user", idempotencyKey: "x".repeat(129) },
    ]) {
      expect(() => parseBlockMarriageUserPayload(payload)).toThrow(HttpsError);
    }
  });

  it("builds block/profile/audit records without exposing free-text reason in audit", () => {
    const write = buildMarriageSafetyBlockWrite({
      actorUserId: " actor-user ",
      payload: { targetUserId: " target-user ", reason: "Sensitive details", idempotencyKey: "block-1" },
      timestamp,
    });

    expect(write.blockId).toBe("actor-user_target-user");
    expect(write.blockRecord).toMatchObject({
      actorUserId: "actor-user",
      targetUserId: "target-user",
      reason: "Sensitive details",
      status: "active",
      idempotencyKey: "block-1",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(write.auditEvent).toMatchObject({
      type: "marriage_user_blocked",
      actorUserId: "actor-user",
      targetUserId: "target-user",
      idempotencyKey: "block-1",
      createdAt: timestamp,
    });
    expect(write.auditEvent).not.toHaveProperty("reason");
  });

  it("rejects self-blocks before Firestore writes", () => {
    expect(() => buildMarriageSafetyBlockWrite({
      actorUserId: "user-1",
      payload: { targetUserId: "user-1" },
      timestamp,
    })).toThrow(HttpsError);
  });

  it("parses and canonicalizes report payloads", () => {
    expect(parseReportMarriageUserPayload({
      targetUserId: " target-user ",
      category: " fake_profile ",
      description: "  Profile appears fake  ",
      idempotencyKey: " report-1 ",
    })).toEqual({
      targetUserId: "target-user",
      category: "fake_profile",
      description: "Profile appears fake",
      idempotencyKey: "report-1",
    });
  });

  it("rejects malformed report payloads", () => {
    for (const payload of [
      undefined,
      null,
      {},
      { targetUserId: "" },
      { targetUserId: "target-user", category: "unsupported" },
      { targetUserId: "target-user", category: "other", description: "x".repeat(2001) },
    ]) {
      expect(() => parseReportMarriageUserPayload(payload)).toThrow(HttpsError);
    }
  });

  it("builds moderation report and token-free audit records", () => {
    const write = buildMarriageSafetyReportWrite({
      actorUserId: " actor-user ",
      payload: {
        targetUserId: " target-user ",
        category: "safety_concern",
        description: "Needs moderator review",
        idempotencyKey: "report-1",
      },
      timestamp,
    });

    expect(write.reportRecord).toMatchObject({
      reporterUserId: "actor-user",
      targetUserId: "target-user",
      category: "safety_concern",
      description: "Needs moderator review",
      status: "pending_review",
      idempotencyKey: "report-1",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(write.auditEvent).toMatchObject({
      type: "marriage_user_reported",
      actorUserId: "actor-user",
      targetUserId: "target-user",
      category: "safety_concern",
      idempotencyKey: "report-1",
      createdAt: timestamp,
    });
    expect(write.auditEvent).not.toHaveProperty("description");
  });
});
