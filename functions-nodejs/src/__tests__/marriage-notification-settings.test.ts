import { HttpsError } from "firebase-functions/v2/https";
import {
  buildNotificationDeviceRegistrationWrite,
  parseRegisterNotificationDevicePayload,
} from "../domains/marriage/notification-settings";

describe("marriage notification device registration", () => {
  const timestamp = { seconds: 123, nanoseconds: 456 };

  it("parses and canonicalizes notification device registration payloads", () => {
    expect(parseRegisterNotificationDevicePayload({
      fcmToken: "  fcm-token-1  ",
      platform: " IOS ",
      deviceId: " device-1 ",
      appVersion: " 1.2.3 ",
    })).toEqual({
      fcmToken: "fcm-token-1",
      platform: "ios",
      deviceId: "device-1",
      appVersion: "1.2.3",
    });
  });

  it("rejects malformed notification device registration payloads", () => {
    for (const payload of [
      undefined,
      null,
      {},
      { fcmToken: "" },
      { fcmToken: "x".repeat(4097) },
      { fcmToken: "token", platform: "desktop" },
      { fcmToken: "token", deviceId: "x".repeat(257) },
      { fcmToken: "token", appVersion: "x".repeat(129) },
    ]) {
      expect(() => parseRegisterNotificationDevicePayload(payload)).toThrow(HttpsError);
    }
  });

  it("builds a merge-safe settings update without dropping existing notification preferences", () => {
    const result = buildNotificationDeviceRegistrationWrite({
      userId: " user-1 ",
      payload: {
        fcmToken: "fcm-token-1",
        platform: "android",
        deviceId: "pixel-8",
        appVersion: "1.2.3",
      },
      existingSettings: {
        notification: {
          preferences: {
            matchAccepted: true,
            marketing: false,
          },
          quietHours: { start: "22:00", end: "07:00" },
        },
      },
      timestamp,
    });

    expect(result.settingsRecord).toEqual({
      userId: "user-1",
      notification: {
        preferences: {
          matchAccepted: true,
          marketing: false,
        },
        quietHours: { start: "22:00", end: "07:00" },
        fcmToken: "fcm-token-1",
        fcmTokenUpdatedAt: timestamp,
        platform: "android",
        deviceId: "pixel-8",
        appVersion: "1.2.3",
        enabled: true,
      },
      updatedAt: timestamp,
    });
    expect(result.auditEvent).toMatchObject({
      type: "notification_device_registered",
      actorUserId: "user-1",
      platform: "android",
      deviceId: "pixel-8",
      appVersion: "1.2.3",
      createdAt: timestamp,
    });
    expect(result.auditEvent).not.toHaveProperty("fcmToken");
  });
});
