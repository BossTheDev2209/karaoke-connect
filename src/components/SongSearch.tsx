import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, Loader2, Music, User, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeSearchResult, YouTubeChannel, Song } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SongSearchProps {
  onAddSong: (song: Song) => void;
  userId: string;
  compact?: boolean;
}

export const SongSearch: React.FC<SongSearchProps> = ({ onAddSong, userId, compact = false }) => {
  const { karaokeFilterEnabled } = useTheme();
  
  const [songQuery, setSongQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSongLoading, setIsSongLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [artistQuery, setArtistQuery] = useState('');
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [isArtistLoading, setIsArtistLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [channelVideos, setChannelVideos] = useState<YouTubeSearchResult[]>([]);
  const [artistModalOpen, setArtistModalOpen] = useState(false);
  
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const handleSongSearch = async () => {
    if (!songQuery.trim()) return;
    setIsSongLoading(true);
    try {
      const searchQuery = karaokeFilterEnabled 
        ? `${songQuery} karaoke instrumental` 
        : songQuery;
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: searchQuery, type: 'video' },
      });
      if (error) throw error;
      setResults(data.results || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSongLoading(false);
    }
  };

  const handleArtistSearch = async () => {
    if (!artistQuery.trim()) return;
    setIsArtistLoading(true);
    setSelectedChannel(null);
    setChannelVideos([]);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: artistQuery, type: 'channel' },
      });
      if (error) throw error;
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsArtistLoading(false);
    }
  };

  const handleSelectChannel = async (channel: YouTubeChannel) => {
    setIsArtistLoading(true);
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
      setIsArtistLoading(false);
    }
  };

  const handleBackToChannels = () => {
    setSelectedChannel(null);
    setChannelVideos([]);
  };

  const handleAddSong = useCallback((result: YouTubeSearchResult) => {
    if (recentlyAdded.has(result.videoId)) return;
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
    setRecentlyAdded(prev => new Set(prev).add(result.videoId));
    setTimeout(() => {
      setRecentlyAdded(prev => {
        const next = new Set(prev);
        next.delete(result.videoId);
        return next;
      });
    }, 2000);
  }, [recentlyAdded, onAddSong, userId]);

  const handleClose = () => {
    setIsOpen(false);
    setSongQuery('');
    setResults([]);
  };

  const handleCloseArtistModal = () => {
    setArtistModalOpen(false);
    setSelectedChannel(null);
    setChannelVideos([]);
    setChannels([]);
    setArtistQuery('');
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={songQuery}
            onChange={(e) => setSongQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSongSearch()}
            placeholder="Search for songs..."
            className="pl-10 bg-input border-border focus-visible:ring-primary/50"
          />
        </div>
        <Button 
          onClick={handleSongSearch} 
          disabled={isSongLoading}
          className="btn-neon"
        >
          {isSongLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Artist Button */}
      <div className="mt-2">
        <button
          onClick={() => setArtistModalOpen(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            'bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30',
            'hover:from-neon-purple/30 hover:to-neon-pink/30 hover:border-neon-purple/50',
            'active:scale-[0.98] text-foreground'
          )}
        >
          <User className="w-4 h-4 text-neon-purple" />
          <span>Browse Artists</span>
          <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
        </button>
      </div>

      {/* Artist Modal */}
      {createPortal(
        <AnimatePresence>
          {artistModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseArtistModal}
                className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              >
                <div className="w-full max-w-3xl max-h-[80vh] flex flex-col bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-neon-purple/10 to-neon-pink/10 shrink-0">
                    <div className="flex items-center gap-3">
                      {selectedChannel ? (
                        <button
                          onClick={handleBackToChannels}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                      ) : (
                        <>
                          <div className="p-2 rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold">Browse Artists</h2>
                            <p className="text-xs text-muted-foreground">Find your favorite karaoke channels</p>
                          </div>
                        </>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCloseArtistModal}
                      className="rounded-xl hover:bg-destructive/20 h-9 w-9"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Search */}
                  {!selectedChannel && (
                    <div className="p-4 border-b border-border shrink-0">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            value={artistQuery}
                            onChange={(e) => setArtistQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleArtistSearch()}
                            placeholder="Search for artists or channels..."
                            className="pl-10 bg-muted/50 border-border rounded-xl"
                            autoFocus
                          />
                        </div>
                        <Button
                          onClick={handleArtistSearch}
                          disabled={isArtistLoading}
                          className="rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink hover:opacity-90"
                        >
                          {isArtistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Channel Header */}
                  {selectedChannel && (
                    <div className="p-4 border-b border-border bg-gradient-to-r from-muted/50 to-transparent shrink-0">
                      <div className="flex items-center gap-4">
                        <img
                          src={selectedChannel.thumbnail}
                          alt={selectedChannel.title}
                          className="w-16 h-16 rounded-full object-cover ring-2 ring-neon-purple/50"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{selectedChannel.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedChannel.subscriberCount} subscribers • {selectedChannel.videoCount} videos
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {isArtistLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
                            <p className="text-sm text-muted-foreground">
                              {selectedChannel ? 'Loading videos...' : 'Searching artists...'}
                            </p>
                          </div>
                        </div>
                      ) : !selectedChannel && channels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="p-4 rounded-full bg-muted/50 mb-4">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">Search for artists to get started</p>
                          <p className="text-xs text-muted-foreground mt-1">Try "karaoke channel" or your favorite artist</p>
                        </div>
                      ) : (
                        <>
                          {!selectedChannel && channels.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {channels.map((channel) => (
                                <motion.button
                                  key={channel.channelId}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleSelectChannel(channel)}
                                  className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-neon-purple/30 transition-all group"
                                >
                                  <div className="relative">
                                    <img
                                      src={channel.thumbnail}
                                      alt={channel.title}
                                      className="w-20 h-20 rounded-full object-cover ring-2 ring-border group-hover:ring-neon-purple/50 transition-all"
                                    />
                                    <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Music className="w-3 h-3 text-white" />
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-sm truncate max-w-[120px]">{channel.title}</p>
                                    <p className="text-xs text-muted-foreground">{channel.subscriberCount}</p>
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          )}

                          {selectedChannel && channelVideos.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {channelVideos.map((video) => (
                                <motion.button
                                  key={video.videoId}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleAddSong(video)}
                                  className="flex flex-col rounded-xl bg-muted/30 hover:bg-muted/50 border border-border hover:border-neon-green/30 transition-all group overflow-hidden text-left"
                                >
                                  <div className="relative aspect-video">
                                    <img
                                      src={video.thumbnail}
                                      alt={video.title}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                      <div className="p-2 rounded-full bg-neon-green/90 opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                                        <Plus className="w-5 h-5 text-black" />
                                      </div>
                                    </div>
                                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded font-mono">
                                      {video.duration}
                                    </span>
                                  </div>
                                  <div className="p-2">
                                    <p className="font-medium text-xs line-clamp-2">{video.title}</p>
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Footer */}
                  {(channels.length > 0 || channelVideos.length > 0) && (
                    <div className="p-3 border-t border-border bg-muted/30 text-center shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {selectedChannel 
                          ? `${channelVideos.length} videos from ${selectedChannel.title}`
                          : `${channels.length} artists found`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Song Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-40 glass rounded-xl max-h-[70vh] sm:max-h-96 overflow-hidden flex flex-col">
          <div className="p-2.5 flex justify-between items-center border-b border-border shrink-0">
            <span className="text-sm text-muted-foreground font-medium">
              {results.length} songs found
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              {results.map((result) => {
                const wasAdded = recentlyAdded.has(result.videoId);
                return (
                  <div
                    key={result.videoId}
                    className={cn(
                      'flex items-center gap-3 rounded-xl transition-all',
                      // Large touch targets for mobile
                      'p-2.5 min-h-[60px]',
                      wasAdded
                        ? 'bg-neon-green/10 border border-neon-green/20'
                        : 'hover:bg-muted/40 border border-transparent active:bg-muted/60'
                    )}
                  >
                    {/* Thumbnail */}
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-16 h-12 object-cover rounded-lg shrink-0"
                    />
                    
                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-primary truncate font-medium">
                          {result.channelTitle}
                        </p>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                          {result.duration}
                        </span>
                      </div>
                    </div>
                    
                    {/* Add button — always visible, large touch target */}
                    <Button
                      variant={wasAdded ? "ghost" : "default"}
                      size="icon"
                      disabled={wasAdded}
                      onClick={() => handleAddSong(result)}
                      className={cn(
                        "shrink-0 rounded-xl transition-all",
                        // Large 44x44 touch target
                        "h-11 w-11",
                        wasAdded
                          ? "text-neon-green"
                          : "bg-neon-green/90 hover:bg-neon-green text-black shadow-sm shadow-neon-green/20"
                      )}
                    >
                      {wasAdded ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
