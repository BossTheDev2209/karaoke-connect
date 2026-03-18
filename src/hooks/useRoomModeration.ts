import { useState, useEffect, useCallback, useRef } from 'react';
import { PlaybackState } from '@/types/karaoke';
import { toast } from 'sonner';

interface UseRoomModerationProps {
  playbackStateCurrentSongIndex: number;
  isMicEnabled: boolean;
  toggleMic: (eqSettings: number[]) => void;
  eqSettings: number[];
  onLeave: () => void;
}

/**
 * Manages moderation-related state: winner screen and host action ref.
 * Vote kick remains in Room.tsx because it depends on channel/users from useRoom.
 */
export function useRoomModeration({
  playbackStateCurrentSongIndex,
  isMicEnabled,
  toggleMic,
  eqSettings,
  onLeave,
}: UseRoomModerationProps) {
  // State for Team Battle Winner Screen
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);

  // Close winner screen when song changes
  useEffect(() => {
    setShowWinnerScreen(false);
  }, [playbackStateCurrentSongIndex]);

  // Ref for handling host actions (mute/kick) to avoid circular dependencies with useMicrophone
  const onHostActionRef = useRef<((action: 'mute' | 'kick' | 'control_access', payload?: any) => void) | null>(null);

  const handleHostAction = useCallback((action: 'mute' | 'kick' | 'control_access', payload?: any) => {
    onHostActionRef.current?.(action, payload);
  }, []);

  // Wire up the ref to actual handlers
  useEffect(() => {
    onHostActionRef.current = (action, payload) => {
      if (action === 'kick') {
        toast.error('You have been kicked from the room.');
        onLeave();
      } else if (action === 'mute') {
        if (isMicEnabled) {
          toast.warning('Your microphone was muted by the host.');
          toggleMic(eqSettings);
        }
      } else if (action === 'control_access') {
        const { hasControlAccess } = payload || {};
        if (hasControlAccess) {
          toast.success('You have been granted control access!');
        } else {
          toast.info('Your control access has been revoked.');
        }
      }
    };
  }, [onLeave, isMicEnabled, toggleMic, eqSettings]);

  return {
    showWinnerScreen,
    setShowWinnerScreen,
    onHostActionRef,
    handleHostAction,
  };
}
