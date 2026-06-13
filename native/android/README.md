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

This repository currently does not include a Gradle wrapper. Open the folder in Android Studio or run `gradle wrapper` from a local Android toolchain to add one before using the command above. Hermes validation is limited to structural checks because this Linux environment has JDK 17 but no Android SDK/Gradle wrapper.

## Design system source

The source of truth remains `../../native_handoff`. App sources are copied into a standard Android project layout so Android Studio can open/build them directly.
