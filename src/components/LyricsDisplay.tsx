import React, { useRef, useEffect } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Music, Minus, Plus, Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
  offset?: number;
  onOffsetChange?: (offset: number) => void;
  areCaptionsEnabled?: boolean;
  hasCaptionsAvailable?: boolean;
  onEnableCaptions?: () => void;
  onDisableCaptions?: () => void;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentLineIndex,
  isLoading,
  error,
  offset = 0,
  onOffsetChange,
  areCaptionsEnabled = false,
  hasCaptionsAvailable = false,
  onEnableCaptions,
  onDisableCaptions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      
      container.scrollTo({
        top: lineTop - containerHeight / 2 + lineHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex]);

  const adjustOffset = (delta: number) => {
    if (onOffsetChange) {
      onOffsetChange(offset + delta);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full animate-shimmer" 
                 style={{ backgroundSize: '200% 100%', width: '100%' }} />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Loading lyrics...</span>
      </div>
    );
  }

  if (error || lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Music className="w-6 h-6 opacity-50" />
        <p className="text-sm">{error || 'No lyrics available'}</p>
        {hasCaptionsAvailable && onEnableCaptions && (
          <Button
            variant="outline"
            size="sm"
            onClick={areCaptionsEnabled ? onDisableCaptions : onEnableCaptions}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              areCaptionsEnabled && "bg-primary text-primary-foreground"
            )}
          >
            <Subtitles className="w-3.5 h-3.5" />
            {areCaptionsEnabled ? 'CC On' : 'Show YouTube CC'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Offset controls - only show if synced lyrics exist */}
      {lyrics.length > 1 && onOffsetChange && (
        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg px-1.5 py-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => adjustOffset(-0.5)}
            title="Lyrics too slow (speed up)"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-[10px] font-mono min-w-[40px] text-center text-muted-foreground">
            {offset > 0 ? '+' : ''}{offset.toFixed(1)}s
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => adjustOffset(0.5)}
            title="Lyrics too fast (slow down)"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4"
      >
        <div className="space-y-1 text-center">
          {lyrics.map((line, index) => (
            <div
              key={index}
              ref={index === currentLineIndex ? activeLineRef : null}
              className={cn(
                'lyric-line transition-all duration-300',
                index === currentLineIndex && 'active',
                index < currentLineIndex && 'past'
              )}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
