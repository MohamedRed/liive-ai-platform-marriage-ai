# Just Marriage Native Apps

This folder turns the `native_handoff` design system into standalone native app project skeletons:

- `android/` — Jetpack Compose Android app using `RootScreen()`
- `ios/` — SwiftUI iOS app using `RootView()` with an XcodeGen project spec

The current scope is UI shell + mock-data screens from `native_handoff`: onboarding, counselor talk/type, matchmaking, questionnaire, wali flow, verification, chat, and settings. Android and iOS now expose explicit `AuthService`, `VerificationService`, `ProfileService`, `MatchingService`, `WaliService`, `ChatService`, and `NotificationService` contracts so production integrations can replace preview blockers without scattering fake success states through screens.

Production backend requirements are captured in `docs/SERVICE_CONTRACTS.md`; it maps the Android/iOS service interfaces to the API semantics required before preview blockers can become real user flows.

## Validate on this Linux environment

```bash
python3 validate_native_projects.py
# or from the repository root:
yarn validate:native
```

The validator is intentionally Linux-safe and now fails if native preview code regresses into misleading production behavior, including fake OTP success, prefilled OTP digits, fake wali notification success, missing service-boundary copy, or oversized Swift/Kotlin files.

Run the same Linux-safe validation/build gates locally:

```bash
native/scripts/run-native-ci-locally.sh
```

This runs the native validator, Swift/Kotlin file-size gate, iOS AppIcon JSON validation, Android Gradle wrapper check, Android `assembleDebug`, and whitespace checks. On macOS with `xcodegen` and `xcodebuild` installed, the same script also generates and builds the iOS project.

## Appetize/Appetizer upload

After the Android debug APK is built, upload it to Appetize from a developer machine or CI environment with:

```bash
APPETIZE_API_TOKEN=... native/scripts/upload-android-to-appetize.sh
```

Optional environment variables:

- `APPETIZE_PUBLIC_KEY` — update an existing Appetize app instead of creating a new one
- `APK_PATH` — upload a specific APK path
- `APPETIZE_TIMEOUT` — Appetize session timeout; default `120`
- `APPETIZE_NOTE` — management-dashboard note for the upload

The script prints `APPETIZE_PUBLIC_KEY` and `APPETIZE_URL` on success. It refuses to upload when `APPETIZE_API_TOKEN` is missing, so credentials are never faked or embedded in the repo.

## CI

Active GitHub Actions workflows are installed under `.github/workflows`:

- `native-static.yml` runs the native validator, Android Gradle wrapper check, Android `assembleDebug`, macOS XcodeGen generation, iOS `xcodebuild`, and `git diff --check` on PRs/pushes touching `native/**`.
- `android-appetize.yml` builds a debug APK, uploads it as an artifact, and uploads it to Appetize when `APPETIZE_API_TOKEN` is configured.
- `ios-appetize.yml` builds and packages an iOS simulator `.app`, uploads it as an artifact, and uploads it to Appetize when `APPETIZE_API_TOKEN` is configured.

Repository secrets:

- `APPETIZE_API_TOKEN` enables Appetize upload for both platforms.
- `APPETIZE_PUBLIC_KEY` updates an existing Android Appetize app.
- `APPETIZE_IOS_PUBLIC_KEY` updates an existing iOS Appetize app.

## Platform build requirements

- Android: JDK 17+, Android SDK 35, committed Gradle wrapper (`native/android/gradlew`).
- iOS: macOS + Xcode + XcodeGen.
