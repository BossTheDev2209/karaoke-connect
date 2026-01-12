import React, { useState, useCallback } from 'react';
import { User } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { UserX, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

interface VoteKickState {
  targetUserId: string;
  targetNickname: string;
  initiatorId: string;
  votes: string[];
  requiredVotes: number;
}

interface UseVoteKickReturn {
  activeVoteKick: VoteKickState | null;
  startVoteKick: (target: User) => void;
  voteYes: () => void;
  voteNo: () => void;
  hasVoted: boolean;
}

export const useVoteKick = (
  channel: RealtimeChannel | null,
  currentUserId: string,
  users: User[],
  onUserKicked?: (userId: string) => void
): UseVoteKickReturn => {
  const [activeVoteKick, setActiveVoteKick] = useState<VoteKickState | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Listen for vote kick events
  React.useEffect(() => {
    if (!channel) return;

    const handleBroadcast = (payload: { payload: { type: string; payload: unknown } }) => {
      const data = payload.payload;
      
      if (data.type === 'vote_kick_start') {
        const voteData = data.payload as VoteKickState;
        setActiveVoteKick(voteData);
        setHasVoted(voteData.initiatorId === currentUserId); // Initiator auto-votes yes
        
        if (voteData.targetUserId === currentUserId) {
          toast({
            title: 'Vote kick started',
            description: 'Someone has started a vote to kick you from the room.',
            variant: 'destructive',
          });
        }
      }
      
      if (data.type === 'vote_kick_vote') {
        const { targetUserId, voterId, vote } = data.payload as { targetUserId: string; voterId: string; vote: boolean };
        
        if (activeVoteKick?.targetUserId === targetUserId) {
          setActiveVoteKick(prev => {
            if (!prev) return null;
            const newVotes = vote 
              ? [...new Set([...prev.votes, voterId])]
              : prev.votes;
            
            // Check if vote passed
            if (newVotes.length >= prev.requiredVotes) {
              // Vote passed - kick user
              channel.send({
                type: 'broadcast',
                event: 'room_event',
                payload: { type: 'kick_user', payload: { userId: targetUserId } },
              });
              
              toast({
                title: 'Vote passed',
                description: `${prev.targetNickname} has been kicked from the room.`,
              });
              
              return null;
            }
            
            return { ...prev, votes: newVotes };
          });
        }
      }
      
      if (data.type === 'kick_user') {
        const { userId } = data.payload as { userId: string };
        
        if (userId === currentUserId) {
          toast({
            title: 'You have been kicked',
            description: 'You were voted out of the room.',
            variant: 'destructive',
          });
          onUserKicked?.(userId);
        }
        
        setActiveVoteKick(null);
        setHasVoted(false);
      }
    };

    // Subscribe to room events
    channel.on('broadcast', { event: 'room_event' }, handleBroadcast);

    // Listener cleanup is handled by useRoom when channel is destroyed
    // Do NOT unsubscribe here as it kills the entire room connection
  }, [channel, currentUserId, activeVoteKick, onUserKicked]);

  // Auto-expire vote after 30 seconds
  React.useEffect(() => {
    if (!activeVoteKick) return;
    
    const timeout = setTimeout(() => {
      setActiveVoteKick(null);
      setHasVoted(false);
      toast({
        title: 'Vote expired',
        description: 'The vote kick did not pass in time.',
      });
    }, 30000);
    
    return () => clearTimeout(timeout);
  }, [activeVoteKick]);

  const startVoteKick = useCallback((target: User) => {
    if (!channel || users.length < 2) return;
    
    // Need absolute majority to kick (> 50% of people in room)
    const requiredVotes = Math.floor(users.length / 2) + 1;
    
    const voteData: VoteKickState = {
      targetUserId: target.id,
      targetNickname: target.nickname,
      initiatorId: currentUserId,
      votes: [currentUserId], // Initiator auto-votes yes
      requiredVotes,
    };
    
    setActiveVoteKick(voteData);
    setHasVoted(true);
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: { type: 'vote_kick_start', payload: voteData },
    });
    
    toast({
      title: 'Vote started',
      description: `Vote to kick ${target.nickname} has started. Need ${requiredVotes} votes.`,
    });
  }, [channel, currentUserId, users.length]);

  const voteYes = useCallback(() => {
    if (!channel || !activeVoteKick || hasVoted) return;
    
    setHasVoted(true);
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'vote_kick_vote',
        payload: {
          targetUserId: activeVoteKick.targetUserId,
          voterId: currentUserId,
          vote: true,
        },
      },
    });
  }, [channel, activeVoteKick, currentUserId, hasVoted]);

  const voteNo = useCallback(() => {
    if (!channel || !activeVoteKick || hasVoted) return;
    
    setHasVoted(true);
    
    channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: {
        type: 'vote_kick_vote',
        payload: {
          targetUserId: activeVoteKick.targetUserId,
          voterId: currentUserId,
          vote: false,
        },
      },
    });
  }, [channel, activeVoteKick, currentUserId, hasVoted]);

  return {
    activeVoteKick,
    startVoteKick,
    voteYes,
    voteNo,
    hasVoted,
  };
};

// Vote Kick UI Components
interface VoteKickButtonProps {
  user: User;
  currentUserId: string;
  onStartVote: (user: User) => void;
  disabled?: boolean;
}

export const VoteKickButton: React.FC<VoteKickButtonProps> = ({
  user,
  currentUserId,
  onStartVote,
  disabled,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (user.id === currentUserId) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 opacity-40 group-hover:opacity-100 transition-all duration-300 text-destructive hover:text-destructive hover:bg-destructive/10 bg-background/50 backdrop-blur-sm rounded-full border border-destructive/20"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled}
        title={`Vote to kick ${user.nickname}`}
      >
        <UserX className="w-4 h-4" />
      </Button>
      
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start vote to kick {user.nickname}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start a vote among all room members. The user will be kicked if enough people vote yes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onStartVote(user);
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Start Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface VoteKickBannerProps {
  voteKick: VoteKickState;
  currentUserId: string;
  hasVoted: boolean;
  onVoteYes: () => void;
  onVoteNo: () => void;
}

export const VoteKickBanner: React.FC<VoteKickBannerProps> = ({
  voteKick,
  currentUserId,
  hasVoted,
  onVoteYes,
  onVoteNo,
}) => {
  const isTarget = voteKick.targetUserId === currentUserId;

  return (
    <div className="relative w-full mt-4 z-10 animate-fade-in">
      <div className="glass-morphism border-2 border-destructive/30 rounded-2xl px-4 py-3 shadow-xl flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-destructive/10 rounded-full shrink-0">
            <UserX className="w-5 h-5 text-destructive animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {isTarget ? 'Vote to kick you' : `Kick ${voteKick.targetNickname}?`}
            </p>
            <p className="text-xs text-muted-foreground">
              {voteKick.votes.length}/{voteKick.requiredVotes} votes needed
            </p>
          </div>
        </div>
        
        {!isTarget && !hasVoted && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={onVoteYes}
              className="flex-1 h-8 text-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onVoteNo}
              className="flex-1 h-8 text-xs bg-background/50"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              No
            </Button>
          </div>
        )}
        
        {(hasVoted || isTarget) && (
          <div className="text-center py-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
              {isTarget ? 'Waiting for results...' : 'Vote Registered'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
