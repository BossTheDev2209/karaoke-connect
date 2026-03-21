import React from 'react';
import { SingReactOverlay } from '@/components/effects/SingReactOverlay';
import { LyricsDisplay } from '@/components/LyricsDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LyricLine } from '@/types/karaoke';

interface ReadyCheckUser {
  id: string;
  nickname: string;
  isReady: boolean;
}

interface Recommendation {
  id: string;
  thumbnail: string;
  title: string;
  artist: string;
  videoId: string;
}

interface PlayerError {
  isAgeRestricted?: boolean;
  message?: string;
  videoId?: string;
}

export interface RoomStageProps {
  // SingReact overlay
  showSingReactOverlay: boolean;
  singReactOverlayProps: {
    isPlaying: boolean;
    userId: string;
    channel: any;
    className: string;
  };
  // Countdown
  showCountdown: boolean;
  remainingSeconds: number | null;
  // Ready check
  showReadyCheck: boolean;
  readyCheckUsers: ReadyCheckUser[];
  isHost: boolean;
  onForceStart: () => void;
  // No song placeholder
  showNoSong: boolean;
  // Recommendations
  showRecommendations: boolean;
  recommendations: Recommendation[];
  onAddRecommendation: (rec: Recommendation) => void;
  onDismissRecommendations: () => void;
  // Player error
  showPlayerError: boolean;
  playerError: PlayerError | null;
  onClearErrorAndSkip: () => void;
  hasMoreSongs: boolean;
  // Playback phase
  isPlaying: boolean;
  isPaused: boolean;
  // Lyrics
  showLyrics: boolean;
  lyricsDisplayProps: React.ComponentProps<typeof LyricsDisplay>;
}

export const RoomStage: React.FC<RoomStageProps> = ({
  showSingReactOverlay,
  singReactOverlayProps,
  showCountdown,
  remainingSeconds,
  showReadyCheck,
  readyCheckUsers,
  isHost,
  onForceStart,
  showNoSong,
  showRecommendations,
  recommendations,
  onAddRecommendation,
  onDismissRecommendations,
  showPlayerError,
  playerError,
  onClearErrorAndSkip,
  hasMoreSongs,
  showLyrics,
  lyricsDisplayProps,
}) => {
  return (
    <div className="lg:col-span-6 flex flex-col gap-3 min-h-0 order-1 lg:order-2">
      <div className="card-karaoke relative flex-1 min-h-0">
        <div id="youtube-player" className="w-full h-full rounded-lg overflow-hidden" />

        {/* Sing React overlay with light sticks */}
        {showSingReactOverlay && (
          <SingReactOverlay {...singReactOverlayProps} />
        )}

        {showCountdown && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-2xl bg-card/70 backdrop-blur border border-border shadow-lg px-6 py-4">
              <div className="text-6xl font-black text-primary tabular-nums text-center">
                {remainingSeconds}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground text-center">
                seconds
              </div>
            </div>
          </div>
        )}

        {/* Ready Check Overlay (SyncV2) */}
        {showReadyCheck && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-20">
            <div className="text-center space-y-4 p-6">
              <div className="animate-pulse">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Play className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="text-xl font-semibold">Waiting for players...</div>
              <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                {readyCheckUsers.map(u => (
                  <div 
                    key={u.id}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm flex items-center gap-2",
                      u.isReady
                        ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    {u.isReady && <span className="text-green-400">✓</span>}
                    {u.nickname}
                  </div>
                ))}
              </div>
              {isHost && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={onForceStart}
                  className="mt-2"
                >
                  Start Now
                </Button>
              )}
            </div>
          </div>
        )}

        {showNoSong && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-lg">
            <p className="text-muted-foreground">Add songs to start!</p>
          </div>
        )}

        {/* Recommendations Overlay (Up Next) */}
        {showRecommendations && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20 p-6 animate-in fade-in duration-300">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Up Next</h3>
              <p className="text-white/60 text-sm">Based on your last song</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
              {recommendations.map((rec) => (
                <button 
                  key={rec.id}
                  type="button"
                  className="group relative aspect-video bg-black/50 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all text-left"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Recommendations] Adding song to queue:', rec.title, rec.videoId);
                    onAddRecommendation(rec);
                  }}
                >
                  <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/90 to-transparent">
                    <p className="text-white font-medium text-sm line-clamp-2 leading-tight">{rec.title}</p>
                    <p className="text-white/60 text-xs mt-1 truncate">{rec.artist}</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary/90 text-primary-foreground rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-6 h-6 fill-current" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <Button 
              variant="ghost" 
              className="mt-8 text-white/50 hover:text-white"
              onClick={onDismissRecommendations}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Player Error Overlay (Age-restricted, etc.) */}
        {showPlayerError && playerError && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/95 rounded-lg backdrop-blur-sm z-10">
            <div className="text-center p-6 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {playerError.isAgeRestricted ? 'Age-Restricted Video' : 'Video Unavailable'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {playerError.message}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href={`https://www.youtube.com/watch?v=${playerError.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  Watch on YouTube
                </a>
                {hasMoreSongs && (
                  <button
                    onClick={onClearErrorAndSkip}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    Skip to Next
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {playerError.isAgeRestricted 
                  ? 'Age-restricted videos can only be watched directly on YouTube'
                  : 'This video cannot be played in an embedded player'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Lyrics Display */}
      {showLyrics && (
        <div className="card-karaoke h-[140px] shrink-0">
          <LyricsDisplay {...lyricsDisplayProps} />
        </div>
      )}
    </div>
  );
};
