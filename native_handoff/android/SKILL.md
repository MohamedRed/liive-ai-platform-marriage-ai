---
name: just-marriage-android
description: Implement Just Marriage UI in Jetpack Compose (Android, Material 3). Use after reading ../brand-and-voice.md. Provides drop-in token + component files (Color, Dimens, Shape, Type, Theme, Components) and rules for building screens.
user-invocable: true
---

# Just Marriage — Android / Jetpack Compose

Read **`../brand-and-voice.md`** first (tone, color usage, modesty rules). Then use the
files in this folder. Target Compose BOM 2024.02+ with Material 3.

## Drop-in files

| File | What it provides |
|---|---|
| `Color.kt` | `JMPalette` (the **only** hex literals) + `JMColors` semantic aliases. |
| `Dimens.kt` | `JMSpace`, `JMRadius`, `JMBorder`, `JMMotion`. |
| `Shape.kt` | `JMShapes` + `JMMaterialShapes`. |
| `Type.kt` | `JMFontFamily`, `JMText` styles, `JMTypography`. |
| `Theme.kt` | `JustMarriageTheme { … }` — Material 3 wiring. |
| `Components.kt` | `JMButton`, `JMBadge`, `JMCard`, `JMProgressRing`, `JMScaleRating`, `JMAvatar`. |

Change the `package com.justmarriage.design` line to your module's package. Wrap your app
in `JustMarriageTheme { }`.

## Fonts (one-time)

1. Drop font files in `res/font/` (lowercase, underscores):
   `anton_regular.ttf`, `public_sans_regular.ttf`, `..._medium`, `..._semibold`,
   `..._bold`, `..._extrabold`, `..._black`. *(Google-Fonts substitutes for now.)*
2. In `Type.kt`, uncomment the `FontFamily(Font(R.font.…))` blocks and point the `R`
   import at your app. Until then `JMFontFamily` falls back to the system font.

## Rules for screens

- **Backgrounds:** default `JMColors.surfacePage` (warm off-white). One saturated
  `JMColors.primary`/`secondary` field per screen, max — heroes/celebratory only.
- **Headlines:** `JMText.displayXl/Lg/…` with `.uppercase()` on the string. Body uses
  `JMText.bodyMd` etc.
- **Buttons:** `JMButton(text, onClick, variant=)` — `Primary` (pink) for the one key
  action, `Ink` for confirms, `Secondary` (cyan) for positive steps, `Outline`/`Ghost`
  otherwise.
- **Cards:** `JMCard(variant=)` — `Plain` everyday, `Hard` poster/sticker look, `Tinted`
  soft feature blocks.
- **Match score:** `JMProgressRing(value = 99f, sublabel = "match")`.
- **Modesty:** `JMAvatar(locked = true)` until a match is mutually accepted; never reveal a
  candidate photo before then. Show a "Wali-supervised" label on post-match chat.
- **Questionnaire:** `JMScaleRating(value, onChange)` — the 1–10 importance control.
- **Counselor voice UI:** build a bar visualizer animating while listening/thinking/speaking,
  plus a Talk/Type toggle (the product supports both voice and text). (Web ref: VoiceBars.)
- **Icons:** export the Solar set as vector drawables; keep weight bold. No emoji. Replace
  the placeholder lock dot in `JMAvatar` with `Icon(painterResource(R.drawable.ic_lock))`.
- **Motion:** `JMMotion.easeOut()` for transitions, `JMMotion.springy()` for press/toggle.

## Minimal example

```kotlin
JustMarriageTheme {
    Column(
        Modifier.fillMaxSize().background(JMColors.surfacePage).padding(JMSpace.gutter),
        verticalArrangement = Arrangement.spacedBy(JMSpace.x5),
    ) {
        Text("BEST MATCH YET", style = JMText.labelSm, color = JMColors.textSecondary)
        JMCard(variant = JMCardVariant.Hard) {
            Row(horizontalArrangement = Arrangement.spacedBy(JMSpace.x4),
                verticalAlignment = Alignment.CenterVertically) {
                JMProgressRing(value = 99f, size = 104.dp, sublabel = "match")
                Column {
                    JMAvatar(locked = true, size = 44.dp)
                    Text("Sister · 27", style = JMText.headingSm)
                }
            }
            Spacer(Modifier.height(JMSpace.x4))
            JMButton("Review match", onClick = {}, variant = JMButtonVariant.Primary, fullWidth = true)
        }
    }
}
```

See `../components.md` for the full cross-platform component contracts and states.

## Full screens (`screens/`)

Complete, faithful recreations of the product — package `com.justmarriage.app` (rename to
your module). Add after the token/component files:

| File | Screen |
|---|---|
| `RootScreen.kt` | `Scaffold` + bottom `NavigationBar` + onboarding gate. **Entry point — call `RootScreen()`.** |
| `Models.kt` | `Prospect`, `AppTab`, `Mock` data. |
| `Services.kt` | Explicit service contracts and preview blockers for production wiring boundaries. |
| `OnboardingScreen.kt` | Intent + brother/sister. |
| `CounselorHomeScreen.kt` | Voice home **with Talk / Type toggle** + text conversation + `JMVoiceBars`. |
| `MatchmakingScreen.kt` | Best 99% match + list; `ModalBottomSheet` detail; shared `SectionHeader`. |
| `ProfileQuestionnaireScreen.kt` | Sections + 1–10 scale. |
| `WaliScreen.kt` | Guardian explainer + verification stepper. |
| `VerifyScreen.kt` | Phone OTP. |
| `ChatScreen.kt` | Wali-supervised post-match chat. |
| `SettingsScreen.kt` | Profile + preference toggles. |

Uses `androidx.compose.material:material-icons-extended` for the icon set (swap for Solar
vector drawables for production). Fonts fall back to the system face until you wire
`res/font/` in `Type.kt`.
