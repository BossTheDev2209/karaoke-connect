import React, { useRef, useEffect, useState } from 'react';
import { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { Languages, List, Minus, Music, Plus, Subtitles } from 'lucide-react';
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
  const activeLine = lyrics[currentLineIndex];
  const nextLine = lyrics[currentLineIndex + 1];
  const nextLineStartsInSec = nextLine ? nextLine.time - currentTime : null;

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
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
        {providerLabel && (
          <span className="mr-auto rounded-full border border-border/60 bg-background/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            via {providerLabel}
          </span>
        )}

        {onOffsetChange && (
          <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-background/30 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => adjustOffset(-0.1)}
              className="h-7 w-7 rounded-full"
              aria-label="Decrease lyric offset"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-12 text-center font-mono text-[11px] text-muted-foreground">
              {offset.toFixed(1)}s
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => adjustOffset(0.1)}
              className="h-7 w-7 rounded-full"
              aria-label="Increase lyric offset"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {hasCaptionsAvailable && onEnableCaptions && onDisableCaptions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={areCaptionsEnabled ? onDisableCaptions : onEnableCaptions}
            className={cn(
              'h-8 rounded-full px-2.5 text-xs',
              areCaptionsEnabled && 'bg-primary/10 text-primary'
            )}
            title={areCaptionsEnabled ? 'Disable YouTube captions' : 'Enable YouTube captions'}
          >
            <Subtitles className="mr-1 h-3.5 w-3.5" />
            CC
          </Button>
        )}

        {/* Romanization toggle for CJK lyrics */}
        {hasCJK && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRomanization(!showRomanization)}
            className={cn(
              'h-8 rounded-full px-2.5 text-xs',
              showRomanization ? 'bg-primary/10 text-primary' : 'bg-background/30'
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
                className="h-8 rounded-full bg-background/30 px-2.5 text-xs"
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
            className="group flex h-8 cursor-pointer select-none items-center gap-2 rounded-full border border-border/60 bg-background/30 px-1.5 pr-2 text-[11px] text-foreground/85 transition-colors hover:bg-background/50"
            title="When on, clicking a lyric line seeks the video to that time"
          >
            <input
              type="checkbox"
              checked={seekOnClick}
              onChange={(e) => setSeekOnClick(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-5 w-9 rounded-full bg-input transition-colors duration-200 after:absolute after:left-0.5 after:top-1/2 after:h-4 after:w-4 after:-translate-y-1/2 after:rounded-full after:bg-foreground after:transition-transform after:duration-200 peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
            />
            <span>Seek</span>
          </label>
        )}
      </div>


      {hasPlainLyrics ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 px-4 text-center">
          <Music className="w-6 h-6 opacity-50" />
          <p className="text-sm">Sync not available for this song</p>
          <p className="text-[11px] opacity-70">Open Full Lyrics to read the text</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="scrollbar-hide flex-1 overflow-y-auto px-2 py-4"
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
                  onClick={() => {
                    setSelectedLineIndex(isSelected ? null : index);
                    if (seekOnClick && onSeek && Number.isFinite(line.time)) {
                      onSeek(Math.max(0, line.time));
                    }
                  }}
                  className={cn(
                    'lyric-line cursor-pointer rounded-lg px-2 py-0.5 transition-[background-color,color,opacity,transform] duration-200',
                    isActive && 'active',
                    isPast && 'past',
                    isSelected && 'ring-2 ring-primary bg-primary/10'
                  )}
                >
                  <div>
                    {isActive && activeLine?.words?.length ? (
                      <span>
                        {activeLine.words.map((word, wordIndex) => (
                          <span
                            key={wordIndex}
                            className={word.time <= currentTime ? 'text-primary' : 'text-muted-foreground'}
                          >
                            {word.text}{wordIndex < activeLine.words!.length - 1 ? ' ' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span>{line.text}</span>
                    )}
                  </div>
                  {isActive && isSynced && nextLineStartsInSec !== null && nextLineStartsInSec <= 3 && nextLineStartsInSec > 0 && (
                    <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
                      {[3, 2, 1].map((n) => (
                        <span key={n} className={`h-1.5 w-1.5 rounded-full ${nextLineStartsInSec <= n ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      ))}
                    </div>
                  )}
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
