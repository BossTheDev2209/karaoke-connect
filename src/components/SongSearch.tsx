import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, X, Loader2, Music, User, ArrowLeft, Mic2, Check, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeSearchResult, YouTubeChannel, Song } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/hooks/use-toast';
import { finalTranscriptFromSpeechEvent, type SpeechResultEventLike } from '@/lib/voiceSearch';

interface SpeechRecognitionErrorLike extends Event {
  error?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface SongSearchProps {
  onAddSong: (song: Song) => void;
  userId: string;
  resultsPlacement?: 'popover' | 'inline';
  fill?: boolean;
  voiceSearch?: boolean;
  queueFeedback?: boolean;
}

type SearchTab = 'songs' | 'artists';

export const SongSearch: React.FC<SongSearchProps> = ({
  onAddSong,
  userId,
  resultsPlacement = 'popover',
  fill = false,
  voiceSearch = false,
  queueFeedback = false,
}) => {
  const { karaokeFilterEnabled, setKaraokeFilterEnabled } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('songs');
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [channelVideos, setChannelVideos] = useState<YouTubeSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [addedVideoIds, setAddedVideoIds] = useState<Set<string>>(() => new Set());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceErrorToastShownRef = useRef(false);
  const addedTimersRef = useRef<Record<string, number>>({});
  const speechRecognitionCtor = useMemo<SpeechRecognitionConstructor | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);
  const canUseVoiceSearch = voiceSearch && speechRecognitionCtor !== null;

  const handleSearch = async (searchQuery = query) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setIsOpen(true);
    setSelectedChannel(null);
    setChannelVideos([]);
    
