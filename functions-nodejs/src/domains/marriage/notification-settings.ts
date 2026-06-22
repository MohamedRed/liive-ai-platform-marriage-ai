import { HttpsError } from "firebase-functions/v2/https";

export type NotificationDevicePlatform = "ios" | "android" | "web";

export interface RegisterNotificationDevicePayload {
  fcmToken: string;
  platform?: NotificationDevicePlatform;
  deviceId?: string;
  appVersion?: string;
}

export interface NotificationDeviceRegistrationWriteInput {
  userId: string;
  payload: RegisterNotificationDevicePayload;
  existingSettings?: unknown;
  timestamp: unknown;
}

export interface NotificationDeviceRegistrationWriteResult {
  settingsRecord: Record<string, unknown>;
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

function parsePlatform(value: unknown): NotificationDevicePlatform | undefined {
  const platform = trimOptionalString(value)?.toLowerCase();
  if (!platform) {
    return undefined;
  }
  if (platform === "ios" || platform === "android" || platform === "web") {
    return platform;
  }
  throw new HttpsError("invalid-argument", "platform must be one of ios, android, or web.");
}

function boundedOptionalString(value: unknown, fieldName: string, maxLength: number): string | undefined {
  const trimmed = trimOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

function notificationSettings(existingSettings: unknown): Record<string, unknown> {
  if (!existingSettings || typeof existingSettings !== "object" || Array.isArray(existingSettings)) {
    return {};
  }
  const notification = (existingSettings as Record<string, unknown>).notification;
  if (!notification || typeof notification !== "object" || Array.isArray(notification)) {
    return {};
  }
  return { ...(notification as Record<string, unknown>) };
}

export function parseRegisterNotificationDevicePayload(data: unknown): RegisterNotificationDevicePayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Notification device registration payload is required.");
  }

  const payload = data as Record<string, unknown>;
  const fcmToken = trimRequiredString(payload.fcmToken, "fcmToken");
  if (fcmToken.length > 4096) {
    throw new HttpsError("invalid-argument", "fcmToken must be at most 4096 characters.");
  }

  return {
    fcmToken,
    platform: parsePlatform(payload.platform),
    deviceId: boundedOptionalString(payload.deviceId, "deviceId", 256),
    appVersion: boundedOptionalString(payload.appVersion, "appVersion", 128),
  };
}

export function buildNotificationDeviceRegistrationWrite(
  input: NotificationDeviceRegistrationWriteInput,
): NotificationDeviceRegistrationWriteResult {
  const userId = trimRequiredString(input.userId, "userId");
  const notification = notificationSettings(input.existingSettings);
  const nextNotification = {
    ...notification,
    fcmToken: input.payload.fcmToken,
    fcmTokenUpdatedAt: input.timestamp,
    ...(input.payload.platform ? { platform: input.payload.platform } : {}),
    ...(input.payload.deviceId ? { deviceId: input.payload.deviceId } : {}),
    ...(input.payload.appVersion ? { appVersion: input.payload.appVersion } : {}),
    enabled: true,
  };

  return {
    settingsRecord: {
      userId,
      notification: nextNotification,
      updatedAt: input.timestamp,
    },
    auditEvent: {
      type: "notification_device_registered",
      actorUserId: userId,
      ...(input.payload.platform ? { platform: input.payload.platform } : {}),
      ...(input.payload.deviceId ? { deviceId: input.payload.deviceId } : {}),
      ...(input.payload.appVersion ? { appVersion: input.payload.appVersion } : {}),
      createdAt: input.timestamp,
    },
  };
}
