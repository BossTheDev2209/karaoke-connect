import { useState, useEffect, useCallback, useRef } from 'react';
import { User, RoomMode, PlaybackState } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useVoteKick } from '@/components/VoteKick';
import { toast } from 'sonner';

interface UseRoomModerationProps {
  channel: RealtimeChannel | null;
  userId: string;
  users: User[];
  navigate: (path: string) => void;
  playbackState: PlaybackState;
  roomMode: RoomMode;
}

export function useRoomModeration({
  channel,
  userId,
  users,
  navigate,
  playbackState,
  roomMode,
}: UseRoomModerationProps) {
  // State for Team Battle Winner Screen
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);

  // Close winner screen when song changes (for non-hosts reacting to host action)
  useEffect(() => {
    setShowWinnerScreen(false);
  }, [playbackState.currentSongIndex]);

  // Vote kick
  const handleUserKicked = useCallback(() => {
    sessionStorage.removeItem('karaoke_user');
    navigate('/');
  }, [navigate]);

  const { activeVoteKick, startVoteKick, voteYes, voteNo, hasVoted } = useVoteKick(
    channel,
    userId,
    users,
    handleUserKicked
  );

  const handleVoteKick = useCallback(
    (targetUserId: string) => {
      const targetUser = users.find((u) => u.id === targetUserId);
      if (targetUser) {
        startVoteKick(targetUser);
      }
    },
    [users, startVoteKick]
  );

  // Ref for handling host actions (mute/kick) to avoid circular dependencies with useMicrophone
  const onHostActionRef = useRef<((action: 'mute' | 'kick' | 'control_access', payload?: any) => void) | null>(null);

  const handleHostAction = useCallback((action: 'mute' | 'kick' | 'control_access', payload?: any) => {
    onHostActionRef.current?.(action, payload);
  }, []);

  return {
    showWinnerScreen,
    setShowWinnerScreen,
    activeVoteKick,
    startVoteKick,
    voteYes,
    voteNo,
    hasVoted,
    handleVoteKick,
    handleUserKicked,
    onHostActionRef,
    handleHostAction,
    handleLeave: handleUserKicked, // same behavior
  };
}
