

# Phase 6: Protocol-Safe Fix for HIGH-1 (dual full_sync_response race)

## 1. Problem Confirmation

**Exact cause**: A joining client triggers TWO `full_sync_response` messages:
1. **Proactive push** (useRoom.ts:142-158): Host detects presence join → sends full state after 500ms delay
2. **sync_request response** (useRoom.ts:232-251): Joiner broadcasts `sync_request` after 300ms → host responds with full state

Both responses arrive independently. Both `useRoom` (line 254-273) and `useSyncV2` (line 471-513) process each one. Result: 2×2 = up to 4 state hydration calls, with `onCueVideo`, `onSeekRequired`, `onPlayRequired` potentially fired multiple times with different timing.

**No requestId exists**. No sender validation. No duplicate rejection. `hasSyncedRef` in useRoom partially gates queue hydration but doesn't prevent useSyncV2 from processing both responses.

## 2. Fix Strategy

### A) Add `requestId` correlation to sync_request/response

- `sync_request` includes `requestId: string` and `requesterId: string`
- `full_sync_response` includes `requestId: string` and `senderId: string`
- Proactive push on join uses `requestId: 'proactive-{newUserId}'`

### B) Joiner tracks pending request lifecycle

In `useRoom.ts`, add refs:
- `pendingSyncRequestId: string | null` — active request
- `syncFulfilledRequestId: string | null` — already-applied request

When sync_request is emitted → set `pendingSyncRequestId`, clear `syncFulfilledRequestId`.

### C) Only host responds to sync_request

Already the case (line 234: `if (isHostRef.current)`). No change needed.

### D) Joiner validates before applying full_sync_response

In `useRoom.ts` handler (line 254-273), before applying:
1. Check `requestId` matches `pendingSyncRequestId` OR is `'proactive-{userId}'`
2. Check not already fulfilled (`syncFulfilledRequestId !== requestId`)
3. If valid → apply, set `syncFulfilledRequestId = requestId`
4. If invalid → ignore with log

### E) useSyncV2 defers to useRoom for gating

The key insight: useSyncV2 should NOT independently decide whether to apply `full_sync_response`. Instead:
- Add a `onFullSyncPlayback` callback prop to useSyncV2
- useRoom calls this callback AFTER it validates and applies queue/mode
- useSyncV2 removes its own `full_sync_response` handler entirely

This eliminates the race: useRoom validates first, then passes playback state to useSyncV2 in a controlled sequence.

### F) Collapse proactive push + sync_request response

Currently both paths produce identical `full_sync_response` payloads. After this fix:
- Proactive push uses `requestId: 'proactive-join'`
- sync_request response uses the joiner's `requestId`
- Joiner accepts whichever arrives first and rejects the other

## 3. Files Changed

### `src/hooks/useRoom.ts`
- Add `pendingSyncRequestIdRef` and `syncFulfilledIdRef` refs
- Include `requestId` in `sync_request` emission (line 359)
- Include `requestId` in proactive push (line 144)
- Include `requestId` in sync_request response (line 237)
- Gate `full_sync_response` handler on requestId match + not-already-fulfilled
- After applying queue/mode, call a new callback to pass playback state to useSyncV2
- Add `onSyncPlaybackState?: (playbackState: PlaybackState) => void` parameter

### `src/hooks/useSyncV2.ts`
- Remove the `full_sync_response` case from the internal event handler (lines 471-513)
- Add an `applyFullSyncPlayback(state: PlaybackState)` function that does what the removed handler did
- Export this function from the hook return
- This function is called by useRoom after validation

### `src/pages/Room.tsx`
- Wire `syncV2.applyFullSyncPlayback` into `useRoom`'s `onSyncPlaybackState` parameter

## 4. New Sync Rules (Post-Fix)

| Rule | Detail |
|------|--------|
| Who can answer `sync_request` | Only the host (unchanged) |
| requestId generation | `crypto.randomUUID()` on each `sync_request`; `'proactive-join'` for presence-triggered push |
| When responses are ignored | Mismatched requestId, already-fulfilled requestId, or `hasSyncedRef` already true with non-empty queue |
| Duplicate prevention | `syncFulfilledIdRef` tracks last applied requestId; second response for same ID is dropped |
| Fallback | If no response within existing 300ms+500ms window, `requestSync()` can be called manually (already exists). No multi-responder fallback. |

## 5. Execution Order

1. Add `applyFullSyncPlayback` to `useSyncV2` return, remove `full_sync_response` from its event handler
2. Add requestId correlation + gating to `useRoom`
3. Wire callback in `Room.tsx`

## 6. Safety

- Join flow preserved: same data, same timing, just gated
- Host authority unchanged
- Queue/mode/playback hydration order now deterministic (useRoom first, then useSyncV2)
- Mobile/desktop identical (both use same hooks)
- No unrelated event types touched

