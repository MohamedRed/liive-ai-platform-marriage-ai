# Just Marriage Android

Native Android implementation for Just Marriage using Jetpack Compose and the `native_handoff` design system.

## Entry point

- `app/src/main/java/com/justmarriage/app/MainActivity.kt`
- `RootScreen()` renders the onboarding gate and bottom navigation tabs.

## Build

Requires JDK 17+ and the Android SDK. From this directory:

```bash
./gradlew assembleDebug
```

The Gradle wrapper is committed with Gradle 8.10.2 so Android builds do not depend on a globally installed Gradle. Hermes verified the wrapper with `./gradlew --version --no-daemon`. `./gradlew assembleDebug --no-daemon` currently reaches Android SDK resolution and then fails in this Linux environment because `ANDROID_HOME` / `sdk.dir` is not configured. Run the same command on a machine or CI runner with Android SDK 35 installed for full platform validation.

## Design system source

The source of truth remains `../../native_handoff`. App sources are copied into a standard Android project layout so Android Studio can open/build them directly.
