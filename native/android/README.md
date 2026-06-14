# Just Marriage Android

Native Android implementation for Just Marriage using Jetpack Compose and the `native_handoff` design system. The Android project includes bundled Anton/Public Sans typography assets and a branded adaptive launcher icon.

## Entry point

- `app/src/main/java/com/justmarriage/app/MainActivity.kt`
- `RootScreen()` renders the onboarding gate and bottom navigation tabs.

## Build

Requires JDK 17+ and the Android SDK. From this directory:

```bash
./gradlew assembleDebug
```

The Gradle wrapper is committed with Gradle 8.10.2 so Android builds do not depend on a globally installed Gradle. Hermes verified the wrapper with `./gradlew --version --no-daemon` and built the debug APK with `ANDROID_HOME=/home/hermes/android-sdk ./gradlew assembleDebug --no-daemon` after installing Android SDK 35 command-line packages locally. The debug APK is generated at `app/build/outputs/apk/debug/app-debug.apk`.

## Design system source

The source of truth remains `../../native_handoff`. App sources are copied into a standard Android project layout so Android Studio can open/build them directly.
