# Just Marriage Native Apps

This folder turns the `native_handoff` design system into standalone native app project skeletons:

- `android/` — Jetpack Compose Android app using `RootScreen()`
- `ios/` — SwiftUI iOS app using `RootView()` with an XcodeGen project spec

The current scope is UI shell + mock-data screens from `native_handoff`: onboarding, counselor talk/type, matchmaking, questionnaire, wali flow, verification, chat, and settings. Real auth, voice streaming, matching backend, push notifications, and store release plumbing are intentionally not wired yet.

## Validate on this Linux environment

```bash
python3 validate_native_projects.py
```

## Platform build requirements

- Android: JDK 17+, Android SDK/Android Studio, Gradle wrapper generated locally.
- iOS: macOS + Xcode + XcodeGen.
