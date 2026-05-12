## Goal

Simplify the karaoke app to a clean, focused experience: synced YouTube playback, lyrics, queue, and a user row with reactions. Remove microphone-driven features, game modes, voting, audio effects, EQ, and light sticks.

## What's removed

**Microphone & audio processing**
- `src/hooks/useMicrophone.ts`
- `src/hooks/useAudioReactive.ts`
- `src/components/EQSettings.tsx`
- Mic toggle button in `PlayerControls`
- All `audioLevel` / `isSpeaking` updates from `useRoom`

**Game modes (Free Sing / Team Battle)**
- `src/components/ModeVoting.tsx`
- Mode badge in `Room.tsx` header
- Team assignment UI in `UserAvatarRow.tsx`
- `roomMode`, `battleFormat`, `updateMode`, `updateTeams` from `useRoom` (kept in types but unused, or stripped from the hook)

**Vote system**
- `src/components/VoteKick.tsx`
- `src/components/VotingPanel.tsx`
- Voting panel button in header
- Vote-kick action on avatar row

**Visual effects**
- `src/components/effects/SingerEffects.tsx` (DustFall, MusicNotes, Spotlight)
- `src/components/effects/BeatSyncBackground.tsx`
- `src/components/effects/NeonGridBackground.tsx`
- `src/components/effects/ParticleBackground.tsx`
- `src/components/effects/WaveformBackground.tsx`
- `src/components/effects/SingReactOverlay.tsx`
- `src/components/effects/LightStick.tsx`
- `src/components/effects/CelebrationOverlay.tsx` + `Confetti.tsx` + `Fireworks.tsx`
- Background-effect picker in `RoomSettings`
- Celebration toggle in `RoomSettings`
- Singer spotlight / scaling on `UserAvatar`

**What stays**
- Reactions bar + floating reactions + waving
- User avatar row (without team/vote/spotlight extras, no audio-reactive scaling)
- Queue, search, lyrics with romanization, YouTube sync
- Theme presets (color themes only) and karaoke search filter
- Open-mouth avatar variant (kept; just no longer driven by mic — falls back to normal image since `isSpeaking` is gone)

## Files to edit

- `src/pages/Room.tsx` — strip mic/effects/voting/mode imports and JSX; simpler header (room code, online count, theme settings, leave)
- `src/components/RoomSettings.tsx` — keep only Theme tab (presets + karaoke search filter); drop Effects + Audio tabs
- `src/components/PlayerControls.tsx` — remove mic toggle prop/button
- `src/components/UserAvatarRow.tsx` — drop audio/beat/team/vote-kick props; render simple avatar grid with waving + reactions only
- `src/components/UserAvatar.tsx` — drop `isMainSinger`, `audioLevel`, spotlight glow; keep open-mouth variant prop (defaults to closed/normal)
- `src/hooks/useRoom.ts` — drop `updateSpeaking`, `updateMode`, `updateTeams`, `roomMode`, `battleFormat` from the public API (keep presence + queue + playback sync)
- `src/index.css` — remove unused keyframes (`float-up`, `dust-fall`, `main-singer-glow`, beat-sync vars if unused)

## Files to delete

Hooks: `useMicrophone.ts`, `useAudioReactive.ts`
Components: `EQSettings.tsx`, `ModeVoting.tsx`, `VoteKick.tsx`, `VotingPanel.tsx`
Effects folder: `SingerEffects.tsx`, `BeatSyncBackground.tsx`, `NeonGridBackground.tsx`, `ParticleBackground.tsx`, `WaveformBackground.tsx`, `SingReactOverlay.tsx`, `LightStick.tsx`, `CelebrationOverlay.tsx`, `Confetti.tsx`, `Fireworks.tsx`

## Result

A lean room layout: header (room code + online count + theme/leave), left queue, center video + lyrics, right now-playing controls + reaction bar, bottom user avatar row with waving and floating reactions. No mic permission prompts, no game modes, no votes, no background effects, no light sticks.