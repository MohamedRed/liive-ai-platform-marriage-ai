---
name: just-marriage-native
description: Build native iOS (SwiftUI) and Android (Jetpack Compose) apps for Just Marriage — a voice-first halal matchmaking platform ("No swap. No chat. No date."). This skill contains the complete design system as native code: design tokens, brand & voice rules, and component recipes for both platforms. Use it whenever implementing any Just Marriage native screen, component, or flow.
user-invocable: true
---

# Just Marriage — Native design system

You are implementing **Just Marriage**, a voice-first **halal** matchmaking app (iOS +
Android). It is **not a dating app**. An AI Islamic marriage counselor interviews each
member by conversation (voice, or text), builds a deep compatibility profile, finds a
**99% match**, and keeps a **wali** (guardian) involved at every step. Photos stay
private until both members — and their walis — accept.

## How to use this skill

1. **Always read `brand-and-voice.md` first.** It is the source of truth for tone,
   copywriting, color usage and the visual rules. Get this right before writing UI.
2. **Pick your platform folder and follow its `SKILL.md`:**
   - `ios/SKILL.md` — SwiftUI. Drop-in files: `JMColor.swift`, `JMTheme.swift`,
     `JMFont.swift`, `Components.swift`, `Services.swift`.
   - `android/SKILL.md` — Jetpack Compose / Material 3. Drop-in files: `Color.kt`,
     `Theme.kt`, `Type.kt`, `Dimens.kt`, `Shape.kt`, `Components.kt`, `Services.kt`.
3. **Use the tokens, never raw values.** Reference `JMColor.primary` / `JMTheme.colors.primary`,
   not `#F5269B`. The hex literals live in exactly one file per platform.
4. **Match the component contracts** in `components.md` — the same props/states exist on
   both platforms and in the original web design system, so behavior stays consistent.
5. `design-tokens.json` is the platform-agnostic token reference (W3C-style) if you need
   to regenerate or diff tokens.

## The non-negotiables

- **Two voices.** Marketing = loud, all-caps, declarative. In-product = warm, calm,
  adab-led (Islamic etiquette). The AI counselor opens with "Assalamu alaikum." **No emoji.**
- **Loud accents on calm surfaces.** Default backgrounds are white / warm off-white.
  Saturated pink & cyan are reserved for hero / celebratory / marketing moments — never
  more than one loud field per screen.
- **Modesty model.** Candidate photos are hidden (locked avatar) until a match is
  mutually accepted. Conversations are wali-supervised.
- **Brand colors:** pink `#F5269B` (primary), cyan `#1FE6D8` (secondary), ink `#15161B`,
  yellow `#FFD23E` (pop). **Fonts:** Anton (display, all-caps headlines) + Public Sans
  (body/UI). Both bundled with the app — see each platform's font note.

## Files

```
native_handoff/
├── SKILL.md              ← you are here
├── brand-and-voice.md    ← READ FIRST: tone, copy, color usage, visual rules
├── components.md         ← cross-platform component contracts & states
├── design-tokens.json    ← platform-agnostic token reference (W3C format)
├── ios/                  ← SwiftUI implementation
│   ├── SKILL.md
│   ├── JMColor.swift  JMTheme.swift  JMFont.swift  Components.swift  Services.swift
│   └── screens/         ← all 9 product screens + RootView (entry)
└── android/             ← Jetpack Compose implementation
    ├── SKILL.md
    ├── Color.kt  Theme.kt  Type.kt  Dimens.kt  Shape.kt  Components.kt
    └── screens/         ← service contracts + all 9 product screens + RootScreen (entry)
```

> Fonts are currently the Google-Fonts substitutes **Anton** (display) and **Public Sans**
> (body). If a licensed display face arrives, swap the bundled `.ttf` and update the font
> file in each platform — names are centralized.
