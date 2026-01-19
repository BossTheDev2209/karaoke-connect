import React, { useState, useEffect } from 'react';
import { LyricsMatch } from '@/hooks/useLyrics';
import { cn } from '@/lib/utils';
import { Music2, Check, Subtitles, Clock, Sparkles } from 'lucide-react';

interface LyricsSelectorProps {
  matches: LyricsMatch[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
  onSkip: () => void;
  songTitle: string;
  autoConfirmSeconds?: number;
}

// Get display name for source
const getSourceLabel = (source: string): string => {
  switch (source.toLowerCase()) {
    case 'lrclib': return 'LRCLIB';
    case 'lyrics.ovh': return 'Lyrics.ovh';
    case 'genius': return 'Genius';
    case 'siamzone': return 'Siamzone';
    case 'kapook': return 'Kapook';
    default: return source;
  }
};

// Get source badge color
const getSourceColor = (source: string): string => {
  switch (source.toLowerCase()) {
    case 'lrclib': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'lyrics.ovh': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'genius': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'siamzone': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    case 'kapook': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export const LyricsSelector: React.FC<LyricsSelectorProps> = ({
  matches,
  selectedIndex,
  onSelect,
  onConfirm,
  onSkip,
  songTitle,
  autoConfirmSeconds = 10,
}) => {
  const [countdown, setCountdown] = useState(autoConfirmSeconds);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-confirm countdown
  useEffect(() => {
    if (isPaused || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, countdown, onConfirm]);

  // Pause countdown on interaction
  const handleInteraction = () => {
    setIsPaused(true);
  };

  if (matches.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleInteraction}
    >
      <div className="w-full max-w-lg mx-4 bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">Choose Lyrics</h3>
              <p className="text-xs text-white/60 truncate">{songTitle}</p>
            </div>
            {!isPaused && (
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Clock className="w-3.5 h-3.5" />
                <span>{countdown}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Matches List */}
        <div className="p-3 max-h-[50vh] overflow-y-auto space-y-2">
          {matches.map((match, index) => (
            <button
              key={`${match.source}-${index}`}
              className={cn(
                "w-full p-3 rounded-xl border text-left transition-all duration-200",
                selectedIndex === index
                  ? "bg-primary/20 border-primary/50 ring-2 ring-primary/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
              )}
              onClick={() => onSelect(index)}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div className={cn(
                  "flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors",
                  selectedIndex === index
                    ? "bg-primary border-primary"
                    : "border-white/30"
                )}>
                  {selectedIndex === index && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>

                {/* Match info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white truncate">
                      {match.trackName || 'Unknown Title'}
                    </span>
                    {index === 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-300 rounded border border-amber-500/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        Best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-white/60 truncate">
                      {match.artistName || 'Unknown Artist'}
                    </span>
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border",
                      getSourceColor(match.source)
                    )}>
                      {getSourceLabel(match.source)}
                    </span>
                    {match.syncedLyrics && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                        <Clock className="w-2.5 h-2.5" />
                        Synced
                      </span>
                    )}
                  </div>
                </div>

                {/* Score indicator */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-white/40">
                    {Math.round(match.score * 100)}%
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* No lyrics option */}
          <button
            className={cn(
              "w-full p-3 rounded-xl border text-left transition-all duration-200",
              selectedIndex === -1
                ? "bg-primary/20 border-primary/50 ring-2 ring-primary/30"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
            )}
            onClick={() => {
              onSelect(-1);
              onSkip();
            }}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                selectedIndex === -1
                  ? "bg-primary border-primary"
                  : "border-white/30"
              )}>
                {selectedIndex === -1 && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-white/60" />
                <span className="text-white/60">No lyrics (use YouTube CC)</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/30 flex gap-3">
          <button
            className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg font-medium transition-colors"
            onClick={onSkip}
          >
            Skip
          </button>
          <button
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors shadow-lg shadow-primary/20"
            onClick={onConfirm}
          >
            Use Selected
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricsSelector;
