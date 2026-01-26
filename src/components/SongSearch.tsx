import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, Loader2, Music, User, ArrowLeft, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeSearchResult, YouTubeChannel, Song } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface SongSearchProps {
  onAddSong: (song: Song) => void;
  userId: string;
  compact?: boolean;
}

type SearchTab = 'songs' | 'artists';

export const SongSearch: React.FC<SongSearchProps> = ({ onAddSong, userId, compact = false }) => {
  const { karaokeFilterEnabled } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('songs');
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [channelVideos, setChannelVideos] = useState<YouTubeSearchResult[]>([]);
  const [artistModalOpen, setArtistModalOpen] = useState(false);

  // Search for songs (main search bar)
  const handleSongSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    
    try {
      const searchQuery = karaokeFilterEnabled 
        ? `${query} karaoke instrumental` 
        : query;

      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: searchQuery, type: 'video' },
      });
      if (error) throw error;
      setResults(data.results || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Search for artists (artist modal)
  const handleArtistSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setSelectedChannel(null);
    setChannelVideos([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query, type: 'channel' },
      });
      if (error) throw error;
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
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
    // Don't close anything - let user continue browsing/adding songs
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedChannel(null);
    setChannelVideos([]);
    setQuery('');
    setResults([]);
    setChannels([]);
  };

  const handleCloseArtistModal = () => {
    setArtistModalOpen(false);
    setSelectedChannel(null);
    setChannelVideos([]);
    setChannels([]);
  };

  const openArtistModal = () => {
    setArtistModalOpen(true);
    setActiveTab('artists');
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setResults([]);
    setChannels([]);
    setSelectedChannel(null);
    setChannelVideos([]);
  };

  const videosToShow = selectedChannel ? channelVideos : results;
  const hasResults = activeTab === 'songs' 
    ? videosToShow.length > 0 
    : (selectedChannel ? channelVideos.length > 0 : channels.length > 0);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSongSearch()}
            placeholder="Search for songs..."
            className="pl-10 bg-input border-border"
          />
        </div>
        <Button 
          onClick={handleSongSearch} 
          disabled={isLoading}
          className="btn-neon"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Artist Button - Opens Fancy Modal */}
      <div className="mt-2">
        <button
          onClick={openArtistModal}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            'bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/30',
            'hover:from-neon-purple/30 hover:to-neon-pink/30 hover:border-neon-purple/50',
            'text-foreground hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          <User className="w-4 h-4 text-neon-purple" />
          <span>Browse Artists</span>
          <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
        </button>
      </div>

      {/* Artist Modal - Rendered via Portal to appear centered on screen */}
      {createPortal(
        <AnimatePresence>
          {artistModalOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseArtistModal}
                className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md"
              />

              {/* Modal - Centered on screen */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              >
                <div className="w-full max-w-3xl max-h-[80vh] flex flex-col bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-neon-purple/10 to-neon-pink/10">
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
                      className="rounded-xl hover:bg-destructive/20"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Search Bar in Modal */}
                  {!selectedChannel && (
                    <div className="p-4 border-b border-border">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleArtistSearch()}
                            placeholder="Search for artists or channels..."
                            className="pl-10 bg-muted/50 border-border rounded-xl"
                            autoFocus
                          />
                        </div>
                        <Button
                          onClick={handleArtistSearch}
                          disabled={isLoading}
                          className="rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink hover:opacity-90"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Channel Profile Header */}
                  {selectedChannel && (
                    <div className="p-4 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
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

                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
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
                        {/* Artists Grid */}
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

                        {/* Channel Videos - Grid Layout like reference */}
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

                  {/* Footer with count */}
                  {(channels.length > 0 || channelVideos.length > 0) && (
                    <div className="p-3 border-t border-border bg-muted/30 text-center">
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

      {/* Song Results Dropdown (only for songs tab) */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-40 glass rounded-xl max-h-96 overflow-y-auto">
          <div className="p-2 flex justify-between items-center border-b border-border">
            <span className="text-sm text-muted-foreground">
              {results.length} songs
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-2 space-y-1">
            {results.map((result) => (
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
                  <Plus className="w-5 h-5 text-neon-green opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
