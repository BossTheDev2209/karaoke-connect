import React, { useState, useCallback, useEffect } from 'react';
import { RoomMode, BattleFormat, RealtimePayload } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Swords, Mic2, Users2, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ModeVoteState {
  mode: RoomMode;
  format?: BattleFormat;
  votes: string[]; // User IDs
}

interface ModeVotingProps {
  channel: RealtimeChannel | null;
  currentUserId: string;
  usersCount: number;
  currentMode: RoomMode;
  onModeChange: (mode: RoomMode, format?: BattleFormat) => void;
}

export const ModeVoting: React.FC<ModeVotingProps> = ({
  channel,
  currentUserId,
  usersCount,
  currentMode,
  onModeChange,
}) => {
  const [activeVote, setActiveVote] = useState<ModeVoteState | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!channel) return;

    const handleBroadcast = ({ payload }: { payload: RealtimePayload }) => {
      if (payload.type === 'mode_vote_start') {
        const voteData = payload.payload as ModeVoteState;
        setActiveVote(voteData);
        setHasVoted(voteData.votes.includes(currentUserId));
        toast({
          title: "Mode Vote Started",
          description: `Switch to ${voteData.mode === 'team-battle' ? 'Team Battle' : 'Free Sing'}?`,
        });
      }

      if (payload.type === 'mode_vote_cast') {
        const { voterId } = payload.payload as { voterId: string };
        setActiveVote(prev => {
          if (!prev) return null;
          const newVotes = [...new Set([...prev.votes, voterId])];
          
          // Check if majority reached
          const required = Math.floor(usersCount / 2) + 1;
          if (newVotes.length >= required) {
            onModeChange(prev.mode, prev.format);
            toast({
              title: "Vote Passed",
              description: `Room switched to ${prev.mode}!`,
            });
            return null;
          }
          return { ...prev, votes: newVotes };
        });
      }
    };

    channel.on('broadcast', { event: 'room_event' }, handleBroadcast);
    return () => {
      // Listener removal is handled by channel cleanup if managed centrally
    };
  }, [channel, currentUserId, usersCount, onModeChange]);

  const startVote = (mode: RoomMode, format?: BattleFormat) => {
    if (!channel || usersCount < 2) {
      if (usersCount < 2) {
        onModeChange(mode, format); // Single user can switch instantly
        return;
      }
      return;
    }

    const voteData: ModeVoteState = {
      mode,
      format,
      votes: [currentUserId],
    };

    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'mode_vote_start', payload: voteData },
    });
  };

  const castVote = () => {
    if (!channel || !activeVote || hasVoted) return;
    setHasVoted(true);
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'mode_vote_cast', payload: { voterId: currentUserId } },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {activeVote ? (
        <div className="glass p-4 rounded-xl border-2 border-primary/50 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-sm font-semibold mb-2">Vote: {activeVote.mode === 'team-battle' ? 'Team Battle' : 'Free Sing'}</p>
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              onClick={castVote} 
              disabled={hasVoted}
              className={cn("flex-1", hasVoted && "bg-muted")}
            >
              {hasVoted ? <Check className="w-4 h-4 mr-1" /> : <Swords className="w-4 h-4 mr-1" />}
              {hasVoted ? 'Voted' : 'Vote Yes'}
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {activeVote.votes.length}/{Math.floor(usersCount / 2) + 1} needed
            </span>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant={currentMode === 'free-sing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => startVote('free-sing')}
            className="flex-1"
          >
            <Mic2 className="w-4 h-4 mr-2" />
            Free Sing
          </Button>
          <Button
            variant={currentMode === 'team-battle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => startVote('team-battle', '1v1')}
            className="flex-1"
          >
            <Swords className="w-4 h-4 mr-2" />
            Team Battle
          </Button>
        </div>
      )}
    </div>
  );
};
