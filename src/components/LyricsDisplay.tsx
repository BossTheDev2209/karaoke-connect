import React, { useRef, useEffect, useState } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Music, Minus, Plus, Subtitles, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

// Simulate loading progress
const useLoadingProgress = (isLoading: boolean) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const intervals = [
      { delay: 100, value: 15 },
      { delay: 300, value: 35 },
      { delay: 600, value: 55 },
      { delay: 1000, value: 70 },
      { delay: 1500, value: 82 },
      { delay: 2500, value: 90 },
      { delay: 4000, value: 95 },
    ];

    const timeouts = intervals.map(({ delay, value }) =>
      setTimeout(() => setProgress(value), delay)
    );

    return () => timeouts.forEach(clearTimeout);
  }, [isLoading]);

  return progress;
};

// Check if lyrics are plain (no real timestamps)
const isPlainLyrics = (lyrics: LyricLine[]): boolean => {
  if (lyrics.length <= 1) return true;
  // Plain lyrics have minimal time differences (set in useLyrics)
  const timeDiffs = lyrics.slice(1).map((l, i) => l.time - lyrics[i].time);
  return timeDiffs.every(diff => diff < 0.1);
};

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
  const loadingProgress = useLoadingProgress(isLoading);
  const hasPlainLyrics = isPlainLyrics(lyrics);

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
            <div 
              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }} 
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Loading lyrics... {loadingProgress}%
        </span>
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
      {/* Controls bar */}
      <div className="absolute top-1 right-1 z-10 flex items-center gap-2">
        {/* Full lyrics button - always show when lyrics exist */}
        {lyrics.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs bg-background/80 backdrop-blur rounded-lg"
                title="View full lyrics"
              >
                <List className="w-3 h-3 mr-1" />
                Full Lyrics
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Full Lyrics</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {lyrics.map((line, index) => (
                  <p key={index} className="text-sm leading-relaxed">
                    {line.text}
                  </p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Offset controls - only show if synced lyrics exist */}
        {!hasPlainLyrics && lyrics.length > 1 && onOffsetChange && (
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg px-1.5 py-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => adjustOffset(-0.01)}
              title="Fine tune: -0.01s"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span 
              className="text-[10px] font-mono min-w-[50px] text-center text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => onOffsetChange(0)}
              title="Click to reset"
            >
              {offset >= 0 ? '+' : ''}{offset.toFixed(2)}s
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => adjustOffset(0.01)}
              title="Fine tune: +0.01s"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Plain lyrics indicator */}
      {hasPlainLyrics && (
        <div className="absolute top-1 left-1 z-10">
          <span className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur rounded px-1.5 py-0.5">
            No sync available
          </span>
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
                !hasPlainLyrics && index === currentLineIndex && 'active',
                !hasPlainLyrics && index < currentLineIndex && 'past'
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
