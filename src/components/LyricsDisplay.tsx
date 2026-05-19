import React, { useRef, useEffect, useState } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Music, Subtitles, List, Languages, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { romanize, containsCJK, detectCJKLanguage } from '@/lib/romanization';

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
  isSynced?: boolean;
  source?: string | null;
  offset?: number;
  onOffsetChange?: (offset: number) => void;
  onSeek?: (time: number) => void;
  areCaptionsEnabled?: boolean;
  hasCaptionsAvailable?: boolean;
  onEnableCaptions?: () => void;
  onDisableCaptions?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  lrclib: 'LRCLIB',
  genius: 'Genius',
};

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


// Check if lyrics contain CJK characters
const hasCJKLyrics = (lyrics: LyricLine[]): boolean => {
  return lyrics.some(line => containsCJK(line.text));
};




// Get language label
const getLanguageLabel = (lyrics: LyricLine[]): string | null => {
  for (const line of lyrics) {
    const lang = detectCJKLanguage(line.text);
    if (lang) {
      switch (lang) {
        case 'japanese': return 'Romaji';
        case 'korean': return 'Romanization';
        case 'chinese': return 'Pinyin';
      }
    }
  }
  return null;
};

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentLineIndex,
  currentTime,
  isLoading,
  error,
  isSynced = true,
  source = null,
  offset = 0,
  onOffsetChange,
  onSeek,
  areCaptionsEnabled = false,
  hasCaptionsAvailable = false,
  onEnableCaptions,
  onDisableCaptions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const loadingProgress = useLoadingProgress(isLoading);
  const hasPlainLyrics = !isSynced;
  const providerLabel = source ? (PROVIDER_LABELS[source] ?? source) : null;
  const [showRomanization, setShowRomanization] = useState(true);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [seekOnClick, setSeekOnClick] = useState(false);
  const [calculatedRomanizations, setCalculatedRomanizations] = useState<Record<string, string>>({});
  
  const hasCJK = hasCJKLyrics(lyrics);
  const languageLabel = getLanguageLabel(lyrics);

  // Reset selected line when the lyrics list changes (e.g. song change)
  useEffect(() => {
    setSelectedLineIndex(null);
  }, [lyrics]);

  // Pre-generate romanizations for all lines when lyrics change or romanization is enabled
  useEffect(() => {
    if (!hasCJK || !showRomanization || lyrics.length === 0) return;

    let isMounted = true;

    const generateAll = async () => {
      const newRomanizations: Record<string, string> = { ...calculatedRomanizations };
      let changed = false;

      for (const line of lyrics) {
        if (!isMounted) break;
        if (newRomanizations[line.text] === undefined && containsCJK(line.text)) {
          const result = await romanize(line.text);
          if (result) {
            newRomanizations[line.text] = result;
            changed = true;
          }
        }
      }

      if (isMounted && changed) {
        setCalculatedRomanizations(newRomanizations);
      }
    };

    generateAll();

    return () => {
      isMounted = false;
    };
  }, [lyrics, showRomanization, hasCJK, calculatedRomanizations]);

  // Sync getRomanization helper
  const getRomanizedText = (text: string): string | null => {
    return calculatedRomanizations[text] || null;
  };

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      
      container.scrollTo({
        top: lineTop - containerHeight / 2 + lineHeight / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
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
        {/* Romanization toggle for CJK lyrics */}
        {hasCJK && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRomanization(!showRomanization)}
            className={cn(
              "h-6 px-2 text-xs rounded-lg",
              showRomanization ? "bg-primary/20 text-primary" : "bg-background/80 backdrop-blur"
            )}
            title={`Show ${languageLabel || 'Romanization'}`}
          >
            <Languages className="w-3 h-3 mr-1" />
            {languageLabel || 'ABC'}
          </Button>
        )}

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
                <DialogTitle className="flex items-center justify-between">
                  <span>Full Lyrics</span>
                  {hasCJK && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRomanization(!showRomanization)}
                      className={cn(
                        "h-7 text-xs",
                        showRomanization && "bg-primary/20"
                      )}
                    >
                      <Languages className="w-3.5 h-3.5 mr-1" />
                      {showRomanization ? 'Hide' : 'Show'} {languageLabel}
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 space-y-3 scrollbar-karaoke">
                {lyrics.map((line, index) => {
                  const romanization = showRomanization ? getRomanizedText(line.text) : null;
                  return (
                    <div key={index} className="leading-relaxed">
                      <p className="text-sm">{line.text}</p>
                      {romanization && (
                        <p className="text-xs text-muted-foreground italic">{romanization}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Click-to-seek toggle - only show for synced lyrics */}
        {!hasPlainLyrics && lyrics.length > 1 && onSeek && (
          <label
            className="flex items-center gap-1 bg-background/80 backdrop-blur rounded-md px-1.5 h-5 text-[10px] cursor-pointer select-none"
            title="When on, clicking a lyric line seeks the video to that time"
          >
            <Crosshair className="w-2.5 h-2.5" />
            <span>Seek</span>
            <input
              type="checkbox"
              checked={seekOnClick}
              onChange={(e) => setSeekOnClick(e.target.checked)}
              className="ml-0.5 h-2.5 w-2.5 accent-primary cursor-pointer"
            />
          </label>
        )}
      </div>


      {/* Provider badge */}
      {providerLabel && (
        <div className="absolute top-1 left-1 z-10">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-background/80 backdrop-blur rounded px-1.5 py-0.5">
            via {providerLabel}
          </span>
        </div>
      )}

      {hasPlainLyrics ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 px-4 text-center">
          <Music className="w-6 h-6 opacity-50" />
          <p className="text-sm">Sync not available for this song</p>
          <p className="text-[11px] opacity-70">Open Full Lyrics to read the text</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4"
        >
          <div className="space-y-1 text-center">
            {lyrics.map((line, index) => {
              const romanization = showRomanization ? getRomanizedText(line.text) : null;
              const isActive = index === currentLineIndex;
              const isPast = index < currentLineIndex;
              const isSelected = index === selectedLineIndex;

              return (
                <div
                  key={index}
                  ref={index === currentLineIndex ? activeLineRef : null}
                  onClick={() => setSelectedLineIndex(isSelected ? null : index)}
                  className={cn(
                    'lyric-line transition-all duration-300 cursor-pointer rounded-md px-2 py-0.5',
                    isActive && 'active',
                    isPast && 'past',
                    isSelected && 'ring-2 ring-primary bg-primary/10'
                  )}
                >
                  <div>{line.text}</div>
                  {romanization && (
                    <div className={cn(
                      'text-xs mt-0.5 transition-all duration-300',
                      isActive ? 'text-primary/80' : 'text-muted-foreground/60 italic'
                    )}>
                      {romanization}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
