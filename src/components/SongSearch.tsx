import React, { useState } from 'react';
import { Search, Plus, X, Loader2, Music, User, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeSearchResult, YouTubeChannel, Song } from '@/types/karaoke';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

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

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setSelectedChannel(null);
    setChannelVideos([]);
    
    try {
      const searchQuery = activeTab === 'songs' && karaokeFilterEnabled 
        ? `${query} karaoke instrumental` 
        : query;

      if (activeTab === 'songs') {
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query: searchQuery, type: 'video' },
        });
        if (error) throw error;
        setResults(data.results || []);
        setChannels([]);
      } else {
        const { data, error } = await supabase.functions.invoke('youtube-search', {
          body: { query, type: 'channel' },
        });
        if (error) throw error;
        setChannels(data.channels || []);
        setResults([]);
      }
      setIsOpen(true);
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
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={activeTab === 'songs' ? "Search for songs..." : "Search for artists..."}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isLoading}
          className="btn-neon"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-2">
        <button
          onClick={() => handleTabChange('songs')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'songs' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <Music className="w-3.5 h-3.5" />
          Songs
        </button>
        <button
          onClick={() => handleTabChange('artists')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'artists' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <User className="w-3.5 h-3.5" />
          Artists
        </button>
      </div>

      {isOpen && hasResults && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 glass rounded-xl max-h-96 overflow-y-auto">
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
              className="h-6 w-6"
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
            {(activeTab === 'songs' || selectedChannel) && videosToShow.map((result) => (
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
