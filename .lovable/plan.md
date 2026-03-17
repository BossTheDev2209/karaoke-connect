

# Phase 1: JSX Extraction from Room.tsx

## Scope
Extract the desktop return JSX (lines 816–1263) into presentational-only components. All hooks, refs, state, effects, memoization, and event handlers stay in Room.tsx. New components receive only the minimum props they need and call callbacks — nothing else.

## New Files

### 1. `src/components/room/RoomHeader.tsx`
Extracts lines 839–940. Pure JSX for the header bar.

**Props:**
```typescript
interface RoomHeaderProps {
  code: string;
  isHost: boolean;
  isConnected: boolean;
  userCount: number;
  networkLatency: number;
  isMicEnabled: boolean;
  webrtcStats: { connectedPeers: number; connectionQuality: string; avgLatency: number };
  roomMode: RoomMode;
  onShowHostControlPanel: () => void;
  onLeave: () => void;
  // RoomMenu gets its own grouped props
  roomMenuProps: RoomMenuProps; // (existing RoomMenu prop interface)
}
```

Room.tsx pre-computes `userCount` (`users.length`) and passes it as a number. The `roomMenuProps` object is assembled in Room.tsx from all the voting/settings/eq/mic values already there.

### 2. `src/components/room/RoomStage.tsx`
Extracts lines 974–1165 (the video + lyrics column). Purely renders from booleans and prepared data.

**Props:**
```typescript
interface RoomStageProps {
  // Player
  youtubePlayerId: string; // always "youtube-player"
  // Overlays — all booleans pre-computed in Room.tsx
  showSingReactOverlay: boolean;
  singReactProps: { isPlaying: boolean; userId: string; channel: any; className: string };
  showCountdown: boolean;
  remainingSeconds: number | null;
  showReadyCheck: boolean;
  readyCheckUsers: Array<{ id: string; nickname: string; isReady: boolean }>;
  isHost: boolean;
  onForceStart: () => void;
  showNoSong: boolean;
  showRecommendations: boolean;
  recommendations: Array<{ id: string; thumbnail: string; title: string; artist: string; videoId: string }>;
  onAddRecommendation: (rec: any) => void;
  onDismissRecommendations: () => void;
  showPlayerError: boolean;
  playerError: { isAgeRestricted?: boolean; message?: string; videoId?: string } | null;
  onClearErrorAndSkip: () => void;
  hasMoreSongs: boolean;
  // Lyrics
  showLyrics: boolean;
  lyricsDisplayProps: { /* all LyricsDisplay props */ };
}
```

All conditional logic (`syncV2.playbackState.status === 'preparing'`, `!isPlaying && !playerError && queue.length <= 1 && recommendations.length > 0`, etc.) stays in Room.tsx and is passed as booleans.

### 3. `src/components/room/RoomControlsPanel.tsx`
Extracts lines 1168–1207. Wraps RemoteControl + ReactionBar.

**Props:**
```typescript
interface RoomControlsPanelProps {
  remoteControlProps: React.ComponentProps<typeof RemoteControl>;
  reactionBarProps: { onReact: (emoji: string) => void; isWaving: boolean; onWaveToggle: () => void };
}
```

### 4. `src/components/room/RoomOverlays.tsx`
Extracts lines 1229–1262. TeamBattle + VoteKick + LyricsSelector overlays.

**Props:**
```typescript
interface RoomOverlaysProps {
  // TeamBattle
  showTeamBattle: boolean;
  teamBattleProps: React.ComponentProps<typeof TeamBattleOverlay>;
  // VoteKick
  showVoteKick: boolean;
  voteKickProps: React.ComponentProps<typeof VoteKickOverlay>;
  // LyricsSelector
  showLyricsSelector: boolean;
  lyricsSelectorProps: React.ComponentProps<typeof LyricsSelector>;
}
```

### 5. `src/components/room/DesktopRoomLayout.tsx`
Composes RoomHeader + grid(QueuePanel, RoomStage, RoomControlsPanel) + UserAvatarRow + RoomOverlays. Replaces lines 816–1263.

**Props:**
```typescript
interface DesktopRoomLayoutProps {
  headerProps: RoomHeaderProps;
  stageProps: RoomStageProps;
  controlsProps: RoomControlsPanelProps;
  overlaysProps: RoomOverlaysProps;
  // Queue panel (inline, small enough to stay as props)
  queuePanelProps: {
    isHost: boolean;
    queue: Song[];
    currentSongIndex: number;
    canControl: boolean;
    onAddSong: (song: Song) => void;
    onRemoveSong: (songId: string) => void;
    onSelectSong: (index: number) => void;
    userId: string;
    getStatusForSong: (songId: string) => any;
  };
  // User avatar row
  avatarRowProps: React.ComponentProps<typeof UserAvatarRow>;
  // Layout flags
  layoutFlags: {
    isHost: boolean;
    celebrationEnabled: boolean;
    isExtraLoudSinging: boolean;
    isPlaying: boolean;
    maxUserAudioLevel: number;
  };
  celebration: any;
  // Host control panel (already a standalone component)
  hostControlPanelProps: React.ComponentProps<typeof HostControlPanel>;
  showHostControlPanel: boolean;
}
```

## What Changes in Room.tsx

The desktop `return` block (lines 816–1263) is replaced with:
```tsx
return (
  <DesktopRoomLayout
    headerProps={headerProps}
    stageProps={stageProps}
    controlsProps={controlsProps}
    overlaysProps={overlaysProps}
    queuePanelProps={queuePanelProps}
    avatarRowProps={avatarRowProps}
    layoutFlags={layoutFlags}
    celebration={celebration}
    hostControlPanelProps={hostControlPanelProps}
    showHostControlPanel={showHostControlPanel}
  />
);
```

The prop objects are assembled right before the return, using the existing variables already in scope. No new hooks, memos, or effects — just object literals.

## What Does NOT Change
- All hooks, refs, state, effects, memos, callbacks remain in Room.tsx
- Mobile path and `MobileRoomLayout` untouched
- All conditional business logic stays in Room.tsx (passed as booleans)
- No new `React.memo`, `useMemo`, `useCallback` introduced
- YouTube player ref stays in Room.tsx (`youtubePlayerRef`)
- `syncV2Ref`, `applyingRemoteRef`, `isHostRef`, `playbackStateRef`, `onHostActionRef` all stay in Room.tsx

## Estimated Room.tsx After Phase 1
~830 lines (all logic + prop assembly). Down from 1266. The ~430 lines of desktop JSX move to the new components.

## Execution Order
1. Create `RoomHeader.tsx`, `RoomStage.tsx`, `RoomControlsPanel.tsx`, `RoomOverlays.tsx` (leaf components, no dependencies on each other)
2. Create `DesktopRoomLayout.tsx` (composes the above)
3. Update `Room.tsx` to import and use `DesktopRoomLayout`

## Phase 2 Notes (prop groups that grew large)
- `roomMenuProps` in RoomHeader has ~20 props (all the EQ/mic/voting settings) — candidate for a controller hook extraction
- `remoteControlProps` has ~25 props — already typed by `RemoteControl` component, but the assembly is verbose
- `stageProps` is moderately large due to multiple overlay sub-groups — could benefit from overlay-specific hooks in Phase 2

