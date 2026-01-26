
# Fix Song Control Privilege for Queue Selection

## Problem Summary
Users with "DJ" control access (granted by host via the Host Control Panel) can use the playback controls (play/pause, skip, seek) in the RemoteControl panel, but they **cannot select songs from the queue** or remove songs. This is because the SongQueue component checks `isHost` directly instead of using the `canControl` permission flag.

## Root Cause
In `src/pages/Room.tsx`, the SongQueue component is wired incorrectly:

```tsx
// Current (broken)
<SongQueue 
  onRemove={isHost ? handleRemoveSong : undefined} 
  onSelect={isHost ? handleSelectSong : undefined}
/>
```

It should use `canControl` which includes users with `hasControlAccess`:

```tsx
// Correct
<SongQueue 
  onRemove={canControl ? handleRemoveSong : undefined} 
  onSelect={canControl ? handleSelectSong : undefined}
/>
```

## Changes Required

### File: `src/pages/Room.tsx`

**Change 1: Fix SongQueue Desktop View** (around line 966-967)
- Replace `isHost` with `canControl` for both `onRemove` and `onSelect` props

**Change 2: Also verify Mobile Layout** (around line 727-728)
- The `MobileRoomLayout` component also passes these handlers, need to verify it uses proper permissions

## Technical Details

The `canControl` variable is already correctly computed:
```tsx
const canControl = useMemo(() => {
  if (isHost) return true;
  const currentUserData = users.find(u => u.id === user?.id);
  return !!currentUserData?.hasControlAccess;
}, [isHost, users, user?.id]);
```

This correctly grants control to:
1. The host (always)
2. Any user with `hasControlAccess: true` (granted via Host Control Panel → Users → Music note icon)

The `hasControlAccess` flag is properly:
- Toggled by `toggleControlAccess()` in `useRoom.ts`
- Broadcast via `permission_update` event
- Synced across all clients

## Testing Verification
After the fix, users with "DJ" badge should be able to:
- ✅ Click on any song in the queue to select it
- ✅ Remove songs from the queue via the trash icon
- ✅ Use play/pause controls (already working)
- ✅ Skip forward/backward (already working)
- ✅ Seek using the progress bar (already working)
