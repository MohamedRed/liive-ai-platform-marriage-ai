#!/usr/bin/env python3
"""Validate that the Just Marriage native app skeletons are present.

This is intentionally lightweight so it can run on Linux without Xcode or the Android SDK.
Full platform builds must still be run on macOS/Android CI.
"""
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = ROOT.parent
HANDOFF_ROOT = WORKSPACE_ROOT / "native_handoff"
ANDROID_DESIGN_FILES = ["Color.kt", "Components.kt", "Dimens.kt", "Shape.kt", "Theme.kt", "Type.kt"]
ANDROID_SCREEN_FILES = [
    "ChatScreen.kt",
    "CounselorHomeScreen.kt",
    "MatchmakingScreen.kt",
    "Models.kt",
    "OnboardingScreen.kt",
    "ProfileQuestionnaireScreen.kt",
    "RootScreen.kt",
    "Services.kt",
    "SettingsScreen.kt",
    "VerifyScreen.kt",
    "VisualParityLaunch.kt",
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
    "VisualParityLaunch.swift",
    "WaliView.swift",
]

REQUIRED = [
    ROOT / "README.md",
    ROOT / "docs/SERVICE_CONTRACTS.md",
    ROOT / "scripts/run-native-ci-locally.sh",
    ROOT / "scripts/upload-android-to-appetize.sh",
    ROOT / "VISUAL_PARITY.md",
    ROOT / "android/.gitignore",
    ROOT / "android/README.md",
    ROOT / "android/gradlew",
    ROOT / "android/gradlew.bat",
    ROOT / "android/gradle/wrapper/gradle-wrapper.jar",
    ROOT / "android/gradle/wrapper/gradle-wrapper.properties",
    ROOT / "android/settings.gradle.kts",
    ROOT / "android/build.gradle.kts",
    ROOT / "android/app/build.gradle.kts",
    ROOT / "android/app/src/main/AndroidManifest.xml",
    ROOT / "android/app/src/main/java/com/justmarriage/app/MainActivity.kt",
    ROOT / "android/app/src/main/res/values/strings.xml",
    ROOT / "android/app/src/main/res/values/styles.xml",
    ROOT / "android/app/src/main/res/values/colors.xml",
    ROOT / "android/app/src/main/res/drawable/ic_launcher_foreground.xml",
    ROOT / "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
    ROOT / "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",
    ROOT / "android/app/src/main/res/font/anton_regular.ttf",
    ROOT / "android/app/src/main/res/font/public_sans.ttf",
    ROOT / "ios/README.md",
    ROOT / "ios/project.yml",
    ROOT / "ios/JustMarriage/JustMarriageApp.swift",
    ROOT / "ios/JustMarriage/Info.plist",
    ROOT / "ios/JustMarriage/Services.swift",
    ROOT / "ios/JustMarriage/Assets.xcassets/AppIcon.appiconset/Contents.json",
    ROOT / "ios/JustMarriage/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png",
    ROOT / "ios/JustMarriage/Resources/Fonts/Anton-Regular.ttf",
    ROOT / "ios/JustMarriage/Resources/Fonts/PublicSans[wght].ttf",
    ROOT / "fonts/licenses/anton-OFL.txt",
    ROOT / "fonts/licenses/public-sans-OFL.txt",
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
    *[HANDOFF_ROOT / "android" / name for name in ANDROID_DESIGN_FILES],
    *[HANDOFF_ROOT / "android/screens" / name for name in ANDROID_SCREEN_FILES],
    *[HANDOFF_ROOT / "ios" / name for name in IOS_DESIGN_FILES],
    HANDOFF_ROOT / "ios/Services.swift",
    *[HANDOFF_ROOT / "ios/screens" / name for name in IOS_SCREEN_FILES],
]

missing = [path.relative_to(ROOT) for path in REQUIRED if not path.exists()]
if missing:
    print("Missing native project files:")
    for path in missing:
        print(f"- {path}")
    sys.exit(1)

