# AGENTS.md — Just Marriage native build

You are building **Just Marriage**, a voice-first **halal** matchmaking app for iOS and
Android. It is **not a dating app** — the entire premise is *"No swap. No chat. No date.
Just marriage."* An AI Islamic marriage counselor interviews each member (by voice or
text), scores deep compatibility, surfaces a **99% match**, and keeps a **wali**
(guardian) involved at every step. Photos stay private until both members — and their
walis — accept.

This folder is the complete design system as native code. **Read the skill files below
before writing any UI; do not invent colors, type, or components — use the tokens.**

## Read these first, in order

1. **`SKILL.md`** (this folder) — overview, the non-negotiables, and the full file map.
2. **`brand-and-voice.md`** — REQUIRED. Tone & copywriting (two voices), color usage
   ("loud accents on calm surfaces"), type, motion, and the product modesty rules.
3. **`components.md`** — the cross-platform component contracts (props, states) shared by
   iOS, Android, and the original web design system.
4. Your platform's skill:
   - iOS → **`ios/SKILL.md`** (SwiftUI). Entry point `RootView()`.
   - Android → **`android/SKILL.md`** (Jetpack Compose / Material 3). Entry point `RootScreen()`.

`design-tokens.json` is the platform-agnostic token reference (W3C format) if you need to
regenerate or diff values.

## Where things live

```
ios/      JMColor.swift JMTheme.swift JMFont.swift Components.swift  +  screens/ (RootView + 9 screens)
android/  Color.kt Dimens.kt Shape.kt Type.kt Theme.kt Components.kt  +  screens/ (RootScreen + 9 screens)
```

The 9 screens (both platforms): Onboarding · Counselor home (voice **+ Talk/Type** text
conversation) · Matchmaking + match detail · Profile questionnaire (1–10 scale) · Wali
verification stepper · Phone OTP · Wali-supervised chat · Settings.

## Rules — do not violate

- **Use the tokens, never raw values.** Reference `JMColor.primary` / `JMColors.primary`,
  `JMSpace`, `JMRadius`, `JMFont`/`JMText` — hex literals live in exactly one file per
  platform (`JMColor.swift` / `Color.kt`).
- **Compose the provided components** (`JMButton`, `JMCard`, `JMBadge`, `JMProgressRing`,
  `JMScaleRating`, `JMAvatar`, `JMVoiceBars`) — don't re-implement them.
- **Two voices:** marketing = loud, all-caps, declarative; in-product = warm, calm,
  adab-led (the counselor opens with "Assalamu alaikum"). **No emoji.**
- **Loud accents on calm surfaces** — default backgrounds are white / warm off-white; one
  saturated pink/cyan field per screen, max.
- **Modesty model:** candidate photos are **locked** until a match is mutually accepted
  (`JMAvatar(locked: true)`); post-match conversations are **wali-supervised** (show the
  indicator).
- Brand: pink `#F5269B` (primary), cyan `#1FE6D8` (secondary), ink `#15161B`, yellow
  `#FFD23E`. Fonts: **Anton** (display, all-caps headlines) + **Public Sans** (body/UI).

## Two setup TODOs (flagged, not gaps)

1. **Fonts** — bundle Anton + Public Sans (`Info.plist` on iOS, `res/font/` on Android).
   They are Google-Fonts substitutes pending a licensed display face; until bundled, the
   UI falls back to the system font.
2. **Icons** — iOS uses SF Symbols (close Solar matches); Android uses
   `material-icons-extended` plus a placeholder lock dot in the avatar. Swap both for
   exported **Solar** vector drawables for pixel-exact parity.

## Scope note

These screens are faithful recreations of the existing product (web UI kit) — replicate
them, don't redesign. No real auth, voice, or backend is wired; the data is mock.
