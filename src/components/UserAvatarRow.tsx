import React, { useState } from 'react';
import { User, RoomMode, BattleFormat } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';
import { LightStick, LIGHTSTICK_COLORS } from './effects/LightStick';
import { VoteKickButton } from './VoteKick';
import { MusicNotesEffect } from './effects/SingerEffects';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserAvatarItemProps {
  user: User;
  currentUserId: string | null;
  usersCount: number;
  isWaving: boolean;
  audioIntensity: number;
  beatPhase: number;
  isBeat: boolean;
  bpm: number;
  roomMode: RoomMode;
  activeMainSingerId: string | null;
  activeTeam: string | null;
  voteKickDisabled: boolean;
  onStartVoteKick?: (user: User) => void;
  userVolume: number;
  onVolumeChange?: (userId: string, volume: number) => void;
  color: string;
  isHost?: boolean;
  onSwapTeam?: (userId: string) => void;
  activeReaction: string | null;
  partyMode: boolean;
}

const UserAvatarItem: React.FC<UserAvatarItemProps> = ({
  user,
  currentUserId,
  usersCount,
  isWaving,
  audioIntensity,
  beatPhase,
  isBeat,
  bpm,
  roomMode,
  activeMainSingerId,
  activeTeam,
  voteKickDisabled,
  onStartVoteKick,
  userVolume,
  onVolumeChange,
  color,
  isHost,
  onSwapTeam,
  activeReaction,
  partyMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isMainSinger = user.id === activeMainSingerId;
  const userAudioLevel = user.audioLevel || 0;
  
  // Cheerleader effect: jump if member of other team is singing (only in party mode)
  const isCheerleader = partyMode && roomMode === 'team-battle' && activeTeam && user.team !== activeTeam && activeMainSingerId;

  // Two-level sing react - LOWERED THRESHOLDS for more responsive feedback:
  const isNormalLoud = userAudioLevel > 0.25;
  const isExtraLoud = userAudioLevel > 0.50;
  
  // Discord-style: No jumping/scaling, just static
  const dynamicScale = 1;
  const translateY = 0;

  // If popover is open, we can still subtly bounce for rhythm but avoid heavy transforms
  // or just stay static. Static is safest for UI interaction.

  return (
    <div className={cn(
      "flex items-end gap-1 group relative",
      isMainSinger && isExtraLoud && "z-30",
      isMainSinger && !isExtraLoud && "z-20",
      !isMainSinger && "z-10",
      !isOpen && isCheerleader && "animate-bounce" // Only bounce in party mode
    )}
    style={{
      transform: `scale(${dynamicScale}) translateY(${translateY}px)`,
      transition: 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)', // Smoother spring-like ease
      willChange: 'transform',
    }}
    >
      {/* Music notes floating effect for loud singing (only in party mode) */}
      {partyMode && <MusicNotesEffect isActive={isMainSinger && user.isSpeaking && isNormalLoud} audioLevel={userAudioLevel} />}



      {/* Zoom-style active reaction badge */}
      {activeReaction && (
        <div className="absolute -top-3 -left-3 z-50 animate-in zoom-in fade-in duration-300">
          <div className="text-4xl filter drop-shadow-md animate-bounce-subtle">
            {activeReaction}
          </div>
        </div>
      )}

      {/* Light stick on left side - synced to BPM (only in party mode) */}
      {partyMode && isWaving && (
        <div className="relative -mr-2 z-10">
          <LightStick
            color={color}
            isWaving={true}
            intensity={audioIntensity}
            beatPhase={beatPhase}
            isBeat={isBeat}
            bpm={bpm}
            size="sm"
            className="transform -rotate-12"
          />
        </div>
      )}
      
      <div className={cn(
        'transition-transform duration-300',
        partyMode && !isOpen && (isWaving || isCheerleader) && 'animate-bounce-subtle'
      )}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button className="relative outline-none focus:ring-2 focus:ring-primary rounded-full transition-transform active:scale-95">
              {/* Discord-style Speaking Ring */}
              <div 
                className={cn(
                  "absolute -inset-1 rounded-full border-2 border-green-500 z-0 transition-opacity duration-150",
                  user.isSpeaking ? "opacity-100" : "opacity-0"
                )}
                style={{
                  transform: 'scale(1)',
                  boxShadow: user.isSpeaking ? `0 0 ${10 + userAudioLevel * 15}px rgba(34, 197, 94, 0.6)` : 'none'
                }}
              />
              
              <div className="relative z-10">
                <UserAvatar
                  user={user}
                  size="lg"
                  showName
                  isMainSinger={isMainSinger}
                  audioLevel={userAudioLevel}
                  isExtraLoud={isExtraLoud}
                />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 glass backdrop-blur-xl border-primary/20" side="top">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{user.nickname}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">User Volume</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  {Math.round(userVolume)}%
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[userVolume]}
                  max={200}
                  step={1}
                  onValueChange={([val]) => onVolumeChange?.(user.id, val)}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4 text-primary" />
              </div>
              
              <p className="text-[10px] text-center text-muted-foreground italic">
                Volume changes are saved locally to your browser.
              </p>
              
              {/* Team Swap Button - Host only, Team Battle mode only */}
              {isHost && roomMode === 'team-battle' && user.team && onSwapTeam && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    onSwapTeam(user.id);
                    setIsOpen(false);
                  }}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap to {user.team === 'left' ? 'Blue' : 'Pink'} Team
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