# Ensure generated app sources still carry the intended product entry points.
checks = {
    ROOT / "android/app/src/main/AndroidManifest.xml": [".app.MainActivity", "@mipmap/ic_launcher", "@mipmap/ic_launcher_round", "@string/app_name", "justmarriage"],
    ROOT / "android/app/src/main/java/com/justmarriage/app/MainActivity.kt": ["ComponentActivity", "visual_screen", "RootScreen(visualScreenKey = visualScreen)"],
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
    ROOT / "ios/project.yml": ["ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon", "UIAppFonts"],
    ROOT / "ios/JustMarriage/Info.plist": ["UIAppFonts", "Anton-Regular.ttf", "PublicSans[wght].ttf"],
    ROOT / "ios/JustMarriage/Screens/RootView.swift": [
        "TabView",
        "VisualParityLaunch.processScreen()",
        "OnboardingView",
        "CounselorHomeView",
        "MatchmakingView",
        "ProfileQuestionnaireView",
        "WaliView",
        "SettingsView",
    ],
    ROOT / "docs/SERVICE_CONTRACTS.md": [
        "AuthService",
        "VerificationService",
        "ProfileService",
        "MatchingService",
        "WaliService",
        "ChatService",
        "NotificationService",
        "Release gate checklist",
    ],
    ROOT / "scripts/run-native-ci-locally.sh": [
        "validate_native_projects.py",
        "./gradlew assembleDebug --no-daemon",
        "xcodebuild",
    ],
    ROOT / "scripts/upload-android-to-appetize.sh": [
        "APPETIZE_API_TOKEN",
        "https://api.appetize.io",
        "/v1/apps/",
        "APPETIZE_URL=https://appetize.io/app/",
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

# Product-trust gates: preview scaffolds must not fake verification or notifications.
FORBIDDEN_STRINGS = [
    "Phone verified locally",
    "Wali notified",
    "Checking code",
    "Acceptance saved locally",
    "is notified at every step",
]
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix not in {".kt", ".swift", ".md"}:
        continue
    text = path.read_text(encoding="utf-8")
    for forbidden in FORBIDDEN_STRINGS:
        if forbidden in text:
            print(f"{path.relative_to(ROOT)} contains forbidden scaffold/product-trust copy: {forbidden}")
            sys.exit(1)

otp_initializers = {
    ROOT / "ios/JustMarriage/Screens/VerifyView.swift": r"code:\s*\[String\]\s*=\s*\[\s*\"\d\"",
    ROOT / "android/app/src/main/java/com/justmarriage/app/VerifyScreen.kt": r"mutableStateListOf\(\s*\"\d\"",
}
for path, pattern in otp_initializers.items():
    if re.search(pattern, path.read_text(encoding="utf-8")):
        print(f"{path.relative_to(ROOT)} pre-fills an OTP digit; OTP fields must start empty")
        sys.exit(1)

service_boundary_checks = {
    ROOT / "ios/JustMarriage/Screens/MatchmakingView.swift": [
        "private var waliNotificationAvailable: Bool { services.matching.canNotifyWali }",
        "serviceNoticeVisible = true",
        "services.matching.acceptAndNotifyWali(prospect: prospect).message",
    ],
    ROOT / "ios/JustMarriage/Services.swift": [
        "protocol AuthService",
        "protocol VerificationService",
        "protocol ProfileService",
        "protocol MatchingService",
        "protocol WaliService",
        "protocol ChatService",
        "protocol NotificationService",
        "Verification service is not connected yet",
        "Wali notification service is required before this acceptance can be sent.",
    ],
    ROOT / "android/app/src/main/java/com/justmarriage/app/MatchmakingScreen.kt": [
        "val waliNotificationAvailable = services.matching.canNotifyWali",
        "MatchDetail(Mock.bestMatch, serviceNotice, onClose = { showDetail = false }) { serviceNotice = true }",
        "services.matching.acceptAndNotifyWali(p).message()",
    ],
    ROOT / "android/app/src/main/java/com/justmarriage/app/Services.kt": [
        "interface AuthService",
        "interface VerificationService",
        "interface ProfileService",
        "interface MatchingService",
        "interface WaliService",
        "interface ChatService",
        "interface NotificationService",
        "Verification service is not connected yet",
        "Wali notification service is required before this acceptance can be sent.",
    ],
    ROOT / "ios/JustMarriage/Screens/VerifyView.swift": [
        "PreviewJustMarriageServices.current.verification",
    ],
    ROOT / "android/app/src/main/java/com/justmarriage/app/VerifyScreen.kt": [
        "PreviewJustMarriageServices.current.verification.verifyPhoneCode",
    ],
}
for path, needles in service_boundary_checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            print(f"{path.relative_to(ROOT)} is missing service-boundary marker: {needle}")
            sys.exit(1)

mirror_pairs = [
    *[
        (
            ROOT / "android/app/src/main/java/com/justmarriage/design" / name,
            HANDOFF_ROOT / "android" / name,
        )
        for name in ANDROID_DESIGN_FILES
    ],
    *[
        (
            ROOT / "android/app/src/main/java/com/justmarriage/app" / name,
            HANDOFF_ROOT / "android/screens" / name,
        )
        for name in ANDROID_SCREEN_FILES
    ],
    *[
        (
            ROOT / "ios/JustMarriage/Design" / name,
            HANDOFF_ROOT / "ios" / name,
        )
        for name in IOS_DESIGN_FILES
    ],
    (ROOT / "ios/JustMarriage/Services.swift", HANDOFF_ROOT / "ios/Services.swift"),
    *[
        (
            ROOT / "ios/JustMarriage/Screens" / name,
            HANDOFF_ROOT / "ios/screens" / name,
        )
        for name in IOS_SCREEN_FILES
    ],
]
for source, mirror in mirror_pairs:
    if source.read_bytes() != mirror.read_bytes():
        source_name = source.relative_to(WORKSPACE_ROOT)
        mirror_name = mirror.relative_to(WORKSPACE_ROOT)
        print(f"Handoff mirror drift: {mirror_name} must match {source_name}")
        sys.exit(1)

for path in ROOT.rglob("*"):
    if path.is_file() and path.suffix in {".kt", ".swift"}:
        line_count = sum(1 for _ in path.open(encoding="utf-8"))
        if line_count > 300:
            print(f"{path.relative_to(ROOT)} is {line_count} lines; split files over 300 lines")
            sys.exit(1)

print("Native project skeleton validation passed.")
