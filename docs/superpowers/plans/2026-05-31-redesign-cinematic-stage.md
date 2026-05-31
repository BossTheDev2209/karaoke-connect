# Redesign Plan — "Cinematic Stage" (KodHard Karaoke)

> **For agentic workers:** Implement task-by-task in order. This is a **visual redesign**, so verification is build + browser review, not unit tests. **Hard rule: stop at every `🛑 CHECKPOINT` and wait for the human to review in a browser before continuing.** Steps use `- [ ]` checkboxes.

**Goal:** Replace the old neon look with the "Cinematic Stage" design language across Landing + Room, per the locked brief.

**Design source of truth:** [docs/design/2026-05-31-cinematic-stage-brief.md](../../design/2026-05-31-cinematic-stage-brief.md). All colors, fonts, spacing, motion, and layout blueprints are defined there. Do **not** invent new colors/fonts — use the brief's tokens and tune by eye. Also read `.claude/skills/ux-designer/SKILL.md` + its `references/` for the design principles behind these choices.

**Tech Stack:** Vite + React 18 + TS, Tailwind + shadcn/ui, framer-motion/`motion` (already a dep), YouTube IFrame API. Bun.

**Critical constraint:** `Room.tsx` contains freshly-built realtime sync (role detection, clock election, drift correction). The `#youtube-player` div id and all the existing hooks/handlers/effects (`useRoom`, `useYouTubePlayer`, `effectiveTime`, the clock/drift `useEffect`s, `handlePlayPause`/`handleSeek`/etc.) **must be preserved**. This redesign restructures *markup and styling around* that logic — it does not change the sync behavior. After the Room task, re-run the Phase 1 manual sync checks.

---

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `index.html` | Load Space Grotesk font | Modify |
| `src/index.css` | CSS-var tokens (`:root`), legacy utility classes, keyframes, reduced-motion | Modify |
| `tailwind.config.ts` | `fontFamily`, ensure token colors map | Modify |
| `src/contexts/ThemeContext.tsx` | Strip 9 presets; keep album-art extraction → write `--ambient` | Modify |
| `src/components/RoomThemePicker.tsx` | Preset picker — remove or repurpose | Modify/Delete |
| `src/components/ui/button.tsx` | Amber primary variant, focus ring | Modify |
| `src/pages/Index.tsx` | Landing redesign | Modify |
| `src/pages/Room.tsx` | Stage-first re-architecture (preserve sync) | Modify |
| `src/components/StageBackground.tsx` | Ambient album-art glow layer | Create |
| `src/components/PlayerControls.tsx`, `SongQueue.tsx`, `SongSearch.tsx`, `LyricsDisplay.tsx`, `RoomSettings.tsx` | Restyle to new tokens | Modify |
| `src/pages/NotFound.tsx` | Token restyle | Modify |

---

## Task 1: Design tokens + fonts (foundation)

**Files:** `index.html`, `src/index.css`, `tailwind.config.ts`

- [ ] **Step 1: Load Space Grotesk.** In `index.html`, add Space Grotesk to the existing Google Fonts `<link>` (keep IBM Plex Sans Thai + Space Mono). Add weights 500;700.

- [ ] **Step 2: Rewrite the color tokens.** In `src/index.css`, replace the `:root` (and any `.dark`) color custom properties with the brief's token set (Color tokens section). The app is dark-only now — set the stage tokens as the default `:root`. Keep the shadcn variable *names* the app already uses (`--background`, `--foreground`, `--card`, `--border`, `--input`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--ring`, `--destructive`) so existing components inherit the new look. Add `--surface`, `--primary-hover`, `--success`, and `--ambient` (default `--ambient: 40 100% 56%;`).

- [ ] **Step 3: Map fonts in Tailwind.** In `tailwind.config.ts`, set `theme.extend.fontFamily` to the three families from the brief (`display`, `sans`, `mono`). Confirm the color tokens reference the CSS vars (`hsl(var(--…))`).

