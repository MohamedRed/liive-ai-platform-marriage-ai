jest.mock("firebase-functions", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  deliverMatchAcceptanceNotification,
  MATCH_NOTIFICATION_MAX_ATTEMPTS,
} from "../domains/marriage/match-notifications";

describe("match acceptance notification delivery", () => {
  const baseEvent = {
    status: "pending",
    attempts: 0,
    userId: "user-1",
    matchedUserId: "match-1",
    waliId: "wali-1",
    type: "wali_match_acceptance_requested",
    payload: {
      userId: "user-1",
      matchedUserId: "match-1",
      waliId: "wali-1",
      notificationType: "match_acceptance_requested",
    },
  };

  function fakeDoc(data: Record<string, unknown>) {
    return {
      id: "outbox-1",
      data: () => data,
    };
  }

  function fakeDb(settingsData: Record<string, unknown> | null = { notification: { fcmToken: "fcm-token" } }) {
    const outboxSet = jest.fn().mockResolvedValue(undefined);
    const settingsSet = jest.fn().mockResolvedValue(undefined);
    return {
      outboxSet,
      settingsSet,
      collection: jest.fn((name: string) => ({
        doc: jest.fn((id?: string) => {
          if (name === "USER_SETTINGS") {
            expect(id).toBe("wali-1");
            return {
              get: jest.fn().mockResolvedValue({
                exists: Boolean(settingsData),
                data: () => settingsData,
              }),
              set: settingsSet,
            };
          }
          return { set: outboxSet };
        }),
      })),
    };
  }

  it("sends wali FCM notifications and marks outbox records sent", async () => {
    const db = fakeDb();
    const messaging = { send: jest.fn().mockResolvedValue("message-1") };

    await expect(deliverMatchAcceptanceNotification(db as any, messaging as any, fakeDoc(baseEvent) as any)).resolves.toBe("sent");

    expect(messaging.send).toHaveBeenCalledWith(expect.objectContaining({
      token: "fcm-token",
      notification: expect.objectContaining({
        title: expect.stringContaining("Match"),
      }),
      data: expect.objectContaining({
        type: "wali_match_acceptance_requested",
        userId: "user-1",
        matchedUserId: "match-1",
      }),
    }));
    expect(db.outboxSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "sent",
      fcmMessageId: "message-1",
    }), { merge: true });
  });

  it("skips delivery when the wali has no FCM token", async () => {
    const db = fakeDb({ notification: { fcmToken: null } });
    const messaging = { send: jest.fn() };

    await expect(deliverMatchAcceptanceNotification(db as any, messaging as any, fakeDoc(baseEvent) as any)).resolves.toBe("skipped");

    expect(messaging.send).not.toHaveBeenCalled();
    expect(db.outboxSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped",
      lastError: "Wali FCM token is missing",
    }), { merge: true });
  });

  it("dead-letters poison notifications after bounded attempts", async () => {
    const db = fakeDb();
    const messaging = { send: jest.fn() };

    await expect(deliverMatchAcceptanceNotification(
      db as any,
      messaging as any,
      fakeDoc({ ...baseEvent, attempts: MATCH_NOTIFICATION_MAX_ATTEMPTS }) as any,
    )).resolves.toBe("dead_letter");

    expect(messaging.send).not.toHaveBeenCalled();
    expect(db.outboxSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "dead_letter",
      lastError: "Maximum match notification delivery attempts exceeded",
    }), { merge: true });
  });

  it("clears permanently invalid wali FCM tokens instead of retrying forever", async () => {
    const db = fakeDb();
    const permanentError = Object.assign(new Error("Requested entity was not found."), {
      code: "messaging/registration-token-not-registered",
    });
    const messaging = { send: jest.fn().mockRejectedValue(permanentError) };

    await expect(deliverMatchAcceptanceNotification(db as any, messaging as any, fakeDoc(baseEvent) as any)).resolves.toBe("skipped");

    expect(db.settingsSet).toHaveBeenCalledWith(expect.objectContaining({
      notification: expect.objectContaining({
        fcmToken: expect.anything(),
        fcmTokenInvalidatedAt: expect.anything(),
      }),
    }), { merge: true });
    expect(db.outboxSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped",
      lastError: "Wali FCM token is permanently invalid",
    }), { merge: true });
  });

  it("marks transient delivery failures for retry", async () => {
    const db = fakeDb();
    const messaging = { send: jest.fn().mockRejectedValue(new Error("FCM unavailable")) };

    await expect(deliverMatchAcceptanceNotification(db as any, messaging as any, fakeDoc(baseEvent) as any)).resolves.toBe("failed");

    expect(db.outboxSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "delivery_failed",
      lastError: "FCM unavailable",
    }), { merge: true });
  });
});
