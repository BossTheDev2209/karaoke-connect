import React from 'react';
import { 
  Play, 
  Pause, 
  SkipForward,
  SkipBack,
  Volume2, 
  VolumeX,
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
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSync: () => void;
  className?: string;
  showVolume?: boolean;
  /** No song to control (empty queue): dim + disable transport, freeze the scrubber. */
  disabled?: boolean;
  /** Tighter layout for the horizontal desktop ribbon (remote stays roomy). */
  compact?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  canGoPrevious,
  canGoNext,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSync,
  className,
  showVolume = true,
  disabled = false,
  compact = false,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const shownTime = disabled ? 0 : currentTime;

  return (
    <div className={cn(compact ? 'space-y-1.5' : 'space-y-3', className)}>
      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        <Slider
          value={[shownTime]}
          max={duration || 100}
          step={1}
          onValueChange={([value]) => onSeek(value)}
          disabled={disabled}
          className="cursor-pointer"
        />
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>{formatTime(shownTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* left: secondary action */}
        <div className="flex items-center justify-start">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSync}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            title="Sync with room"
            aria-label="Sync with room"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* center: primary transport, always optically centered */}
        <div className={cn('flex items-center justify-center', compact ? 'gap-1.5' : 'gap-2 sm:gap-3')}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className={cn('rounded-full', compact ? 'h-9 w-9' : 'h-11 w-11')}
            aria-label="Previous song"
          >
            <SkipBack className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </Button>

          <Button
            onClick={onPlayPause}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center rounded-full p-0 shadow-lg shadow-primary/30 transition-transform duration-150 ease-out hover:scale-105 active:scale-90 motion-reduce:transition-none motion-reduce:hover:scale-100',
              compact ? 'h-11 w-11' : 'h-14 w-14',
            )}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
            ) : (
              <Play className={cn('ml-0.5', compact ? 'h-5 w-5' : 'h-6 w-6')} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!canGoNext}
            className={cn('rounded-full', compact ? 'h-9 w-9' : 'h-11 w-11')}
            aria-label="Next song"
          >
            <SkipForward className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </Button>
        </div>

        {/* right: volume */}
        <div className="flex items-center justify-end gap-2">
          {showVolume && (
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMuteToggle}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(value)}
                className={compact ? 'w-16' : 'w-20'}
                aria-label="Volume"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
