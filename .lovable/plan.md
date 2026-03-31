

# Fix: DJ Control State + Ready Check + YouTube Controls

## Root Causes

### 1. DJ Control panel state not updating
The DJ Control (RemoteControl) shows `isPlaying` from the YouTube player hook, which only updates via `onStateChange` events from the YouTube iframe. When the player isn't safe/attached, or during the scheduled delay in SyncV2's `resume()` (1s delay), the UI appears frozen.

**Additionally**: The RemoteControl's progress slider is disabled for non-host (`disabled={!isHost}`), but the `isHost` prop is actually `canControl` (Room.tsx line 583). For the host, seeking goes through `onHostSeek` which maps to `handleSeek` → `syncV2.seek()`. This should work. The issue is more likely that the slider's `onValueCommit` is used instead of `onValueChange` — meaning seeks only fire on pointer-up, but the visual feedback during drag uses local `seekValue` state that resets.

**Volume not working**: `handleVolumeChange` calls `setPlayerVolume` which calls `withSafePlayer(player.setVolume)`. If player isn't safe at that moment, it silently fails. No visual feedback of failure.

**Fix**: 
- Add `isMuted` toggle to `usePlaybackControls` so volume/mute state is managed alongside volume value
- Ensure the play/pause button shows the SyncV2 playback status (not just YouTube player state) for immediate visual feedback
- Pass `playbackState.status` to RemoteControl so it can show the sync-authoritative playing state

### 2. "Waiting for players" showing with 1 user
`showReadyCheck` (Room.tsx line 538) shows whenever `playbackState.status === 'preparing' || 'ready'`. With only 1 user (the host), the ready check is unnecessary — the host should auto-start.

**Fix**: Change `showReadyCheck` to require `users.length > 1`. When only 1 user, auto-force-start after a brief delay (or skip ready check entirely in `prepareSong`).

### 3. YouTube buttons visible
The player already has `controls: 0` in playerVars (line 284), which hides the standard control bar. But YouTube still shows:
- The title/info overlay at top
- The "Watch on YouTube" link at bottom  
- The play button overlay in center

**Fix**: Add CSS to hide all YouTube iframe overlays. Use `pointer-events: none` on the iframe with a transparent overlay div to intercept clicks, plus CSS to hide YouTube's branding elements via the `.ytp-` class selectors (limited by cross-origin, so we use the overlay approach).

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Room.tsx` | Pass sync-authoritative `isPlaying` to RemoteControl; skip ready check for solo user |
| `src/components/room/RoomStage.tsx` | Skip ready check overlay for single user; add YouTube overlay blocker |
| `src/components/RemoteControl.tsx` | Use sync-authoritative playing state for play/pause button visual |
| `src/components/MobileRoomLayout.tsx` | Add YouTube overlay blocker CSS; use actual `isPlaying` for button state |
| `src/hooks/usePlaybackControls.ts` | Add mute state management |
| `src/index.css` | Add global CSS to hide YouTube iframe overlays |

## Detailed Changes

### 1. Skip ready check for solo user
In `Room.tsx`, change:
```ts
const showReadyCheck = playbackState.status === 'preparing' || playbackState.status === 'ready';
```
to:
```ts
const showReadyCheck = (playbackState.status === 'preparing' || playbackState.status === 'ready') && users.length > 1;
```

### 2. Auto-start for solo host in SyncV2
In `useSyncV2.ts`, in `prepareSong`, if only 1 user detected, skip ready check and call `forceStart()` immediately.

### 3. YouTube overlay blocker
In `index.css`, add CSS to suppress YouTube overlays:
```css
#youtube-player iframe {
  pointer-events: none;
}
```
Then wrap `playerHost` in both RoomStage and MobileRoomLayout with a transparent overlay div that captures clicks but prevents interaction with YouTube's built-in UI.

### 4. Fix play/pause visual feedback
The RemoteControl already receives `isPlaying` from the YouTube hook. The issue is the 1-second delay in SyncV2's `resume()`. Add optimistic UI: when user clicks play/pause, immediately toggle the visual state.

### 5. Volume feedback
Add a local `isMuted` state to `usePlaybackControls` and ensure mute/unmute calls go through the hook for consistent state.

## Risk Assessment
- **Low risk**: CSS overlay, solo-user ready check skip, visual state fixes
- **Medium risk**: Modifying SyncV2 auto-start for solo users (but it's a simple conditional)
- No sync protocol changes, no architectural changes

