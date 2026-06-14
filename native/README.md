# Just Marriage Native Apps

This folder turns the `native_handoff` design system into standalone native app project skeletons:

- `android/` — Jetpack Compose Android app using `RootScreen()`
- `ios/` — SwiftUI iOS app using `RootView()` with an XcodeGen project spec

The current scope is UI shell + mock-data screens from `native_handoff`: onboarding, counselor talk/type, matchmaking, questionnaire, wali flow, verification, chat, and settings. Android now exposes explicit `AuthService`, `VerificationService`, `ProfileService`, `MatchingService`, `WaliService`, `ChatService`, and `NotificationService` contracts so production integrations can replace preview blockers without scattering fake success states through screens.

## Validate on this Linux environment

```bash
python3 validate_native_projects.py
# or from the repository root:
yarn validate:native
```

The validator is intentionally Linux-safe and now fails if native preview code regresses into misleading production behavior, including fake OTP success, prefilled OTP digits, fake wali notification success, missing service-boundary copy, or oversized Swift/Kotlin files.

## CI

`.github/workflows/native-static.yml` runs the Linux-safe native validator, Android Gradle wrapper check, Android `assembleDebug`, and `git diff --check` on PRs/pushes touching `native/**`. The workflow is currently stored as `native/ci/native-static.yml.template` because pushing active workflow files requires a GitHub token with `workflow` scope.

## Platform build requirements

- Android: JDK 17+, Android SDK 35, committed Gradle wrapper (`native/android/gradlew`).
- iOS: macOS + Xcode + XcodeGen.
