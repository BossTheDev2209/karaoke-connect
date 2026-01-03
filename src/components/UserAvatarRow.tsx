import React from 'react';
import { User, RoomMode, BattleFormat } from '@/types/karaoke';
import { UserAvatar } from './UserAvatar';
import { LightStick, LIGHTSTICK_COLORS } from './effects/LightStick';
import { VoteKickButton } from './VoteKick';
import { SingerSpotlight, MusicNotesEffect, DustFallEffect } from './effects/SingerEffects';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from 'lucide-react';

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
}) => {
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
  const activeTeam = mainSingerUser?.team;

  // Split users for Team Battle
  const leftTeam = users.filter(u => u.team === 'left');
  const rightTeam = users.filter(u => u.team === 'right');
  const unassigned = users.filter(u => !u.team);

  const renderUser = (user: User) => {
    const isWaving = wavingUsers.has(user.id);
    const color = getUserColor(user.id);
    const isMainSinger = user.id === activeMainSingerId;
    const userAudioLevel = user.audioLevel || 0;
    
    // Cheerleader effect: jump if member of other team is singing
    const isCheerleader = roomMode === 'team-battle' && activeTeam && user.team !== activeTeam && activeMainSingerId;

    // Two-level sing react:
    // Level 1: Normal loud (audioLevel > 0.3) - moderate scale up
    // Level 2: Extra loud (audioLevel > 0.65) - spotlight + bigger scale
    const isNormalLoud = userAudioLevel > 0.3;
    const isExtraLoud = userAudioLevel > 0.65;
    
    // Dynamic scale: base 1.0, +0.15 if loud, +0.20 more if extra loud, +audio level bonus
    let dynamicScale = 1;
    let translateY = 0;
    
    if (isMainSinger) {
      if (isExtraLoud) {
        // Level 2: Extra loud - massive scale with spotlight
        dynamicScale = 1.35 + (userAudioLevel * 0.15);
        translateY = -20 - (userAudioLevel * 10);
      } else if (isNormalLoud) {
        // Level 1: Normal loud - moderate scale up
        dynamicScale = 1.15 + ((userAudioLevel - 0.3) * 0.3);
        translateY = -8 - (userAudioLevel * 5);
      } else {
        // Speaking but not loud
        dynamicScale = 1.05 + (userAudioLevel * 0.2);
        translateY = -4;
      }
    }

    return (
      <div key={user.id} className={cn(
        "flex items-end gap-1 group relative transition-all duration-200",
        isMainSinger && isExtraLoud && "z-30",
        isMainSinger && !isExtraLoud && "z-20",
        !isMainSinger && "z-10",
        isCheerleader && "animate-bounce"
      )}
      style={{
        transform: `scale(${dynamicScale}) translateY(${translateY}px)`,
      }}
      >
        {/* Spotlight effect only for EXTRA LOUD singing (Level 2) */}
        <SingerSpotlight isMainSinger={isMainSinger && isExtraLoud} audioLevel={userAudioLevel} />
        
        {/* Music notes floating effect for normal loud singing (Level 1+) */}
        <MusicNotesEffect isActive={isMainSinger && user.isSpeaking && isNormalLoud} audioLevel={userAudioLevel} />

        {/* Vote kick button */}
        {onStartVoteKick && users.length >= 2 && (
          <div className="absolute -top-1 -right-1 z-10">
            <VoteKickButton
              user={user}
              currentUserId={currentUserId || ''}
              onStartVote={onStartVoteKick}
              disabled={voteKickDisabled}
            />
          </div>
        )}

        {/* Light stick on left side - synced to BPM */}
        {isWaving && (
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
          (isWaving || isCheerleader) && 'animate-bounce-subtle'
        )}>
          <Popover>
            <PopoverTrigger asChild>
              <button className="outline-none focus:ring-2 focus:ring-primary rounded-full transition-transform active:scale-95">
                <UserAvatar
                  user={user}
                  size="lg"
                  showName
                  isMainSinger={isMainSinger}
                  audioLevel={userAudioLevel}
                  isExtraLoud={isExtraLoud}
                />
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
                    {Math.round((userVolumes[user.id] ?? 100))}%
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                  <Slider
                    value={[userVolumes[user.id] ?? 100]}
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
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-xl">
      {roomMode === 'team-battle' ? (
        <div className="flex flex-col gap-8">
          <div className="flex items-stretch justify-between gap-0 min-h-[200px]">
            {/* Left Team */}
            <div className="flex-1 flex flex-col gap-6 pr-8 border-r border-blue-500/20">
              <div className="flex items-center justify-between h-12">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Team Blue</span>
                <div className="flex flex-col items-end">
                  <span className="text-3xl font-black text-blue-500 leading-none">
                    {leftTeam.reduce((acc, u) => acc + (u.score || 0), 0)}
                  </span>
                  <span className="text-[10px] text-blue-400/40 uppercase font-black tracking-tighter">Points</span>
                </div>
              </div>
              
              <div className="flex-1 flex items-start justify-start gap-4 flex-wrap">
                {leftTeam.length > 0 ? (
                  leftTeam.map(renderUser)
                ) : (
                  <div className="w-full h-32 flex items-center justify-center border-2 border-dashed border-blue-500/10 rounded-2xl bg-blue-500/5 self-start">
                    <p className="text-[10px] text-blue-500/30 uppercase font-bold tracking-widest">Awaiting Blue Fleet</p>
                  </div>
                )}
              </div>
            </div>

            {/* VS Divider Container */}
            <div className="flex flex-col items-center justify-center px-4 relative">
              <div className="w-20 h-20 rounded-full bg-background/60 backdrop-blur-xl flex items-center justify-center border-2 border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)] relative group cursor-default transition-transform hover:scale-110 z-10">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping [animation-duration:3s]" />
                <span className="text-2xl font-black italic tracking-tighter text-primary z-10">VS</span>
              </div>
            </div>

            {/* Right Team */}
            <div className="flex-1 flex flex-col gap-6 pl-8 border-l border-red-500/20 text-right">
              <div className="flex items-center justify-between h-12">
                <div className="flex flex-col items-start text-left">
                  <span className="text-3xl font-black text-red-500 leading-none">
                    {rightTeam.reduce((acc, u) => acc + (u.score || 0), 0)}
                  </span>
                  <span className="text-[10px] text-red-400/40 uppercase font-black tracking-tighter">Points</span>
                </div>
                <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Team Red</span>
              </div>
              
              <div className="flex-1 flex items-start justify-end gap-4 flex-wrap">
                {rightTeam.length > 0 ? (
                  rightTeam.map(renderUser)
                ) : (
                  <div className="w-full h-32 flex items-center justify-center border-2 border-dashed border-red-500/10 rounded-2xl bg-red-500/5 self-start">
                    <p className="text-[10px] text-red-500/30 uppercase font-bold tracking-widest">Awaiting Red Legion</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {unassigned.length > 0 && (
            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] text-center text-muted-foreground uppercase tracking-[0.3em] font-bold mb-4 opacity-50">Bench / Unassigned</p>
              <div className="flex items-end justify-center gap-6 flex-wrap">
                {unassigned.map(renderUser)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <h3 className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-4">Singers</h3>
          <div className="flex items-end justify-center gap-8 flex-wrap">
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
