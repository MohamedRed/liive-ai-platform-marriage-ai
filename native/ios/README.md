# Just Marriage iOS

Native iOS implementation for Just Marriage using SwiftUI and the `native_handoff` design system.

## Entry point

- `JustMarriage/JustMarriageApp.swift`
- `RootView()` renders the onboarding gate and tabbed app shell.

## Generate/open the Xcode project

This folder uses an XcodeGen spec so the project can be regenerated cleanly from source:

```bash
brew install xcodegen
xcodegen generate
open JustMarriage.xcodeproj
```

Hermes is running on Linux, so `xcodebuild` is not available here. Final iOS build validation must be run on macOS/Xcode.

## Design system source

The source of truth remains `../../native_handoff`. App sources are copied into a standard SwiftUI app layout so Xcode can open/build them directly after generating the project.
