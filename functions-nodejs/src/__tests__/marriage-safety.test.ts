import { HttpsError } from "firebase-functions/v2/https";
import {
  buildMarriageSafetyBlockWrite,
  buildMarriageSafetyReportReviewWrite,
  buildMarriageSafetyReportWrite,
  parseBlockMarriageUserPayload,
  parseReviewMarriageReportPayload,
  parseReportMarriageUserPayload,
  requireMarriageSafetyModerator,
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

  it("requires moderator or admin claims for report review", () => {
    expect(requireMarriageSafetyModerator({ uid: " moderator-1 ", token: { marriageModerator: true } })).toBe("moderator-1");
    expect(requireMarriageSafetyModerator({ uid: "admin-1", token: { roles: ["user", "admin"] } })).toBe("admin-1");
    expect(() => requireMarriageSafetyModerator({ uid: "user-1", token: { roles: ["user"] } })).toThrow(HttpsError);
    expect(() => requireMarriageSafetyModerator(undefined)).toThrow(HttpsError);
  });

  it("parses report-review payloads with bounded moderator notes", () => {
    expect(parseReviewMarriageReportPayload({
      reportId: " report-1 ",
      status: " resolved ",
      resolution: " user_warned ",
      moderatorNote: "  Reviewed evidence  ",
      idempotencyKey: " review-1 ",
    })).toEqual({
      reportId: "report-1",
      status: "resolved",
      resolution: "user_warned",
      moderatorNote: "Reviewed evidence",
      idempotencyKey: "review-1",
    });
  });

  it("rejects malformed report-review payloads", () => {
    for (const payload of [
      undefined,
      null,
      {},
      { reportId: "" },
      { reportId: "report-1", status: "unsupported" },
      { reportId: "report-1", status: "resolved", resolution: "unsupported" },
      { reportId: "report-1", status: "resolved", moderatorNote: "x".repeat(2001) },
      { reportId: "report-1", status: "resolved", idempotencyKey: "x".repeat(129) },
    ]) {
      expect(() => parseReviewMarriageReportPayload(payload)).toThrow(HttpsError);
    }
  });

  it("builds report review updates without leaking moderator notes to audit logs", () => {
    const write = buildMarriageSafetyReportReviewWrite({
      moderatorUserId: " moderator-1 ",
      payload: {
        reportId: "report-1",
        status: "resolved",
        resolution: "user_warned",
        moderatorNote: "Sensitive moderation note",
        idempotencyKey: "review-1",
      },
      existingReport: {
        reporterUserId: "actor-user",
        targetUserId: "target-user",
        category: "safety_concern",
      },
      timestamp,
    });

    expect(write.reportUpdate).toMatchObject({
      status: "resolved",
      resolution: "user_warned",
      moderatorNote: "Sensitive moderation note",
      reviewedBy: "moderator-1",
      reviewedAt: timestamp,
      updatedAt: timestamp,
      idempotencyKey: "review-1",
    });
    expect(write.auditEvent).toMatchObject({
      type: "marriage_report_reviewed",
      moderatorUserId: "moderator-1",
      reportId: "report-1",
      reporterUserId: "actor-user",
      targetUserId: "target-user",
      category: "safety_concern",
      status: "resolved",
      resolution: "user_warned",
      idempotencyKey: "review-1",
      createdAt: timestamp,
    });
    expect(write.auditEvent).not.toHaveProperty("moderatorNote");
    expect(write.targetUserUpdate).toBeUndefined();
  });

  it("builds a target-user suspension update for profile-suspension resolutions", () => {
    const write = buildMarriageSafetyReportReviewWrite({
      moderatorUserId: " moderator-1 ",
      payload: {
        reportId: "report-1",
        status: "resolved",
        resolution: "profile_suspended",
        moderatorNote: "Sensitive moderation note",
        idempotencyKey: "review-1",
      },
      existingReport: {
        reporterUserId: "actor-user",
        targetUserId: "target-user",
        category: "safety_concern",
      },
      timestamp,
    });

    expect(write.targetUserId).toBe("target-user");
    expect(write.targetUserUpdate).toMatchObject({
      status: "suspended",
      accountStatus: "suspended",
      updatedAt: timestamp,
      safety: {
        moderationStatus: "suspended",
        suspendedBy: "moderator-1",
        suspensionReportId: "report-1",
        suspendedAt: timestamp,
      },
    });
    expect(write.auditEvent).toMatchObject({
      type: "marriage_report_reviewed",
      resolution: "profile_suspended",
      targetUserId: "target-user",
    });
    expect(write.auditEvent).not.toHaveProperty("moderatorNote");
  });
});
