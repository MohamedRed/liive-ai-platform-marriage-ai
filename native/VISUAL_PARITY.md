# Just Marriage Native Visual Parity Specification

The user-provided screenshots are the source of truth for the native UI. The iOS SwiftUI and Android Jetpack Compose implementations must be pixel-close to these references; approximate scaffold layouts are not acceptable.

## Global visual language

- Device canvas: tall phone portrait layout with generous safe-area padding and a white/warm off-white app surface except Talk/onboarding dark states.
- Brand: `JUST` wordmark in heavy condensed uppercase, `MARRIAGE` in hot pink inside a cyan rounded tag when shown.
- Typography: large condensed uppercase section titles (`MATCHES`, `PROFILE`, `WALI`, `SETTINGS`, `VERIFICATION`), compact bold labels/badges, readable sans body copy.
- Palette: hot pink primary, bright cyan accent, black/ink primary text, warm cream page background, white cards, soft green success, yellow warning.
- Components use thick rounded rectangles, visible borders, pill badges, circular locked avatars, progress/rating rings, and exact CTA prominence from the screenshots.
- Bottom navigation is white, compact, icon + label, and visibly marks the active tab with pink.

## Screen requirements

### Verification / OTP

- Title: `VERIFICATION`.
- Pink pill: `STEP 1 OF 2 · PHONE`.
- Body title: `Verify your phone`.
- Copy: `Enter the 4-digit code we sent to +44 7•• ••• 204`.
- Four square/rounded OTP boxes centered in a row; active/focused box uses the hot-pink treatment, but no real OTP digit is prefilled or leaked in production code.
- Primary pink pill CTA: `Verify & continue`.
- Resend line: `Resend code in 0:29`.
- Bottom safety card with shield/check icon and copy: `Your number stays private. Matches only see that you are verified.`

### Talk / counselor — active listening

- Dark ink full-screen background.
- Header wordmark at top and notification/bell action at top right.
- Centered Talk/Type segmented pill near top; active segment white, inactive dark translucent.
- Cyan badge: `AI MARRIAGE COUNSELOR`.
- Center voice orb with radial pink/cyan glow and vertical voice bars.
- Main state text exactly: `Listening...` for listening state.
- Secondary quote/counselor prompt shown below when applicable: `“What matters most to you in a spouse?”`.
- End-session action is outlined/ghost, not a filled primary CTA.
- Bottom shortcut cards: `Matches` / `1 new`, `Profile` / `62%`.

### Talk / counselor — idle

- Same dark layout and segmented control.
- Voice orb/bars remain centered but lower intensity.
- Main copy: `Tap to start your session`.
- Pink CTA: `Start talking`.
- Bottom shortcuts remain visible.

### Talk / counselor — Type mode

- Same header and segmented control with `Type` active.
- Chat transcript on dark background.
- Counselor starts with: `Assalamu alaikum. Let's pick up where we left off — what matters most to you in a future spouse?`
- Counselor bubbles are dark translucent/white text with counselor label.
- Composer is a rounded translucent pill with placeholder `Write your answer…`, mic icon, and hot-pink circular send button.

### Matches list

- Warm page background and large `MATCHES` title.
- Pink soft badge at top right: `1 NEW`.
- Best-match card is white with heavy black/ink outline and rounded corners.
- Tilted/black badge: `BEST MATCH YET`.
- Left: 99% progress ring with sublabel `match`.
- Right: locked avatar, `Sister · 27`, location `London, UK`.
- Pink full-width CTA: `Review match`.
- Search label: `SEARCHING FOR A 99% MATCH`.
- List rows show locked avatar, `Sister · 25` / `Manchester`, `Sister · 29` / `Birmingham`, and compact score rings.

### Match detail sheet

- Matches screen remains dimmed/blurred behind a white rounded bottom sheet.
- Sheet has drag handle/close affordance.
- Title: `Best match · 99%`.
- Large 99% `compatibility` progress ring.
- Locked avatar/lock icon.
- Modesty copy: `Photos stay private until you both accept. Your wali reviews this match with you.`
- Bullets: `Both practising, family-oriented`, `Wants children in 1–2 years`, `Open to relocating within UK`.
- Footer actions: outline `Not now`; primary pink `Accept & notify wali`.
- The primary action must not silently dismiss without state/service handling.

### Profile questionnaire

- Large `PROFILE` title.
- Progress card: `62% complete`, `10 of 16 sections`, gradient progress bar.
- Pink-tinted question card with label `ROLES & RESPONSIBILITIES`.
- Question: `How important is it that household responsibilities follow Islamic guidance?`
- 1–10 rating grid. Selected `8` is a dark/ink filled rounded tile; unselected values are light bordered tiles.
- Low/high labels: `Flexible` and `Essential`.
- Black/ink CTA: `Save & continue`.
- Sections list with done, active, and todo states. Active row shows `Now` badge.

### Wali

- Large `WALI` title.
- Cyan explainer panel with shield icon, `Your wali guides the process`, and explanatory copy.
- Three-step horizontal status card: `Phone` done, `Identity` active, `Confirm` todo, connected by status lines.
- Wali row: initials/avatar `YB`, `Yusuf (Father)`, masked number `+44 7•• ••• 204`, yellow `Verifying` badge.
- Pink CTA: `Continue verification`.
- Secondary ghost/outline action: `Invite a different wali`.

### Wali-supervised chat

- White chat surface.
- Header: back arrow, avatar, `Matched · 99%`, green `Wali-supervised`, pink circular video action.
- Center supervision pill: `Both walis are in this conversation`.
- Incoming bubbles are white with subtle border; outgoing bubble is hot pink with white text.
- Visible copy includes:
  - `Assalamu alaikum — our walis have connected us. Looking forward to getting to know your family.`
  - `Wa alaikum assalam. Likewise, alhamdulillah.`
  - `Shall we set a supervised call this weekend?`
- Bottom composer: rounded input `Write a message…` and pink circular send button.

### Settings

- Large `SETTINGS` title.
- Profile header: circular `AB` avatar with pink ring/accent, `Aisha B.`, green `Identity verified` badge.
- Settings card rows: `Match notifications`, `Notify my wali`, `Hide my photo until match`, `Language` / `English ›`.
- Toggle states match screenshot: first two on, photo-hidden off unless product state changes.
- Outline full-width `Sign out` button.
- Bottom nav active state on Settings.

## Implementation rule

Any intentional deviation from these screenshots must be listed in the PR body and approved before merge.