- [ ] **Step 4: Redefine the legacy utility classes** so existing markup picks up the new language without touching every component yet. In `src/index.css`, redefine `.btn-neon` (amber fill, near-black text, 150ms hover to `--primary-hover`, amber focus ring — no glow), `.card-karaoke` (frosted panel: `hsl(var(--surface)/0.6)` + `backdrop-blur-xl` + 1px `hsl(var(--border)/0.6)`, radius `--radius`), `.text-gradient` (drop the rainbow gradient → solid `--foreground` or a subtle amber-tinted treatment), `.neon-border` (1px amber/border, no glow), and recolor `.bg-neon-green` usages → `--success`.

- [ ] **Step 5: Add ambient keyframes + reduced-motion.** Add a slow (12–16s) ease-in-out `ambient-drift` keyframe (opacity/transform only) and the `@media (prefers-reduced-motion: reduce)` block from `references/motion.md` that neutralizes decorative animation.

- [ ] **Step 6: Verify.** Run `bun run build` (expect ✓). Run `bun run dev`, open `http://localhost:8080` — confirm the app now reads dark + warm + amber, fonts loaded, nothing unstyled/broken.

🛑 **CHECKPOINT 1 — human reviews tokens in browser before continuing.**

---

## Task 2: ThemeContext — drop presets, keep ambient extraction

**Files:** `src/contexts/ThemeContext.tsx`, `src/components/RoomThemePicker.tsx`, `src/components/RoomSettings.tsx`

- [ ] **Step 1:** In `ThemeContext.tsx`, remove the 9 `PRESET_COLORS` and the `preset`/`setPreset` API. Keep the album-art color extraction (`extractColorsFromThumbnail` / `setVideoId`), but write its result to a single `--ambient` CSS var (HSL triple) instead of `--primary`/`--secondary`/`--accent`. The UI accent (`--primary`) stays fixed amber.
- [ ] **Step 2:** Keep `karaokeFilterEnabled` if still used by search. Remove preset-related context members and fix consumers.
- [ ] **Step 3:** Remove the preset picker UI (`RoomThemePicker`) from `RoomSettings` (delete the component if unused elsewhere). Leave a Settings panel that still exposes any remaining real toggles.
- [ ] **Step 4:** Verify `bun run build` ✓ and the app still loads; changing songs should shift the background `--ambient` (verified visually in Task 5, fine to defer).

---

## Task 3: Core primitives (button + frosted panel + stage background)

**Files:** `src/components/ui/button.tsx`, `src/components/StageBackground.tsx` (new)

- [ ] **Step 1:** In `button.tsx`, make the `default` variant amber (`bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]`), `outline`/`secondary` = transparent + `--border` hairline + `--foreground`, `ghost` = `text-foreground/70 hover:text-foreground hover:bg-[hsl(var(--surface)/0.6)]`. Ensure a visible amber focus ring (`focus-visible:ring-2 ring-[hsl(var(--ring))]`) and ≥44px touch targets for the `icon` size on coarse pointers. Transitions 150ms ease-out, `transition-colors`/`transform` only.
- [ ] **Step 2:** Create `StageBackground.tsx`: a fixed, `pointer-events-none`, `-z-10` layer rendering a radial gradient from `hsl(var(--ambient)/0.18)` to transparent, with the `ambient-drift` animation (disabled under reduced-motion). This is the per-song atmosphere.
- [ ] **Step 3:** Verify `bun run build` ✓.

---

## Task 4: Landing redesign

**Files:** `src/pages/Index.tsx`

- [ ] **Step 1:** Rebuild per the brief's Landing blueprint: dark stage + `StageBackground`, centered marquee using `font-display` at `clamp(2.5rem, 7vw, 5rem)`, **replace the 🎤 emoji** with a designed wordmark or a minimal amber mic-glyph (SVG/lucide `Mic`), Create/Join as frosted panels, amber primary actions, mono room-code input (large, tracked). Keep the mocked Discord button but as the only blurple element (recognized third-party mark).
- [ ] **Step 2:** Subtle entrance motion (fade/translate 200–300ms ease-out), reduced-motion safe. Keep all existing handlers (`handleCreate`, `handleJoin`, validation, toasts) intact.
- [ ] **Step 3:** Verify `bun run build` ✓, then `bun run dev` and review Landing at desktop + mobile widths.

