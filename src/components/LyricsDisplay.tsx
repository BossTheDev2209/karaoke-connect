import React, { useRef, useEffect } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Music } from 'lucide-react';

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentLineIndex,
  isLoading,
  error,
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
        <Music className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">{error || 'No lyrics available'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
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
