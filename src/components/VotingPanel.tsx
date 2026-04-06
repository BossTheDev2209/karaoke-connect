import React, { useState } from 'react';
import { User, RoomMode, BattleFormat } from '@/types/karaoke';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Vote, Swords, Mic2, UserX, Check, X, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ModeVoting } from './ModeVoting';

interface VoteKickState {
  targetUserId: string;
  targetNickname: string;
  initiatorId: string;
  votes: string[];
  requiredVotes: number;
}

interface VotingPanelProps {
  channel: RealtimeChannel | null;
  currentUserId: string;
  users: User[];
  currentMode: RoomMode;
  onModeChange: (mode: RoomMode, format?: BattleFormat) => void;
  activeVoteKick: VoteKickState | null;
  hasVoted: boolean;
  onStartVoteKick: (user: User) => void;
  onVoteYes: () => void;
  onVoteNo: () => void;
  voteKickDisabled: boolean;
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
  channel,
  currentUserId,
  users,
  currentMode,
  onModeChange,
  activeVoteKick,
  hasVoted,
  onStartVoteKick,
  onVoteYes,
  onVoteNo,
  voteKickDisabled,
}) => {
  const [selectedUserToKick, setSelectedUserToKick] = useState<string>('');
  const otherUsers = users.filter(u => u.id !== currentUserId);
  const isTarget = activeVoteKick?.targetUserId === currentUserId;

  const handleKickUser = () => {
    const user = users.find(u => u.id === selectedUserToKick);
    if (user) {
      onStartVoteKick(user);
      setSelectedUserToKick('');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "h-8 gap-2 text-xs font-medium",
            activeVoteKick && "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
          )}
        >
          <Vote className="w-4 h-4" />
          Vote
          {activeVoteKick && (
            <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Vote className="w-4 h-4 text-primary" />
            Voting Panel
          </div>

          {/* Active Vote Kick Banner */}
          {activeVoteKick && (
            <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-destructive animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {isTarget ? 'Vote to kick you!' : `Kick ${activeVoteKick.targetNickname}?`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeVoteKick.votes.length}/{activeVoteKick.requiredVotes} votes needed
                  </p>
                </div>
              </div>
              
              {!isTarget && !hasVoted && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onVoteYes}
                    className="flex-1 h-7 text-xs"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onVoteNo}
                    className="flex-1 h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    No
                  </Button>
                </div>
              )}
              
              {(hasVoted || isTarget) && (
                <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isTarget ? 'Waiting for results...' : 'Vote Registered'}
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Mode Voting Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {currentMode === 'team-battle' ? (
                <Swords className="w-3.5 h-3.5" />
              ) : (
                <Mic2 className="w-3.5 h-3.5" />
              )}
              Room Mode
            </div>
            <ModeVoting
              channel={channel}
              currentUserId={currentUserId}
              usersCount={users.length}
              currentMode={currentMode}
              onModeChange={onModeChange}
            />
          </div>

          <Separator />

          {/* Vote Kick Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <UserX className="w-3.5 h-3.5" />
              Vote Kick
            </div>
            
            {otherUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No other users in the room
              </p>
            ) : (
              <div className="flex gap-2">
                <Select 
                  value={selectedUserToKick} 
                  onValueChange={setSelectedUserToKick}
                  disabled={voteKickDisabled}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full bg-primary" 
                          />
                          {user.nickname}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleKickUser}
                  disabled={!selectedUserToKick || voteKickDisabled}
                  className="h-8 text-xs"
                >
                  Start Vote
                </Button>
              </div>
            )}
            
            {voteKickDisabled && activeVoteKick && (
              <p className="text-[10px] text-muted-foreground text-center">
                Vote in progress...
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
