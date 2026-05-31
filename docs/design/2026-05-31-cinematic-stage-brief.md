# Design Brief — "Cinematic Stage" (KodHard Karaoke)

Locked design direction from a grill session, applying the `.claude/skills/ux-designer` principles. This is the **spec**; the build steps live in [docs/superpowers/plans/2026-05-31-redesign-cinematic-stage.md](../superpowers/plans/2026-05-31-redesign-cinematic-stage.md).

The token values below are the **approved starting point** — they were chosen for the brand and verified for contrast, but tune them by eye in the browser during implementation. Do not invent *new* colors/fonts; refine these.

## Direction

Cinematic stage. A warm near-black "stage" where the video + lyrics are the hero and all chrome recedes into translucent frosted panels. One warm amber accent (a spotlight on the mic). Premium, immersive; the screen is the show. Voice stays on Discord — this is the visual layer only.

## Color tokens (HSL — matches the app's existing `H S% L%` CSS-var convention)

Neutrals — warm near-black stage:
- `--background: 30 16% 5%;`  /* #0E0C0A warm near-black stage */
- `--surface:    30 22% 8%;`  /* lifted panel base (use with opacity + blur for frosted glass) */
- `--card:       30 22% 8%;`
- `--border:     33 12% 16%;` /* subtle warm hairline */
- `--input:      33 12% 16%;`
- `--muted:      30 14% 12%;`
- `--muted-foreground: 36 9% 62%;`
- `--foreground: 36 33% 94%;` /* #F5F1EA warm off-white primary text */

Accent — amber stage-light:
- `--primary:            40 100% 56%;` /* #FFB020 */
- `--primary-foreground: 30 20% 7%;`   /* near-black text ON amber fills */
- `--primary-hover:      40 92% 50%;`  /* darken ~10% on hover */
- `--ring:               40 100% 56%;` /* focus ring = amber */

Status (used sparingly, never as the only signal):
- `--destructive: 0 72% 58%;`  `--destructive-foreground: 36 33% 96%;`
- `--success: 150 55% 48%;`     /* connection dot, "loaded" */
- `--warning: 40 100% 56%;`     /* reuse amber */

Ambient (per-song atmosphere):
- `--ambient: <set at runtime>;` — ThemeContext samples the current album art and writes an HSL triple here. Used ONLY in a low-opacity radial-gradient layer behind the stage (see Motion). The UI accent never changes — only this background glow does.

Contrast notes (WCAG AA): amber `#FFB020` vs near-black text ≈ 9:1 (pass). Off-white `#F5F1EA` on stage `#0E0C0A` ≈ 17:1 (pass). Amber text on stage ≈ 8:1 (pass for large/UI). `--muted-foreground` on stage ≈ 5:1 (pass for body).

## Typography

Three faces (load Space Grotesk via Google Fonts in `index.html`; the others are already loaded):
- **Display** — `Space Grotesk` (500, 700): hero text, screen titles, room name, big numerals moments.
- **UI + Lyrics** — `IBM Plex Sans Thai` (300/400/500/600/700): all body, labels, controls, AND the lyric lines (covers Thai; CJK falls back gracefully). Lyrics render in this face at large weight, NOT in the Latin display face.
- **Mono** — `Space Mono` (400/700): room code, timers, tabular numerals.

Tailwind `fontFamily`: `display: ['"Space Grotesk"', 'system-ui', 'sans-serif']`, `sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif']`, `mono: ['"Space Mono"', 'ui-monospace', 'monospace']`.

Scale: 1.25× (major third), base 16px. Hero/marquee on Landing: `clamp(2.5rem, 7vw, 5rem)` Space Grotesk 700, tracking −0.03em. Lyric active line: `clamp(1.5rem, 3.5vw, 2.75rem)` Plex Sans Thai 600. Body 16px, line-height 1.5. Large text tighter tracking, small text looser.

## Spacing, radius, elevation

