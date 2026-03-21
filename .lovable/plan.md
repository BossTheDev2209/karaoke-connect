

# Phase 6.6: Verification Report + Minimal Hardening

## 1. Runtime Verification Status

**Single-client verification**: COMPLETED. Room creation works, host view renders correctly, no sync-related errors in console. The app loads, creates rooms, and shows all expected UI.

**Multi-client verification**: NOT POSSIBLE. The browser tool supports only a single session — I cannot open a second independent tab to simulate a joiner. This is a hard limitation of the testing environment.

**Conclusion**: All multi-client scenarios (A through J) remain CODE-ONLY verified. I cannot claim runtime evidence for any of them.

## 2. Reclassifications from Phase 6.5

| Scenario | Phase 6.5 Status | Phase 6.6 Status | Reason |
|----------|-----------------|-----------------|--------|
| A: Normal join | PASS | PASS WITH RISK | Code-only, no runtime joiner evidence |
| B: Multiple non-hosts | PASS | PASS WITH RISK | Code-only |
| C: Duplicate response | PASS | PASS WITH RISK | Code-only, logic is correct but untested |
| D: Mismatched requestId | PASS | PASS WITH RISK | Code-only |
| E: Delayed/stale | PASS | PASS WITH RISK | Code-only |
| F: Join mid-song | PASS | PASS WITH RISK | Code-only |
| G: Ready check join | PASS WITH RISK | PASS WITH RISK | Unchanged |
| H: Queue transition | PASS | PASS WITH RISK | Code-only |
| I: Host leaves | PASS WITH RISK | PASS WITH RISK | Unchanged |
| J: Cleanup/listeners | PASS | PASS WITH RISK | Code-only |

All scenarios require manual multi-tab QA before shipping.

## 3. Hardening Fix #1: Proactive-join gating

**Problem**: A `proactive-join` response is accepted even when a `sync_request` is already in flight (`pendingSyncRequestIdRef.current !== null`). The proactive push arrives ~500ms after join, while the explicit sync_request fires ~300ms after join. Both can race and the proactive one might win, then the explicit response also gets accepted because its requestId differs from `'proactive-join'`.

Current acceptance logic (line 287):
```
const isAcceptable = (isProactive || matchesPending) && incomingRequestId !== fulfilledId;
```

**Fix**: If there is an active pending sync request, reject proactive pushes — only the correlated response should be accepted:
```
const isProactive = incomingRequestId === 'proactive-join' && !pendingId;
```

This means:
- If joiner has already sent a `sync_request` (pendingId is set), proactive push is ignored — the correlated response will arrive shortly
- If joiner has NOT sent a `sync_request` (e.g. reconnect case where `shouldRequestSync` was false), proactive push is accepted as before
- After fulfillment, `syncFulfilledIdRef` prevents any further application regardless

**File**: `src/hooks/useRoom.ts` line 285  
**Change**: Single expression update  
**Safety**: Strictly tighter gating. No new code paths.

## 4. Hardening Fix #2: Sync request retry timeout

**Problem**: If no host responds to `sync_request` (host crashed, network partition, slow), the joiner silently gets stuck with no room state. No retry exists.

**Fix**: Add a single delayed retry 5 seconds after the initial request. If `hasSyncedRef.current` is still false when the timer fires, re-emit `sync_request` with the same `requestId`. No loop, no multi-responder, no infinite retry.

**File**: `src/hooks/useRoom.ts` lines ~386-402  
**Change**: Add a `setTimeout` after the initial request that checks `hasSyncedRef.current` and retries once if still false  
**Safety**: Same requestId reuse means the existing dedup logic still prevents double-application. Only fires once. Cleaned up on unmount.

## 5. Files Changed

| File | Change |
|------|--------|
| `src/hooks/useRoom.ts` line 285 | Tighten proactive-join to reject when pending request exists |
| `src/hooks/useRoom.ts` lines 386-402 | Add single retry timeout for sync_request |

## 6. Remaining Real Risks Before Shipping

1. **All multi-client scenarios are code-only verified** — manual 2-tab QA is mandatory
2. **Joiner during `preparing` phase** won't see ready check overlay (pre-existing, not a Phase 6 issue)
3. **`useRoom.ts` is still ~660 lines** — future decomposition needed but not blocking

