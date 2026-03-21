

# Bug Audit + Minimal UI Polish Plan

## PART A — Bug Audit Findings

### 1) Join during ready-check / countdown — REAL BUG
**File**: `src/hooks/useSyncV2.ts` lines 469-497
`applyFullSyncPlayback` only handles `status === 'playing'` or `startAtRoomTime` truthy. If room is in `preparing` or `ready` phase, the incoming state has `status: 'preparing'`, `startAtRoomTime: null`, and `isPlaying: false` — all conditions fail, so the joiner gets NO playback hydration. They see an idle player instead of the ready-check overlay.

**Fix**: Add handling for `preparing`/`ready` status in `applyFullSyncPlayback`.

### 2) Empty queue + proactive sync edge — LOW RISK, PARTIALLY REAL
**File**: `src/hooks/useRoom.ts` line 294
Gate: `!hasSyncedRef.current || queueRef.current.length === 0`. The `queueRef.current.length === 0` part means a proactive push is always accepted if queue is empty, even after a successful sync. This is benign (empty queue re-apply is idempotent) but semantically imprecise.

**Fix**: Not blocking. Defer.

### 3) Retry timer cleanup race — NOT PRESENT
**File**: `src/hooks/useRoom.ts` lines 406-418, 427-429
Timer is stored on channel object, cleared on unmount and on fulfillment (implicitly via `hasSyncedRef.current` check). However, **it is NOT cleared when sync is fulfilled** — the timer can still fire after successful sync. The `hasSyncedRef.current` guard inside the timeout prevents a re-send, so no functional bug, but the timer leaks until it fires.

**Fix**: Clear timer in the acceptance path (line 300). Tiny, safe.

### 4) Manual resync stale lifecycle — LOW RISK
`requestSync()` (line ~640 in useRoom) does not reset `syncFulfilledIdRef` or `pendingSyncRequestIdRef`. If called after initial sync, it would send a new request but the response might be rejected because `hasSyncedRef.current` is already true and queue is non-empty (line 294 gate). This is actually a safe behavior — prevents unwanted overwrite. Not a bug.

### 5) Host re-election authority gap — REAL GAP
**File**: `src/hooks/useRoom.ts` lines 126-136
When host leaves, `isHostRef.current` is updated on the next presence sync for the new host. But the new host does NOT emit an authoritative state push. If the old host left mid-song, the new host's `getPlaybackState()` returns correct state, but nobody requests it. Joiners after host change work fine (they trigger `sync_request`), but existing peers don't re-sync.

**Fix**: Defer — complex, and existing peers already have state. Note as known limitation.

### 6) Playback feedback loops — MITIGATED
**File**: `src/pages/Room.tsx` lines 154-164
`applyingRemoteRef` with 300ms cooldown prevents local player events from re-triggering sync broadcasts. `handleStateChange` is a no-op. Adequate.

### 7) Timebase drift — NOT PRESENT
`useSyncV2` uses `useServerTime()` (NTP-style calibration) + web worker for drift correction. Countdown uses `getRoomTime()`. Solid.

### 8) Double-add song UX race — REAL BUG
**File**: `src/components/SongSearch.tsx` line 102-114
`handleAddSong` creates a new `Song` with `crypto.randomUUID()` each call and immediately calls `onAddSong`. No debounce, no disable, no optimistic lock. Rapid taps add duplicates (different IDs but same videoId).

**Fix**: Add brief disable state after adding. Small, safe.

### 9) Mobile keyboard / viewport — PARTIAL RISK
**File**: `src/components/MobileRoomLayout.tsx` line 93
Uses `h-screen` (equivalent to `100vh`), not `100dvh`. On iOS with keyboard open, content can be pushed behind keyboard. The search input is inside a tab content area, not sticky.

**Fix**: Change to `h-dvh` with fallback.

### 10) Error states not actionable — PARTIAL
Sync failures log to console but show nothing to user. Player errors have a good overlay (RoomStage). No-host timeout has no user feedback.

**Fix**: Add a small toast on sync retry timeout.

---

## PART B — Fixes to Implement (highest-value only)

### Fix 1: Ready-check hydration in `applyFullSyncPlayback` (Bug #1)
**File**: `src/hooks/useSyncV2.ts`
In `applyFullSyncPlayback`, add a branch for `preparing`/`ready` status:
- Set playback state with the incoming status, videoId, currentSongIndex
- Call `onCueVideo(videoId)` so the player loads the video
- Do NOT call play/seek — the room is waiting for ready check

### Fix 2: Double-add prevention (Bug #8)
**File**: `src/components/SongSearch.tsx`
- Add `recentlyAdded` state (`Set<string>`) tracking videoIds added in last 2 seconds
- After adding, insert videoId into set, remove after 2s timeout
- Show "Added ✓" text briefly on the button, disable re-add of same videoId

### Fix 3: Clear retry timer on sync fulfillment (Bug #3)
**File**: `src/hooks/useRoom.ts`
After line 301 (`syncFulfilledIdRef.current = incomingRequestId`), add:
```
if ((channel as any).__syncRetryTimer) {
  clearTimeout((channel as any).__syncRetryTimer);
  (channel as any).__syncRetryTimer = null;
}
```

### Fix 4: Sync retry toast (Bug #10)
**File**: `src/hooks/useRoom.ts`
In the retry timeout callback (line 407), after logging, add:
```
import { toast } from 'sonner';
toast.info('Syncing with room host...', { duration: 3000 });
```

### Fix 5: Mobile viewport fix (Bug #9)
**File**: `src/components/MobileRoomLayout.tsx`
Change `h-screen` to `h-[100dvh]` with CSS fallback.

---

## PART C — Minimal UI Polish

### Polish 1: Phase badge on RoomStage
**File**: `src/components/room/RoomStage.tsx`
Add a small floating badge in the top-left of the video area showing current phase:
- "Playing" (green), "Paused" (yellow), "Ready Check" (blue pulse), "Countdown" (orange), "Idle" (gray)
Derived from existing `showCountdown`, `showReadyCheck`, `showNoSong` + playback status.

### Polish 2: Current song highlight in queue
**File**: `src/components/SongQueue.tsx`
The current song already has `bg-primary/20 neon-border`. Add a small "Now Playing" label and a subtle "Up Next" label on `currentIndex + 1`. Minimal change.

### Polish 3: Add song feedback
Part of Fix 2 — show "Added ✓" inline on the search result after tapping add.

### Polish 4: No desktop layout change
Current layout is already a clean 3-column grid (queue | stage | controls). No change needed.

---

## Summary of Changes

| File | Change | Type |
|------|--------|------|
| `src/hooks/useSyncV2.ts` | Handle `preparing`/`ready` in `applyFullSyncPlayback` | Bug fix |
| `src/components/SongSearch.tsx` | Debounce double-add, show "Added ✓" feedback | Bug fix + UX |
| `src/hooks/useRoom.ts` | Clear retry timer on sync accept, add toast on retry | Bug fix + UX |
| `src/components/MobileRoomLayout.tsx` | `h-[100dvh]` viewport fix | Bug fix |
| `src/components/room/RoomStage.tsx` | Playback phase badge | UI polish |
| `src/components/SongQueue.tsx` | "Now Playing" / "Up Next" labels | UI polish |

All changes are localized, no architectural impact, no sync protocol changes.