interface UserAvatarRowProps {
  users: User[];
  currentUserId: string | null;
  wavingUsers?: Set<string>;
  audioIntensity?: number;
  beatPhase?: number;
  isBeat?: boolean;
  bpm?: number;
  onStartVoteKick?: (user: User) => void;
  voteKickDisabled?: boolean;
  roomMode?: RoomMode;
  battleFormat?: BattleFormat;
  userVolumes?: Record<string, number>;
  onVolumeChange?: (userId: string, volume: number) => void;
  isHost?: boolean;
  onSwapTeam?: (userId: string) => void;
  activeReactions?: Map<string, string>;
}

export const UserAvatarRow: React.FC<UserAvatarRowProps> = ({ 
  users, 
  currentUserId,
  wavingUsers = new Set(),
  audioIntensity = 0,
  beatPhase = 0,
  isBeat = false,
  bpm = 120,
  onStartVoteKick,
  voteKickDisabled = false,
  roomMode = 'free-sing',
  battleFormat,
  userVolumes = {},
  onVolumeChange,
  isHost = false,
  onSwapTeam,
  activeReactions = new Map(),
}) => {
  const { partyMode } = useTheme();
  // Sort to put current user first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return 0;
  });

  // Assign consistent colors to users based on their index
  const getUserColor = (userId: string) => {
    const index = users.findIndex(u => u.id === userId);
    return LIGHTSTICK_COLORS[index % LIGHTSTICK_COLORS.length];
  };

  // Determine main singer (the one with the highest audio level)
  const mainSinger = users.length > 0 ? users.reduce((prev, current) => 
    ((current.audioLevel || 0) > (prev?.audioLevel || 0)) ? current : prev
  , users[0]) : null;

  // Only consider someone main singer if they are actually speaking and above a threshold
  const activeMainSingerId = mainSinger && mainSinger.isSpeaking && (mainSinger.audioLevel || 0) > 0.05 
    ? mainSinger.id 
    : null;

  const mainSingerUser = users.find(u => u.id === activeMainSingerId);
  const activeTeam = mainSingerUser?.team || null;

  // Split users for Team Battle
  const leftTeam = users.filter(u => u.team === 'left');
  const rightTeam = users.filter(u => u.team === 'right');
  const unassigned = users.filter(u => !u.team);

  const renderUser = (user: User) => (
    <UserAvatarItem 
      key={user.id}
      user={user}
      currentUserId={currentUserId}
      usersCount={users.length}
      isWaving={wavingUsers.has(user.id)}
      color={getUserColor(user.id)}
      audioIntensity={audioIntensity}
      beatPhase={beatPhase}
      isBeat={isBeat}
      bpm={bpm}
      roomMode={roomMode || 'free-sing'}
      activeMainSingerId={activeMainSingerId}
      activeTeam={activeTeam}
      voteKickDisabled={voteKickDisabled}
      onStartVoteKick={onStartVoteKick}
      userVolume={userVolumes[user.id] ?? 100}
      onVolumeChange={onVolumeChange}
      isHost={isHost}
      onSwapTeam={onSwapTeam}
      activeReaction={activeReactions.get(user.id) || null}
      partyMode={partyMode}
    />
  );

  return (
    <div className="glass rounded-2xl p-6 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-xl">
      {roomMode === 'team-battle' ? (
        <div className="flex flex-col gap-4">
          {/* Team Battle Singers - Simplified layout without duplicate scores */}
          <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4 lg:gap-8">
            {/* Left Team (Pink) */}
            <div className="flex-1 flex flex-col gap-3 p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/5 border border-pink-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500" />
                <span className="text-xs font-black text-pink-400 uppercase tracking-widest">Team Pink</span>
              </div>
              
              <div className="flex items-center justify-start gap-3 flex-wrap min-h-[80px]">
                {leftTeam.length > 0 ? (
                  leftTeam.map(renderUser)
                ) : (
                  <div className="w-full h-20 flex items-center justify-center border-2 border-dashed border-pink-500/20 rounded-xl bg-pink-500/5">
                    <p className="text-[10px] text-pink-500/40 uppercase font-bold tracking-widest">Waiting...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Team (Blue) */}
            <div className="flex-1 flex flex-col gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Team Blue</span>
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
              </div>
              
              <div className="flex items-center justify-end gap-3 flex-wrap min-h-[80px]">
                {rightTeam.length > 0 ? (
                  rightTeam.map(renderUser)
                ) : (
                  <div className="w-full h-20 flex items-center justify-center border-2 border-dashed border-blue-500/20 rounded-xl bg-blue-500/5">
                    <p className="text-[10px] text-blue-500/40 uppercase font-bold tracking-widest">Waiting...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {unassigned.length > 0 && (
            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] text-center text-muted-foreground uppercase tracking-[0.2em] font-bold mb-3 opacity-50">Bench</p>
              <div className="flex items-end justify-center gap-4 flex-wrap">
                {unassigned.map(renderUser)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <h3 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Singers</h3>
          <div className="flex items-end justify-start lg:justify-center gap-4 lg:gap-8 flex-nowrap lg:flex-wrap overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-hide">
            {sortedUsers.map(renderUser)}
            {users.length === 0 && (
              <p className="text-muted-foreground">No singers yet — invite friends!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
