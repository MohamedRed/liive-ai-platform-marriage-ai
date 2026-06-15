# Just Marriage native service contracts

This document defines the backend/service surface needed to replace the native preview blockers in Android and iOS.

The native apps currently expose matching service-boundary interfaces in:

- Android: `android/app/src/main/java/com/justmarriage/app/Services.kt`
- iOS: `ios/JustMarriage/Services.swift`

Preview implementations must remain conservative: they may show entered local state, but they must not claim that identity, OTP, wali notification, chat delivery, or auth actions succeeded until a real service implementation is wired.

## Cross-cutting requirements

- Authentication: every production request must use an authenticated session token issued by the production auth provider.
- Privacy: locked prospect photos and personal contact details must not be returned until both sides and wali rules permit disclosure.
- Auditability: wali-visible actions must create an immutable audit event with actor, timestamp, device/session, and action metadata.
- Idempotency: mutating calls from mobile clients should accept an idempotency key to prevent duplicate submissions on retry.
- Error shape: production adapters should map backend failures into user-safe copy without leaking provider errors or secrets.
- Halal flow: match acceptance, supervised chat, and video scheduling must enforce wali/state-machine checks server-side, not only in the native UI.

## Service surfaces

### AuthService

Purpose: sign out and session lifecycle.

Required production operations:

- `signOut()`
  - Invalidates the current refresh/session token.
  - Clears local credentials only after server acknowledgement or a safe offline fallback policy is defined.

Recommended endpoint:

```http
POST /v1/auth/sign-out
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
```

Success response:

```json
{ "status": "signed_out" }
```

### VerificationService

Purpose: phone/identity verification.

Required production operations:

- `verifyPhoneCode(code)`
  - Verifies the OTP with the secure provider.
  - Never accepts locally generated or prefilled OTP values.
  - Rate-limits attempts and returns retry windows.

Recommended endpoint:

```http
POST /v1/verification/phone/confirm
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
Content-Type: application/json

{ "code": "1234" }
```

Success response:

```json
{
  "status": "verified",
  "verified_at": "2026-06-14T00:00:00Z",
  "next_step": "identity"
}
```

### ProfileService

Purpose: save questionnaire answers and profile state.

Required production operations:

- `saveQuestionnaireAnswer(section, rating)`
  - Persists answer draft or submitted state.
  - Returns updated completion percentage and next required section.

Recommended endpoint:

```http
PUT /v1/profile/questionnaire/{section}
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
Content-Type: application/json

{ "rating": 8 }
```

Success response:

```json
{
  "status": "saved",
  "completion_percent": 62,
  "next_section": "children_future_plans"
}
```

### MatchingService

Purpose: load prospects and accept matches with wali checks.

Required production operations:

- `canNotifyWali`
  - Derived from server-side state: verified user, active wali, match availability, disclosure rules.
- `acceptAndNotifyWali(prospect)`
  - Accepts a match only if server rules allow it.
  - Notifies wali and records an audit event.

Recommended endpoint:

```http
POST /v1/matches/{match_id}/accept
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
Content-Type: application/json

{ "notify_wali": true }
```

Success response:

```json
{
  "status": "accepted",
  "wali_notification_status": "queued",
  "chat_id": "chat_123"
}
```

### WaliService

Purpose: manage guardian invite/verification lifecycle.

Required production operations:

- `inviteDifferentWali()`
  - Starts a replacement wali flow only when allowed by the current verification state.
  - Cancels or preserves previous wali state according to product/legal rules.

Recommended endpoint:

```http
POST /v1/wali/invitations
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "relationship": "father",
  "phone": "+447000000000"
}
```

Success response:

```json
{
  "status": "invited",
  "wali_id": "wali_123",
  "verification_status": "pending"
}
```

### ChatService

Purpose: wali-supervised chat and video scheduling.

Required production operations:

- `startSupervisedVideoCall()`
  - Must validate match status, wali approvals, and scheduled time.
  - Should return a provider session token only after server authorization.

Recommended endpoint:

```http
POST /v1/chats/{chat_id}/video-sessions
Authorization: Bearer <access_token>
Idempotency-Key: <uuid>
```

Success response:

```json
{
  "status": "ready",
  "provider": "daily",
  "join_url": "https://example.invalid/room/token",
  "expires_at": "2026-06-14T01:00:00Z"
}
```

### NotificationService

Purpose: push notification registration and notification center access.

Required production operations:

- `openNotifications()` or equivalent notification-center fetch.
- Device token registration/refresh.

Recommended endpoints:

```http
PUT /v1/devices/{device_id}/push-token
GET /v1/notifications?limit=50
```

Notification response shape:

```json
{
  "items": [
    {
      "id": "notification_123",
      "type": "match_update",
      "title": "Wali review requested",
      "body": "Your wali has been notified.",
      "created_at": "2026-06-14T00:00:00Z",
      "read_at": null
    }
  ]
}
```

## Native adapter guidance

Production adapters should implement the Android and iOS service contracts directly and keep UI screens unaware of HTTP/provider details.

Recommended structure:

- `Preview*Service`: current safe preview blockers.
- `Remote*Service`: production implementation backed by API client.
- `ServiceEnvironment` / dependency container: injects preview vs production services.
- Tests: verify blockers remain in preview mode and production adapters map backend responses without fake success.

## Release gate checklist

Before this native app can leave draft/review state:

- Android `assembleDebug` and release build run in CI.
- iOS `xcodebuild` succeeds on macOS CI.
- OTP confirmation uses a real verification provider.
- Wali notification is server-side and audited.
- Match accept cannot bypass wali state machine.
- Chat/video session creation requires server authorization.
- Push notification token registration is implemented.
- Emulator/simulator screenshots confirm visual parity against the source references.
