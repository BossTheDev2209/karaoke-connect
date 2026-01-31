

# Discord-Style Instant Speaking Ring

## Overview
Replace the current animated speaking indicator system with a fast, instant on/off green ring that immediately responds to speaking state - just like Discord's voice channels.

## Current Problems
1. `avatar-speaking` CSS class uses a 0.5s pulsing animation (slow, laggy feel)
2. The speaking ring in UserAvatarRow has `transition-opacity duration-150` and dynamic box-shadow calculations
3. Mic icon in UserAvatar has `animate-pulse` animation
4. Multiple overlapping visual effects create visual noise

## Solution: Clean Discord-Style Implementation

### Changes to `src/index.css`
Remove the pulsing animation, replace with instant static glow:
```css
.avatar-speaking {
  /* No animation - instant static glow */
  box-shadow: 0 0 0 3px hsl(var(--neon-green));
}
```

### Changes to `src/components/UserAvatarRow.tsx`
Simplify the speaking ring to be instant on/off:
- Remove `transition-opacity duration-150`
- Remove dynamic `boxShadow` calculation based on audio level
- Use simple conditional class for instant visibility

### Changes to `src/components/UserAvatar.tsx`
- Remove `animate-pulse` from the mic icon when speaking
- Remove the `avatar-speaking` class usage (will be handled by parent)
- Remove the green overlay pulse on custom avatars

### Changes to `src/components/HumanAvatar.tsx`
- Remove `avatar-speaking` class usage (handled by parent ring)

## Technical Summary

| File | Change |
|------|--------|
| `src/index.css` | Replace `pulse-glow` animation with static border/shadow |
| `src/components/UserAvatarRow.tsx` | Instant ring visibility, no transitions |
| `src/components/UserAvatar.tsx` | Remove pulse animations and avatar-speaking class |
| `src/components/HumanAvatar.tsx` | Remove avatar-speaking class |

## Result
- Green ring appears/disappears instantly when `user.isSpeaking` changes
- No animations, no delays, no smooth transitions
- Matches Discord's snappy voice activity indicator