    try {
      if (activeTab === 'songs') {
        // The edge function biases the query and re-ranks known karaoke
        // providers to the top when the karaoke flag is set.
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query: trimmedQuery, type: 'video', karaoke: karaokeFilterEnabled },
        });
        if (error) throw error;
        setResults(data.results || []);
        setChannels([]);
      } else {
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query: trimmedQuery, type: 'channel' },
        });
        if (error) throw error;
        setChannels(data.channels || []);
        setResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setChannels([]);
      setError("Couldn't load results. Check your connection and try again.");
      toast({ title: 'Search failed', description: 'Could not reach the search service.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSearch = () => {
    if (!speechRecognitionCtor) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new speechRecognitionCtor();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = finalTranscriptFromSpeechEvent(event);
      if (transcript) {
        setQuery(transcript);
        void handleSearch(transcript);
      }
      recognition.stop();
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (
        (event.error === 'not-allowed' || event.error === 'service-not-allowed') &&
        !voiceErrorToastShownRef.current
      ) {
        voiceErrorToastShownRef.current = true;
        toast({ title: 'Mic blocked', description: 'Allow microphone access to use voice search.' });
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Voice search start error:', err);
      recognitionRef.current = null;
      setIsListening(false);
      if (!voiceErrorToastShownRef.current) {
        voiceErrorToastShownRef.current = true;
        toast({ title: 'Voice search unavailable', description: 'Try typing the search instead.' });
      }
    }
  };

  const handleSelectChannel = async (channel: YouTubeChannel) => {
    setIsLoading(true);
    setSelectedChannel(channel);
    
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { channelId: channel.channelId },
      });
      if (error) throw error;
      setChannelVideos(data.results || []);
    } catch (err) {
      console.error('Error fetching channel videos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToChannels = () => {
    setSelectedChannel(null);
    setChannelVideos([]);
  };

  const handleAddSong = (result: YouTubeSearchResult) => {
    const song: Song = {
      id: crypto.randomUUID(),
      videoId: result.videoId,
      title: result.title,
      artist: result.channelTitle,
      thumbnail: result.thumbnail,
      duration: result.duration,
      addedBy: userId,
    };
    onAddSong(song);
    if (!queueFeedback) return;

    setAddedVideoIds((current) => {
      const next = new Set(current);
      next.add(result.videoId);
      return next;
    });
    if (addedTimersRef.current[result.videoId] !== undefined) {
      window.clearTimeout(addedTimersRef.current[result.videoId]);
    }
    addedTimersRef.current[result.videoId] = window.setTimeout(() => {
      setAddedVideoIds((current) => {
        const next = new Set(current);
        next.delete(result.videoId);
        return next;
      });
      delete addedTimersRef.current[result.videoId];
    }, 1000);
    toast({ title: 'Added to queue', description: result.title });
    // Don't close anything - let user continue browsing/adding songs
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedChannel(null);
    setChannelVideos([]);
    setQuery('');
    setResults([]);
    setChannels([]);
    setError(null);
    setHasSearched(false);
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setResults([]);
    setChannels([]);
    setSelectedChannel(null);
    setChannelVideos([]);
    setError(null);
    setHasSearched(false);
  };

  const videosToShow = selectedChannel ? channelVideos : results;
  const hasResults = activeTab === 'songs' 
    ? videosToShow.length > 0 
    : (selectedChannel ? channelVideos.length > 0 : channels.length > 0);

  useEffect(() => {
    const addedTimers = addedTimersRef.current;
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort?.();
      }
      Object.values(addedTimers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div className={cn('relative', fill && 'flex min-h-0 flex-1 flex-col')}>
      <div className={cn(fill && 'sticky top-0 z-10 shrink-0 bg-[hsl(var(--surface))] pb-2')}>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={activeTab === 'songs' ? "Search for songs..." : "Search for artists..."}
              enterKeyHint="search"
              inputMode="search"
              className="rounded-xl border-border bg-background/55 pl-10 text-base md:text-base"
            />
          </div>
          {canUseVoiceSearch && (
            <Button
              type="button"
              variant={isListening ? 'secondary' : 'outline'}
              size="icon"
              onClick={handleVoiceSearch}
              className="h-11 w-11 shrink-0 rounded-xl"
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
              aria-pressed={isListening}
              title={isListening ? 'Stop voice search' : 'Start voice search'}
            >
              <Mic className={cn('h-4 w-4', isListening && 'text-primary motion-safe:animate-pulse')} />
            </Button>
          )}
          <Button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="h-11 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => handleTabChange('songs')}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'songs'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:bg-[hsl(var(--surface)/0.7)] hover:text-foreground'
            )}
          >
            <Music className="w-3.5 h-3.5" />
            Songs
          </button>
          <button
            onClick={() => handleTabChange('artists')}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'artists'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:bg-[hsl(var(--surface)/0.7)] hover:text-foreground'
            )}
          >
            <User className="w-3.5 h-3.5" />
            Artists
          </button>
          <button
            onClick={() => setKaraokeFilterEnabled(!karaokeFilterEnabled)}
            title="Surface karaoke / instrumental versions first"
            className={cn(
              'ml-auto flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              karaokeFilterEnabled
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-transparent text-muted-foreground hover:bg-[hsl(var(--surface)/0.7)] hover:text-foreground'
            )}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Karaoke
          </button>
        </div>
      </div>

      {isOpen && (hasResults || isLoading || error || hasSearched) && (
        <div className={cn(
          'scrollbar-karaoke z-50 mt-2 overflow-x-hidden overflow-y-auto rounded-xl border border-white/10 bg-[hsl(var(--surface))] pr-1 shadow-2xl',
          fill ? 'min-h-0 flex-1' : 'max-h-96',
          resultsPlacement === 'popover' && !fill && 'absolute left-0 right-0 top-full'
        )}>
          <div className="p-2 flex justify-between items-center border-b border-border">
            {selectedChannel ? (
              <button 
                onClick={handleBackToChannels}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to artists
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">
                {activeTab === 'songs' 
                  ? `${results.length} songs` 
                  : `${channels.length} artists`}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-11 w-11"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Channel Profile Header */}
          {selectedChannel && (
            <div className="p-3 border-b border-border flex items-center gap-3 bg-muted/30">
              <img
                src={selectedChannel.thumbnail}
                alt={selectedChannel.title}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">{selectedChannel.title}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedChannel.subscriberCount} subscribers • {selectedChannel.videoCount} videos
                </p>
              </div>
            </div>
          )}

          <div className="p-2 space-y-1">
            {isLoading && !selectedChannel && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && error && (
              <div className="px-3 py-6 text-center text-sm text-destructive">{error}</div>
            )}
            {!isLoading && !error && hasSearched && !hasResults && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches found.</div>
            )}
            {/* Show channels list */}
            {activeTab === 'artists' && !selectedChannel && channels.map((channel) => (
              <button
                key={channel.channelId}
                onClick={() => handleSelectChannel(channel)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
                  'hover:bg-muted/50 text-left group'
                )}
              >
                <img
                  src={channel.thumbnail}
                  alt={channel.title}
                  className="w-12 h-12 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{channel.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {channel.subscriberCount} subscribers
                  </p>
                  {channel.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {channel.description}
                    </p>
                  )}
                </div>
                <Music className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}

            {/* Show videos (either search results or channel videos) */}
            {(activeTab === 'songs' || selectedChannel) && videosToShow.map((result) => {
              const isAdded = queueFeedback && addedVideoIds.has(result.videoId);

              return (
                <button
                  key={result.videoId}
                  onClick={() => handleAddSong(result)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
                    'hover:bg-muted/50 text-left group'
                  )}
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-16 h-12 object-cover rounded"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    <p className="text-xs text-primary font-medium truncate">
                      {result.channelTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {result.duration}
                    </span>
                    {isAdded ? (
                      <Check className="w-5 h-5 text-[hsl(var(--success))] opacity-100 transition-opacity motion-reduce:transition-none" />
                    ) : (
                      <Plus className="w-5 h-5 text-[hsl(var(--success))] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* Loading state for channel videos */}
            {isLoading && selectedChannel && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
