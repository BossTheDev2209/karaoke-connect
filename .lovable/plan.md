
Goal: fix the room so the DJ panel becomes authoritative again, lyrics stay aligned, queue advancement works, and no recommendations leak through the player end-state — without changing the karaoke-room concept or layout architecture.

What I confirmed from the code + logs

1. Real bug: duplicated SyncV2 broadcast handlers
- File: `src/hooks/useSyncV2.ts`
- Cause: the `room_event` listener is added inside an effect, but cleanup only flips `__syncV2Registered = false`; it does not actually remove the old handler.
- Result: every re-run stacks another listener, which matches the console evidence showing many repeated `prepare_song` and `start_song` events for one action.

2. Real bug: host controls depend too much on self-broadcast
- File: `src/hooks/useSyncV2.ts`
- Cause: `prepareSong()` updates state and broadcasts, but does not locally `onCueVideo()` for the host; `pause()` broadcasts but does not locally `onPauseRequired()`.
- Result: host/DJ actions can look “dead” or lag badly if the self-broadcast path is delayed or duplicated. This directly explains “can’t stop video”, “can’t skip”, and inconsistent timeline behavior.

3. Real bug: UI time sources are split
- Files: `src/pages/Room.tsx`, `src/components/RemoteControl.tsx`, `src/components/MobileRoomLayout.tsx`
- Cause: the room uses sync-authoritative playback state for some UI, but still passes raw player `currentTime` into controls/layout. Lyrics highlight uses sync time, while parts of the panel and stage still depend on player time.
- Result: the slider, visible playback state, and lyrics can drift apart when sync state and actual player state temporarily diverge.

4. Real bug: recommendations are shown too eagerly
- Files: `src/pages/Room.tsx`, `src/hooks/useRecommendations.ts`, `src/components/room/RoomStage.tsx`
- Cause: the overlay condition is basically “not playing + last song + recommendations exist”, which can trigger after pauses/end transitions. Recommendation fetching is also not tightly tied to a true “queue exhausted and settled” state.
- Result: recommendation UI can appear at the wrong time and compete with the karaoke stage.

5. Real bug: YouTube end-screen is still reachable
- Files: `src/hooks/useYouTubePlayer.ts`, `src/pages/Room.tsx`
- Cause: hiding controls and blocking pointer events does not suppress YouTube’s visual end-screen. If the video reaches true `ENDED` without immediately transitioning to the next controlled state, the iframe can still render native recommendations.
- Result: users still see recommendations after the song ends.

What is likely not the main issue
- The persistent single player host pattern is present; this does not look like a “multiple players” regression.
- Lyrics fetching itself is not broken; network logs show `fetch-lyrics` succeeds.
- Server-time calibration is working; the main problem is event/control state integrity, not missing clock sync.

Minimal implementation plan

1. Fix SyncV2 listener lifecycle first
- In `src/hooks/useSyncV2.ts`, replace the current registration guard approach with a stable subscription pattern that does not stack handlers across re-renders.
- Ensure cleanup removes the exact listener behavior instead of only resetting a flag.
- Keep this localized to SyncV2 event wiring.

2. Make host playback actions local-first, then broadcast
- In `src/hooks/useSyncV2.ts`:
  - `prepareSong()` should immediately cue the selected video locally for the host before/alongside broadcast.
  - `pause()` should immediately pause locally before/alongside broadcast.
  - keep `seek()` local-immediate as it already is.
  - verify `resume()` and `startSongInternal()` stay schedule-based, but only once.
- This should make DJ control panel actions visibly work even before remote echo arrives.

3. Unify the room UI around sync-authoritative playback state
- In `src/pages/Room.tsx`, derive a single display time for controls/lyrics from SyncV2 when status is `playing`, with safe fallback to raw player time when idle/paused.
- Pass that unified time into:
  - `RemoteControl`
  - `MobileRoomLayout`
  - `LyricsDisplay`
- Keep the player hook for actual media operations, but stop mixing different time sources in the visible control UI.

4. Tighten next-song and end-of-song behavior
- In `src/pages/Room.tsx` and `src/hooks/useSyncV2.ts`:
  - harden `handleVideoEnded()` so host transitions exactly once.
  - ensure next-song actions (`Next`, auto-advance, queue selection) always call the same prepare/start path.
  - when queue is exhausted, move the player out of the true YouTube `ENDED` presentation state quickly so native end recommendations do not remain visible.
- This is the lowest-risk place to suppress the end-screen without redesigning the player.

5. Restrict recommendation UI to true idle/queue-end states
- In `src/hooks/useRecommendations.ts` and `src/pages/Room.tsx`:
  - only fetch/show recommendations when the room is actually settled at the end of the queue, not merely “not playing”.
  - prevent recommendations from appearing during pauses, ready-check, or transient state changes.
- Keep the feature, but stop it from hijacking the main karaoke stage.

6. Small control-panel polish tied to correctness
- In `src/hooks/usePlaybackControls.ts`, keep local volume/mute state, but align the visible play/pause/seek response with sync-authoritative state.
- In `src/components/RemoteControl.tsx` and `src/components/MobileRoomLayout.tsx`, make the slider/playback visuals follow the unified time/status source so the panel feels responsive and trustworthy.

Files I would change
- `src/hooks/useSyncV2.ts`
- `src/pages/Room.tsx`
- `src/hooks/usePlaybackControls.ts`
- `src/hooks/useRecommendations.ts`
- `src/hooks/useYouTubePlayer.ts`
- `src/components/RemoteControl.tsx`
- `src/components/MobileRoomLayout.tsx`
- `src/components/room/RoomStage.tsx` (only if the recommendation/end-state overlay condition needs a small presentation tweak)

Expected outcome
- Play/pause works from DJ controls
- Volume/timeline controls visually track the real room state again
- Next song and queue selection reliably prepare/play the new track
- Lyrics stay aligned with the same playback timeline the room uses
- Duplicate SyncV2 reactions stop
- Recommendation overlays no longer appear at the wrong time
- Native YouTube end recommendations no longer leak through normal room playback flow

Remaining risk after this pass
- If YouTube embed behavior still shows a brief end-state flash on some videos/devices, a Phase 2 follow-up may be needed to further neutralize end-screen presentation. But the highest-value, code-confirmed regressions are the duplicated SyncV2 handlers and self-broadcast-dependent host controls.
