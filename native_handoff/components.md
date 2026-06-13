# Component contracts — cross-platform

Each component exists in three places with the **same props/states**: the web design
system (`window.JustMarriageDesignSystem_*`), iOS (`Components.swift`), and Android
(`Components.kt`). Keep behavior identical across platforms.

---

## Button — `JMButton`

| Prop | Values | Notes |
|---|---|---|
| variant | primary, secondary, ink, outline, ghost | primary = pink (the one key action), ink = high-contrast confirm, secondary = cyan, outline/ghost = secondary choices |
| size | sm (36), md (46), lg (56) | heights in pt/dp |
| shape | rounded (radius md), pill | |
| fullWidth | bool | |
| icon | leading/trailing | bold Solar / SF Symbol; no emoji |
| states | default, pressed (scale ~0.96, spring), disabled (opacity 0.45) | solid fills darken on press |

## IconButton (web) / icon-only button

Circular, sizes 32/40/48. variants solid|soft|outline|ghost, tones ink|pink|cyan. Always
provide an accessibility label. (Build with the platform's icon button + a CircleShape.)

## Badge — `JMBadge`

Loud label chip + the signature tilted "100%" sticker tag.
- tone: ink, pink, cyan, yellow, success, warning, error
- variant: solid | soft
- `tilt` (−4°), `uppercase`
- Not interactive. Font: Public Sans ExtraBold 13, radius xs (6).

## Tag (web) — interactive chip

Pill chip for preferences/filters. `selected` → filled ink. Optional leading dot,
removable "×". On native build with a `FilterChip`/custom pill toggling ink background.

## Avatar — `JMAvatar`

Round. Falls back to initials. **`locked` = true** shows a lock placeholder — use it for
candidate photos **until a match is mutually accepted** (modesty model). Optional status
dot (online/away/offline), `ring`.

## Input / Select / Checkbox / Radio / Switch (web)

Form primitives. Pink focus ring on inputs; pink check/track on checkbox/switch; spring
pop on radio/switch. On native, style the platform `TextField`/`Checkbox`/`Switch` with
`JMColors.primary` as the accent and the radii from `JMRadius`.

## ScaleRating — `JMScaleRating`

The **1–10 importance scale** used throughout the marriage questionnaire. Row of number
chips; selected = ink fill, lifts ~2pt. Optional low/high anchor labels. `value` + `onChange`.

## Card — `JMCard`

- variant: **plain** (white + subtle border + soft shadow) · **hard** (bold ink border +
  solid offset shadow, the poster/sticker look) · **tinted** (soft pink/cyan fill, no border)
- radius lg (20), optional header/footer (web).

## ProgressRing — `JMProgressRing`

Match-score / compatibility dial. `value` 0–100, pink→cyan gradient stroke, big Anton
"NN%" centre + optional uppercase sublabel. Animate the sweep with ease-out.

## VoiceBars — `JMVoiceBars` (iOS) / build on Android

Counselor voice visualizer. Row of capsules animating while
`state ∈ {listening, thinking, speaking}`; near-flat when idle/disconnected. tones
pink|cyan|ink. Pair with a **Talk / Type toggle** — the conversation works by voice *or*
by writing.

## Sheet (web) / bottom sheet

Primary modal pattern. Bottom sheet on mobile (drag handle, radius 2xl top corners),
center dialog on large screens. Backdrop ink @ 45% + slight blur. On native use
`ModalBottomSheet` (Compose) / `.sheet`/`.presentationDetents` (SwiftUI).

## Toast (web) / snackbar

Confirmations & alerts. tones ink|success|warning|error, optional title + message + icon.
On native use the platform snackbar styled with these tones.

---

### Screens to assemble (from the web UI kit, `ui_kits/app/`)

Voice/Text counselor home · Matchmaking (best 99% match + search list, locked avatars) ·
Profile questionnaire (sections + 1–10 scale) · Wali management (verification stepper) ·
Phone/identity verification (OTP) · Post-match chat (wali-supervised) · Onboarding
(intent + brother/sister). Reproduce these layouts; they are the canonical product views.
