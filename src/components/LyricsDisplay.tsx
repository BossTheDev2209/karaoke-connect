import React, { useRef, useEffect, useState, useMemo } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
}

type DisplayMode = 'scroll' | 'focus';

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentLineIndex,
  currentTime,
  isLoading,
  error,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('focus');

  // Calculate progress through the current line (0 to 1)
  const lineProgress = useMemo(() => {
    if (currentLineIndex < 0 || currentLineIndex >= lyrics.length) return 0;
    
    const currentLine = lyrics[currentLineIndex];
    const nextLine = lyrics[currentLineIndex + 1];
    
    const lineStartTime = currentLine.time;
    const lineEndTime = nextLine ? nextLine.time : lineStartTime + 5; // Assume 5s if last line
    const lineDuration = lineEndTime - lineStartTime;
    
    if (lineDuration <= 0) return 0;
    
    const elapsed = currentTime - lineStartTime;
    return Math.max(0, Math.min(1, elapsed / lineDuration));
  }, [currentTime, currentLineIndex, lyrics]);

  useEffect(() => {
    if (displayMode === 'scroll' && activeLineRef.current && containerRef.current) {
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
  }, [currentLineIndex, displayMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <Music className="w-5 h-5" />
          <span>Loading lyrics...</span>
        </div>
      </div>
    );
  }

  if (error || lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Music className="w-12 h-12 mb-4 opacity-50" />
        <p>{error || 'No lyrics available'}</p>
        <p className="text-sm mt-2">Sing along from memory!</p>
      </div>
    );
  }

  // Focus mode - shows current, previous, and next lines
  if (displayMode === 'focus') {
    const prevLine = lyrics[currentLineIndex - 1];
    const currentLine = lyrics[currentLineIndex];
    const nextLine = lyrics[currentLineIndex + 1];

    return (
      <div className="h-full flex flex-col relative">
        {/* Mode toggle */}
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDisplayMode('scroll')}
            className="text-xs text-muted-foreground"
          >
            Show All
          </Button>
        </div>

        {/* Focused lyrics */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-6 overflow-hidden">
          {/* Previous line */}
          <div 
            key={`prev-${currentLineIndex}`}
            className="text-muted-foreground/40 text-lg animate-slide-up opacity-50"
          >
            {prevLine?.text || ''}
          </div>

          {/* Current line - sentence highlighting */}
          <div 
            key={`current-${currentLineIndex}`}
            className="animate-lyric-enter"
          >
            <p className="text-2xl md:text-3xl font-bold leading-relaxed text-primary">
              {currentLine?.text || '♫ ♫ ♫'}
            </p>
          </div>

          {/* Next line */}
          <div 
            key={`next-${currentLineIndex}`}
            className="text-muted-foreground/60 text-lg animate-slide-up-delayed opacity-60"
          >
            {nextLine?.text || ''}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
            <span>{currentLineIndex + 1}</span>
            <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-purple to-neon-pink transition-all duration-300"
                style={{ width: `${((currentLineIndex + 1) / lyrics.length) * 100}%` }}
              />
            </div>
            <span>{lyrics.length}</span>
          </div>
        </div>
      </div>
    );
  }

  // Scroll mode - shows all lyrics with word highlighting on active line
  return (
    <div className="h-full flex flex-col relative">
      {/* Mode toggle */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDisplayMode('focus')}
          className="text-xs text-muted-foreground"
        >
          Focus Mode
        </Button>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-8"
      >
        <div className="space-y-1 text-center">
          {lyrics.map((line, index) => (
            <div
              key={index}
              ref={index === currentLineIndex ? activeLineRef : null}
              className={cn(
                'lyric-line',
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
