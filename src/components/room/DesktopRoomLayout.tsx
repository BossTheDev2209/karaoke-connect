import React from 'react';
import { CelebrationOverlay } from '@/components/effects/CelebrationOverlay';
import { DustFallEffect } from '@/components/effects/SingerEffects';
import { HostControlPanel } from '@/components/HostControlPanel';
import { SongSearch } from '@/components/SongSearch';
import { SongQueue } from '@/components/SongQueue';
import { UserAvatarRow } from '@/components/UserAvatarRow';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types/karaoke';

import { RoomHeader, RoomHeaderProps } from './RoomHeader';
import { RoomStage, RoomStageProps } from './RoomStage';
import { RoomControlsPanel, RoomControlsPanelProps } from './RoomControlsPanel';
import { RoomOverlays, RoomOverlaysProps } from './RoomOverlays';

export interface QueuePanelProps {
  isHost: boolean;
  queue: Song[];
  currentSongIndex: number;
  canControl: boolean;
  onAddSong: (song: Song) => void;
  onRemoveSong: (songId: string) => void;
  onSelectSong: (index: number) => void;
  userId: string;
  getStatusForSong: (songId: string) => any;
}

export interface LayoutFlags {
  isHost: boolean;
  celebrationEnabled: boolean;
  isExtraLoudSinging: boolean;
  isPlaying: boolean;
  maxUserAudioLevel: number;
}

export interface DesktopRoomLayoutProps {
  headerProps: RoomHeaderProps;
  stageProps: RoomStageProps;
  controlsProps: RoomControlsPanelProps;
  overlaysProps: RoomOverlaysProps;
  queuePanelProps: QueuePanelProps;
  avatarRowProps: React.ComponentProps<typeof UserAvatarRow>;
  layoutFlags: LayoutFlags;
  celebration: any;
  hostControlPanelProps: React.ComponentProps<typeof HostControlPanel>;
}

export const DesktopRoomLayout: React.FC<DesktopRoomLayoutProps> = ({
  headerProps,
  stageProps,
  controlsProps,
  overlaysProps,
  queuePanelProps,
  avatarRowProps,
  layoutFlags,
  celebration,
  hostControlPanelProps,
}) => {
  return (
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      {/* Celebration effects */}
      {layoutFlags.celebrationEnabled && <CelebrationOverlay theme={celebration} />}
      
      {/* Host Control Panel */}
      <HostControlPanel {...hostControlPanelProps} />

      {/* Dust fall effect when singing EXTRA loudly (Level 2) */}
      <DustFallEffect isActive={layoutFlags.isExtraLoudSinging && layoutFlags.isPlaying} intensity={layoutFlags.maxUserAudioLevel} />

      <RoomHeader {...headerProps} />

      {/* Main content - Video takes priority */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Queue panel */}
        <div className={cn(
          "lg:col-span-3 card-karaoke overflow-hidden flex flex-col order-3 lg:order-1",
          queuePanelProps.isHost && "border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-transparent"
        )}>
          <div className="flex items-center gap-2 mb-3">
            {queuePanelProps.isHost ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-amber-400">Your Queue</h3>
              </>
            ) : (
              <h3 className="font-semibold text-muted-foreground">Room Queue</h3>
            )}
          </div>
          <div className={cn("mb-3", !queuePanelProps.isHost && "opacity-70")}>
            <SongSearch onAddSong={queuePanelProps.onAddSong} userId={queuePanelProps.userId} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SongQueue 
              queue={queuePanelProps.queue} 
              currentIndex={queuePanelProps.currentSongIndex} 
              onRemove={queuePanelProps.canControl ? queuePanelProps.onRemoveSong : undefined} 
              onSelect={queuePanelProps.canControl ? queuePanelProps.onSelectSong : undefined}
              getLyricStatus={queuePanelProps.getStatusForSong}
            />
          </div>
        </div>

        <RoomStage {...stageProps} />
        <RoomControlsPanel {...controlsProps} />
      </div>

      {/* User avatars */}
      <div className="shrink-0 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        <UserAvatarRow {...avatarRowProps} />
      </div>
      
      <RoomOverlays {...overlaysProps} />
    </div>
  );
};