🛑 **CHECKPOINT 2 — human reviews Landing in browser before continuing.**

---

## Task 5: Room — stage-first re-architecture

**Files:** `src/pages/Room.tsx` (+ restyle `PlayerControls`, `SongQueue`, `SongSearch`, `LyricsDisplay`, `RoomSettings`)

> Preserve ALL sync logic and the `#youtube-player` div id. Only restructure markup/layout and styling.

- [ ] **Step 1:** Implement the Display/Player stage-first layout from the brief: full-viewport stage with the video large and centered; the active lyric line(s) overlaid on the lower third over a bottom-up scrim (promote the existing `fullscreenLyric` treatment to the default view, large `font-sans` 600). Mount `StageBackground`.
- [ ] **Step 2:** Convert the **queue + search** into a left slide-in drawer (use the existing shadcn `sheet.tsx`/`drawer.tsx`) triggered by an edge icon button. Convert **now-playing + transport + reactions** into a frosted bottom control bar. Top bar = floating frosted (room code mono, avatars, connection dot, role toggle, settings, leave). Auto-hide top bar + control bar after ~3s pointer inactivity; reveal on pointer move (reduced-motion: keep them always visible).
- [ ] **Step 3:** Restyle `PlayerControls`, `SongQueue`, `SongSearch`, `LyricsDisplay`, `RoomSettings` to the new tokens (frosted surfaces, amber accents, mono numerals, 16px inputs). Keep their props/handlers unchanged.
- [ ] **Step 4:** Verify `bun run build` ✓ and `bun run lint` shows **no new** errors in touched files.

🛑 **CHECKPOINT 3 — human reviews Room (Display/Player) in browser, AND re-runs the Phase 1 manual sync checks (two windows: play/seek sync, drift snap-back, clock migration) to confirm the relayout didn't break sync.**

---

## Task 6: Room — Remote (phone) control-first layout

**Files:** `src/pages/Room.tsx` (responsive branch for `role === 'remote'`)

- [ ] **Step 1:** When `role === 'remote'` (or at mobile widths), render the control-first stacked layout from the brief instead of the stage: now-playing card (scrubber on `effectiveTime`), big transport row (44px+), reactions, search + queue, header essentials. No video stage. Keep the existing "audio plays on the room's screen" note.
- [ ] **Step 2:** Verify on a mobile-emulated width: thumb-reachable, no horizontal scroll, controls drive the room.

🛑 **CHECKPOINT 4 — human reviews the phone remote layout (device emulation or real phone).**

---

## Task 7: Accessibility + motion + final polish

**Files:** as needed

- [ ] **Step 1:** Verify WCAG AA contrast for all text/controls (brief lists the key ratios). Fix any combo under 4.5:1 (3:1 large).
- [ ] **Step 2:** Confirm visible amber focus rings on every interactive element, full keyboard navigation (drawers openable/closable, transport reachable), and that nothing signals by color alone (icons/labels present).
- [ ] **Step 3:** Confirm `prefers-reduced-motion` disables the ambient drift, auto-hide, and decorative transitions while keeping the app fully usable.
- [ ] **Step 4:** Run the anti-generic filter from the brief on each screen. Final `bun run build` ✓ + `bun run lint` (no new errors). Commit.

🛑 **CHECKPOINT 5 — final human review across Landing, Room (desktop + mobile remote), reduced-motion.**

---

## Self-Review (vs the brief)

- Tokens (color/type/spacing/radius/motion) → Task 1–3. ✓
- Theming hybrid (fixed amber + album-art ambient, presets dropped) → Task 2. ✓
- Landing overhaul, emoji replaced, Discord button kept → Task 4. ✓
- Room stage-first with drawers, sync preserved → Task 5. ✓
- Mobile remote control-first → Task 6. ✓
- A11y + reduced-motion → Task 7. ✓
- Keep-all-features: role toggle, fullscreen, reactions, captions, lyric offset, countdown, search, queue ops — restyled across Tasks 5–6, none removed. ✓
