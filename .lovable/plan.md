

# Targeted Fixes: CRITICAL-1 + HIGH-2

## Fix 1: Deduplicate `DEFAULT_PLAYBACK` (CRITICAL-1)

**Create** `src/lib/playbackDefaults.ts` — a small shared constants module containing the single `DEFAULT_PLAYBACK` constant.

**Edit** `src/hooks/useSyncV2.ts` — delete local `DEFAULT_PLAYBACK` (lines 17-28), import from `src/lib/playbackDefaults`.

**Edit** `src/hooks/useRoom.ts` — delete local `DEFAULT_PLAYBACK` (lines 30-41), import from `src/lib/playbackDefaults`.

No circular imports: a plain constants file depends only on `@/types/karaoke` (the `PlaybackState` type). Both hooks import from it — clean dependency direction.

## Fix 2: Remove `hostControlPanelProps` duplication (HIGH-2)

Verified: `showHostControlPanel` and `onCloseHostControlPanel` are consumed ONLY in `DesktopRoomLayout.tsx`. No other component references them.

**Edit** `src/pages/Room.tsx` (lines 606-608) — remove the two redundant props from the JSX. `hostControlPanelProps` already contains `isOpen` and `onClose` with the same values.

**Edit** `src/components/room/DesktopRoomLayout.tsx`:
- Remove `showHostControlPanel` and `onCloseHostControlPanel` from the `DesktopRoomLayoutProps` interface (lines 47-48)
- Remove from destructure (lines 61-62)
- Change `HostControlPanel` render from spread+override to just spread: `<HostControlPanel {...hostControlPanelProps} />` (lines 70-74)

### Contract changes for HIGH-2
- `DesktopRoomLayoutProps` interface loses 2 fields (`showHostControlPanel`, `onCloseHostControlPanel`)
- `HostControlPanel` contract unchanged — it still receives `isOpen`/`onClose` via the spread of `hostControlPanelProps`
- No other file references the removed props (confirmed by search)

### Technical details
- 4 files touched total: 1 new (`src/lib/playbackDefaults.ts`), 3 edited
- No realtime/sync logic modified
- No circular imports introduced

