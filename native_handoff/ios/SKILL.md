---
name: just-marriage-ios
description: Implement Just Marriage UI in SwiftUI (iOS). Use after reading ../brand-and-voice.md. Provides drop-in token + component files (JMColor, JMTheme, JMFont, Components) and rules for building screens.
user-invocable: true
---

# Just Marriage — iOS / SwiftUI

Read **`../brand-and-voice.md`** first (tone, color usage, modesty rules). Then use the
files in this folder. Target iOS 16+ (uses `RoundedRectangle(style: .continuous)`,
`AngularGradient`, modern `Animation` APIs).

## Drop-in files

| File | What it provides |
|---|---|
| `JMColor.swift` | All color tokens + semantic aliases. The **only** file with hex literals. |
| `JMTheme.swift` | `JMSpace`, `JMRadius`, `JMBorder`, `JMShadow` (+ `.jmShadow`/`.jmHardShadow`), `JMMotion`. |
| `JMFont.swift` | `JMFont.display/sans` + ready styles; `Text.jmEyebrow()`. |
| `Components.swift` | `JMButton`, `JMBadge`, `JMCard`, `JMProgressRing`, `JMVoiceBars`, `JMScaleRating`, `JMAvatar`. |

Add all four to your target. They depend only on each other — no packages.

## Fonts (one-time)

1. Add **Anton-Regular.ttf** and **Public Sans** (weights 400/500/600/700/800/900) to the
   app target. *(These are Google-Fonts substitutes pending the licensed display face.)*
2. Register them in `Info.plist` under **UIAppFonts** (Fonts provided by application).
3. Confirm PostScript names match those in `JMFont.swift`
   (`Anton-Regular`, `PublicSans-SemiBold`, …) — print `UIFont.fontNames(forFamilyName:)` if unsure.

## Rules for screens

- **Backgrounds:** default `JMColor.surfacePage` (warm off-white). Use a saturated
  `JMColor.primary` / `JMColor.secondary` field only for a hero or celebratory screen —
  one per screen, max.
- **Headlines:** `JMFont.display(...)` with `.textCase(.uppercase)` and tight
  `.lineSpacing` (negative leading look). Body: `JMFont.sans`, `.lineSpacing(size*0.55)`.
- **Buttons:** `JMButton(_:variant:)` — `.primary` (pink) for the one key action,
  `.ink` for confirms, `.secondary` (cyan) for positive steps, `.outline`/`.ghost`
  otherwise. They already apply the springy press (`JMPressStyle`).
- **Cards:** `JMCard(variant:)` — `.plain` everyday, `.hard` for the poster/sticker look,
  `.tinted` for soft feature blocks.
- **Match score:** `JMProgressRing(value: 99, sublabel: "match")`.
- **Counselor voice UI:** `JMVoiceBars(active:)`; provide a Talk/Type toggle (the product
  supports both voice and text conversation).
- **Modesty:** show `JMAvatar(locked: true)` until a match is mutually accepted; never
  reveal a candidate photo before then. Surface a "Wali-supervised" label on post-match chat.
- **Questionnaire:** `JMScaleRating(value:)` is the 1–10 importance control.
- **Icons:** SF Symbols where a close match to the Solar set exists; keep weight bold.
  No emoji.

## Minimal example

```swift
ScrollView {
    VStack(alignment: .leading, spacing: JMSpace.x5) {
        Text("BEST MATCH YET").jmEyebrow()
        JMCard(variant: .hard) {
            HStack(spacing: JMSpace.x4) {
                JMProgressRing(value: 99, size: 104, sublabel: "match")
                VStack(alignment: .leading, spacing: 6) {
                    JMAvatar(locked: true, size: 44)
                    Text("Sister · 27").font(JMFont.headingSM)
                }
            }
            JMButton("Review match", variant: .primary, fullWidth: true) { }
                .padding(.top, JMSpace.x4)
        }
    }
    .padding(JMSpace.gutter)
}
.background(JMColor.surfacePage.ignoresSafeArea())
```

See `../components.md` for the full cross-platform component contracts and states.

## Full screens (`screens/`)

Complete, faithful recreations of the product — add them after the token/component files:

| File | Screen |
|---|---|
| `RootView.swift` | TabView (Talk/Matches/Profile/Wali/Settings) + onboarding gate. **Entry point.** |
| `JMModels.swift` | `AppState`, `Prospect`, `JMSectionHeader`. |
| `OnboardingView.swift` | Intent + brother/sister. |
| `CounselorHomeView.swift` | Voice home **with Talk / Type toggle** + text conversation. |
| `MatchmakingView.swift` | Best 99% match + search list; `MatchDetailSheet`. |
| `ProfileQuestionnaireView.swift` | Sections + 1–10 scale. |
| `WaliView.swift` | Guardian explainer + verification stepper. |
| `VerifyView.swift` | Phone OTP. |
| `ChatView.swift` | Wali-supervised post-match chat. |
| `SettingsView.swift` | Profile + preference toggles. |

Launch with `RootView()`. All screens depend only on the token/component files in this
folder. Fonts fall back to the system face until you bundle Anton + Public Sans.
