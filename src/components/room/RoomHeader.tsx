import React from 'react';
import { RoomCodeDisplay } from '@/components/RoomCodeDisplay';
import { RoomMenu } from '@/components/RoomMenu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LogOut, Swords, Mic2, Settings2, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { RoomMode } from '@/types/karaoke';
import { SyncStatus } from '@/hooks/useRoom';

export interface RoomHeaderProps {
  code: string;
  isHost: boolean;
  isConnected: boolean;
  userCount: number;
  networkLatency: number;
  isMicEnabled: boolean;
  webrtcStats: { connectedPeers: number; connectionQuality: string; avgLatency: number };
  roomMode: RoomMode;
  syncStatus: SyncStatus;
  onShowHostControlPanel: () => void;
  onLeave: () => void;
  roomMenuProps: React.ComponentProps<typeof RoomMenu>;
}

const SyncStatusChip: React.FC<{ status: SyncStatus; isConnected: boolean }> = ({ status, isConnected }) => {
  if (!isConnected) {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-destructive/20 text-destructive border-destructive/30 animate-pulse gap-1">
        <AlertCircle className="w-3 h-3" />
        Disconnected
      </Badge>
    );
  }
  switch (status) {
    case 'syncing':
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border-primary/30 animate-pulse gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Syncing…
        </Badge>
      );
    case 'reconnecting':
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Reconnecting…
        </Badge>
      );
    case 'host-changed':
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
          <RefreshCw className="w-3 h-3" />
          Host Changed
        </Badge>
      );
    case 'synced':
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-neon-green/10 text-neon-green border-neon-green/30 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Synced
        </Badge>
      );
    default:
      return null;
  }
};

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  code,
  isHost,
  isConnected,
  userCount,
  networkLatency,
  isMicEnabled,
  webrtcStats,
  roomMode,
  syncStatus,
  onShowHostControlPanel,
  onLeave,
  roomMenuProps,
}) => {
  return (
    <header className={cn(
      "flex flex-wrap gap-2 items-center justify-between rounded-xl px-4 py-2 transition-all",
      isHost 
        ? "bg-gradient-to-r from-amber-950/40 via-background to-background border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]" 
        : "bg-gradient-to-r from-primary/10 via-background to-background border border-border/50 shadow-sm"
    )}>
      <div className="flex items-center gap-2">
        <RoomCodeDisplay code={code} />
        <SyncStatusChip status={syncStatus} isConnected={isConnected} />
      </div>
      <div className="flex items-center gap-2">
        {/* Connection indicator */}
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neon-green' : 'bg-destructive'}`} />
        <span className="text-sm text-muted-foreground">
          {userCount} online
          {networkLatency > 0 && ` · ${networkLatency}ms`}
          {isMicEnabled && webrtcStats.connectedPeers > 0 && (
            <span className={cn(
              "ml-1",
              webrtcStats.connectionQuality === 'excellent' && "text-green-400",
              webrtcStats.connectionQuality === 'good' && "text-green-500",
              webrtcStats.connectionQuality === 'fair' && "text-yellow-500",
              webrtcStats.connectionQuality === 'poor' && "text-red-500",
            )}>
              · 🎤{webrtcStats.avgLatency > 0 ? `${webrtcStats.avgLatency}ms` : '⚡'}
            </span>
          )}
        </span>
        
        {/* Host Badge */}
        {isHost && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/50 text-amber-400">
            👑 Host
          </div>
        )}
        
        {/* Mode Badge */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all",
          roomMode === 'team-battle' 
            ? "bg-primary/20 border-primary text-primary animate-pulse" 
            : "bg-muted/50 border-border text-muted-foreground"
        )}>
          {roomMode === 'team-battle' ? <Swords className="w-3 h-3" /> : <Mic2 className="w-3 h-3" />}
          {roomMode === 'team-battle' ? 'Team Battle' : 'Free Sing'}
        </div>

        {/* Host Control Panel Button (Host only) */}
        {isHost && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowHostControlPanel}
            className="gap-2 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-400"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Host Controls</span>
          </Button>
        )}

        <RoomMenu {...roomMenuProps} />

        <Button variant="ghost" size="icon" onClick={onLeave}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