- Base unit 4px; scale 8/12/16/24/32/48/64. Prefer `gap` on flex/grid wrappers over child margins.
- Radius: `--radius: 0.875rem` for panels/cards; pills (`rounded-full`) for the primary transport (play) and small toggles; `rounded-xl` for inputs.
- **No drop shadows for affordance.** Hierarchy + clickability come from amber color, border, background lift, and hover state. Real z-axis (blur/translucency) is reserved for functional layering: drawers and modals over the stage.

## Frosted-panel pattern (the core surface)

Side panels, drawers, and the top bar are frosted glass that recede:
```
bg-[hsl(var(--surface)/0.6)] backdrop-blur-xl border border-[hsl(var(--border)/0.6)]
```
The top bar is more transparent (`/0.4`); drawers more opaque (`/0.75`, `backdrop-blur-2xl`).

## Motion (subtle & elegant)

- **Ambient background:** a radial gradient using `--ambient` at ~15–22% opacity behind the stage, drifting/breathing on a slow 12–16s ease-in-out loop. Crossfades when the song (album art) changes (~600ms).
- **Drawers:** slide + fade, 300ms ease-out in / ease-in out.
- **Micro-interactions** (buttons, toggles, hover): 150–200ms ease-out, `transform`/`opacity` only.
- **Song change:** glow crossfade + a gentle lyric fade.
- Always gate decorative motion behind `@media (prefers-reduced-motion: reduce)` (disable the ambient drift; keep instant state changes).

## Layout blueprint

### Room — Display / Player roles (big screens): stage-first
- **Stage** fills the viewport: the YouTube video large and centered (preserve the `#youtube-player` div id and all player/sync logic). Active lyric line(s) overlay the lower third on a subtle bottom-up scrim, large and centered (reuse the existing fullscreen-lyric treatment as the *default*, not just in fullscreen).
- **Top bar** (floating, frosted, auto-hide on ~3s inactivity, reappears on pointer move): room code (mono), online avatars, connection dot, role toggle, settings, leave.
- **Queue + Search drawer**: slides from the left, triggered by an edge button/icon; frosted, scrollable; shows lyric-status per song.
- **Now-Playing + Transport + Reactions**: a floating bottom control bar (frosted, auto-hide with the top bar) holding the scrubber, transport, volume, captions toggle, lyric-offset, reactions. Now-playing title/artist sits here too.
- Countdown overlay (last 5s) and floating reactions keep their behavior, restyled.

### Room — Remote role (phone): control-first, no stage
- No video player (remote mounts none). Stacked, scrollable, thumb-reachable:
  1. Now-playing card (title, artist, scrubber driven by `effectiveTime`, the "audio plays on the screen" note).
  2. Big transport row (prev / play-pause / next), 44px+ targets.
  3. Reactions bar.
  4. Search + Queue list (add/remove/reorder, lyric status).
  5. Header essentials (room code, leave, role toggle).
- This is the primary remote UX — make it feel like a polished remote, not a shrunken desktop.

### Landing
- Same dark cinematic language. Centered marquee: large Space Grotesk title (replace the 🎤 emoji with a designed typographic wordmark / a minimal amber mic-glyph mark — no raw emoji as the brand). Subtle ambient amber glow drifting behind.
- Create / Join cards as frosted panels; primary actions amber. Keep (restyle) the mocked "Sign in with Discord" button — keep Discord brand blurple for that one button only, as a recognized third-party mark.
- Join: room-code input in mono, large, tracked.

### NotFound
- Trivial: same tokens, a centered Space Grotesk "404 / not found", amber link back home.

## Keep (restyle, do not remove)
Role toggle, fullscreen button, reactions + floating reactions, captions toggle, lyric offset control, the 5s countdown, song search, queue add/remove/reorder/select, connection indicator, online avatars.

## Anti-generic filter
Before declaring a screen done, ask "does this look AI-generated?" The warm near-black + single amber + frosted glass + album-art ambient glow + Space Grotesk/Plex pairing is the differentiator — avoid sliding back into evenly-tiled card grids, default blue, or glow-on-everything (the old neon look we're replacing).
