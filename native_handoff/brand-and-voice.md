# Just Marriage — Brand & Voice (native source of truth)

Read this before writing any UI. It distills the web design system's readme into the
rules that matter for native implementation.

---

## What the product is

A voice-first **halal** matchmaking platform — **not** a dating app. Pitch:
**"No swap. No chat. No date. Just marriage."** An AI Islamic marriage counselor
interviews members (voice or text), scores deep compatibility, surfaces a **99% match**,
and keeps a **wali** (guardian) involved throughout. French-first market, English-capable.

---

## Voice & tone — two registers

**1. Marketing — loud & declarative.**
UPPERCASE headlines, short fragments, bold claims, confident and a little cheeky.
- "No swap. No chat. No date." · "100% garantie mariage." · "Bientôt disponible."
- Numbers as punch: 99%, 100%. Imperatives: "Notify me", "Join waitlist".

**2. In-product — warm, respectful, adab-led.** (The AI counselor's voice.)
- Opens with the Islamic greeting: **"Assalamu alaikum."** Calm, never preachy.
- One clear question at a time; acknowledge the answer, then transition.
- Address the user as **"you."** Sensitive topics (previous marriage, preferences)
  handled with extra care and context.
- **No emoji. No hype.** Plain, kind, unhurried sentences.

**Casing:** marketing headlines UPPERCASE (Anton). Product UI sentence case. Buttons
sentence case ("Find my match"). Eyebrows/labels UPPERCASE with wide tracking.

---

## Color usage

| Role | Token | Hex |
|---|---|---|
| Primary (action) | pink-500 | `#F5269B` |
| Secondary | cyan-bright | `#1FE6D8` |
| Ink (text, bold fills) | ink-900 | `#15161B` |
| Pop accent | yellow-400 | `#FFD23E` |
| Page background | canvas | `#FBFAF8` (warm off-white) |
| Card | white | `#FFFFFF` |

**Rule: loud accents on calm surfaces.** Default screens are white / off-white with ink
text. Pink & cyan appear as buttons, tags, accents, and *occasional* full-bleed hero or
celebratory fields — **never more than one saturated field per screen**. No decorative
gradients; the only allowed gradient is pink→cyan *inside* the match-score ring / progress.

---

## Type

- **Display = Anton** — heavy condensed, **ALL CAPS**, tight leading (~0.92–0.96). Used for
  hero headlines, big numbers (99%, 100%), section dividers, marketing.
- **Body / UI = Public Sans** — weights 400–900. Comfortable leading (1.5–1.55).
- Eyebrows/labels: Public Sans 800, UPPERCASE, letter-spacing ~0.06em.

---

## Visual foundations

- **Corners:** generous & friendly. controls 14pt, cards 20–28pt, chips/CTAs pill,
  avatars/voice-orb circle.
- **Shadows:** two systems — (a) soft elevation for app surfaces; (b) a **hard solid
  offset** shadow (no blur) for the sticker/poster look on feature cards. Plus a colored
  glow on active voice / focus states.
- **Borders:** 1.5pt default, 2.5pt bold (outline buttons, hard cards). Ink borders read
  deliberate, not hairline-faint.
- **Cards:** `plain` (white + subtle border + soft shadow), `hard` (bold ink border +
  offset shadow), `tinted` (soft pink/cyan fill, no border).
- **Motion:** snappy with a hint of bounce. Standard ease-out for most; a spring for
  presses & toggles. Buttons scale to ~0.96 on press; switches/radios pop. ~120/200/360ms.
  Voice bars animate while listening/thinking/speaking. **No infinite decorative loops** on
  content.
- **Hover/press (where relevant):** solid fills darken; ghost/outline get a faint ink wash;
  pressed elements shrink slightly.
- **Imagery:** warm real photography, but **faces hidden until a match is accepted**
  (modesty → locked avatar). Marketing imagery is high-contrast halftone/collage. Never
  fake illustration with primitive shapes — leave a slot for supplied art.

---

## Iconography

- Use the **Solar** icon set (bold/filled variants) to match the web app — on native, use
  an equivalent bundled set (e.g. SF Symbols on iOS where a close match exists, or vector
  drawables exported from Solar on Android). Keep stroke/fill weight consistent (bold).
- Sizes: 16–28pt inline, 40–48pt as feature glyphs. Tone follows context (ink default,
  pink/cyan accents).
- **No emoji. No unicode-as-icon.** The cat mascot & halftone megaphone are brand
  illustrations (supplied separately), not icons.

---

## Product modesty & flow rules (encode these)

- Candidate **photos are locked** (show a lock-keyhole placeholder) until both members
  accept a match.
- Post-match **conversations are wali-supervised** — surface a "Wali-supervised" / "Both
  walis are in this conversation" indicator.
- Women's flow involves a **wali verification stepper** (phone → identity → confirm).
- The profile is a **multi-section questionnaire** built around a **1–10 importance scale**.
- The counselor conversation supports **voice and text** (a Talk/Type toggle).
