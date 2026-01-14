import React from 'react';
import { 
  Play, 
  Pause, 
  SkipForward,
  SkipBack,
  Volume2, 
  VolumeX,
  Mic,
  MicOff,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isMicEnabled: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onMicToggle: () => void;
  onSync: () => void;
  isHost?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  isMicEnabled,
  canGoPrevious,
  canGoNext,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onMicToggle,
  onSync,
  isHost = false
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={([value]) => onSeek(value)}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMicToggle}
          className={cn(
            'rounded-full transition-all',
            isMicEnabled && 'bg-neon-green/20 text-neon-green'
          )}
        >
          {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        {isHost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSync}
            className="rounded-full"
            title="Sync with room"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="rounded-full"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          onClick={onPlayPause}
          className="btn-neon w-12 h-12 rounded-full flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-full"
        >
          <SkipForward className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMuteToggle}
          className="rounded-full"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>

        <Slider
          value={[isMuted ? 0 : volume]}
          max={100}
          step={1}
          onValueChange={([value]) => onVolumeChange(value)}
          className="w-20"
        />
      </div>
    </div>
  );
};
