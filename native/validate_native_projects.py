#!/usr/bin/env python3
"""Validate that the Just Marriage native app skeletons are present.

This is intentionally lightweight so it can run on Linux without Xcode or the Android SDK.
Full platform builds must still be run on macOS/Android CI.
"""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
ANDROID_DESIGN_FILES = ["Color.kt", "Components.kt", "Dimens.kt", "Shape.kt", "Theme.kt", "Type.kt"]
ANDROID_SCREEN_FILES = [
    "ChatScreen.kt",
    "CounselorHomeScreen.kt",
    "MatchmakingScreen.kt",
    "Models.kt",
    "OnboardingScreen.kt",
    "ProfileQuestionnaireScreen.kt",
    "RootScreen.kt",
    "SettingsScreen.kt",
    "VerifyScreen.kt",
    "WaliScreen.kt",
]
IOS_DESIGN_FILES = ["Components.swift", "JMColor.swift", "JMFont.swift", "JMTheme.swift"]
IOS_SCREEN_FILES = [
    "ChatView.swift",
    "CounselorHomeView.swift",
    "JMModels.swift",
    "MatchmakingView.swift",
    "OnboardingView.swift",
    "ProfileQuestionnaireView.swift",
    "RootView.swift",
    "SettingsView.swift",
    "VerifyView.swift",
    "WaliView.swift",
]

REQUIRED = [
    ROOT / "README.md",
    ROOT / "android/.gitignore",
    ROOT / "android/README.md",
    ROOT / "android/settings.gradle.kts",
    ROOT / "android/build.gradle.kts",
    ROOT / "android/app/build.gradle.kts",
    ROOT / "android/app/src/main/AndroidManifest.xml",
    ROOT / "android/app/src/main/java/com/justmarriage/app/MainActivity.kt",
    ROOT / "android/app/src/main/res/values/strings.xml",
    ROOT / "android/app/src/main/res/values/styles.xml",
    ROOT / "ios/README.md",
    ROOT / "ios/project.yml",
    ROOT / "ios/JustMarriage/JustMarriageApp.swift",
    ROOT / "ios/JustMarriage/Info.plist",
    *[
        ROOT / "android/app/src/main/java/com/justmarriage/design" / name
        for name in ANDROID_DESIGN_FILES
    ],
    *[
        ROOT / "android/app/src/main/java/com/justmarriage/app" / name
        for name in ANDROID_SCREEN_FILES
    ],
    *[ROOT / "ios/JustMarriage/Design" / name for name in IOS_DESIGN_FILES],
    *[ROOT / "ios/JustMarriage/Screens" / name for name in IOS_SCREEN_FILES],
]

missing = [path.relative_to(ROOT) for path in REQUIRED if not path.exists()]
if missing:
    print("Missing native project files:")
    for path in missing:
        print(f"- {path}")
    sys.exit(1)

# Ensure generated app sources still carry the intended product entry points.
checks = {
    ROOT / "android/app/src/main/AndroidManifest.xml": [".app.MainActivity"],
    ROOT / "android/app/src/main/java/com/justmarriage/app/MainActivity.kt": ["ComponentActivity", "RootScreen()"],
    ROOT / "android/app/src/main/java/com/justmarriage/app/RootScreen.kt": [
        "JustMarriageTheme",
        "OnboardingScreen",
        "CounselorHomeScreen",
        "MatchmakingScreen",
        "ProfileQuestionnaireScreen",
        "WaliScreen",
        "SettingsScreen",
    ],
    ROOT / "ios/JustMarriage/JustMarriageApp.swift": ["@main", "RootView()"],
    ROOT / "ios/JustMarriage/Screens/RootView.swift": [
        "TabView",
        "OnboardingView",
        "CounselorHomeView",
        "MatchmakingView",
        "ProfileQuestionnaireView",
        "WaliView",
        "SettingsView",
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            print(f"{path.relative_to(ROOT)} does not contain expected marker: {needle}")
            sys.exit(1)

root_view = (ROOT / "ios/JustMarriage/Screens/RootView.swift").read_text(encoding="utf-8")
if "#Preview" in root_view:
    print("RootView.swift uses #Preview but project.yml targets iOS 16.0")
    sys.exit(1)

print("Native project skeleton validation passed.")
