import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ListPlus,
  Pencil,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlaylists } from '@/hooks/usePlaylists';
import { filterPlaylists, SavedPlaylist } from '@/lib/playlistStore';
import { cn } from '@/lib/utils';
import { Song } from '@/types/karaoke';
import { toast } from '@/hooks/use-toast';

interface PlaylistsProps {
  queue: Song[];
  onQueueSongs: (songs: Song[]) => void;
}

const formatUpdatedAt = (updatedAt: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updatedAt));

const queueSongId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `song-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const cloneSongsForQueue = (songs: Song[]) =>
  songs.map((song) => ({
    ...song,
    id: queueSongId(),
  }));

const playlistSongCount = (playlist: SavedPlaylist) =>
  `${playlist.songs.length} ${playlist.songs.length === 1 ? 'song' : 'songs'}`;

export const Playlists: React.FC<PlaylistsProps> = ({ queue, onQueueSongs }) => {
  const { playlists, create, rename, remove, removeSong } = usePlaylists();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visiblePlaylists = useMemo(() => filterPlaylists(playlists, query), [playlists, query]);

  const showSaveFailure = () => {
    toast({ title: "Couldn't save playlist on this device", variant: 'destructive' });
  };

  const handleCreate = () => {
    if (queue.length === 0) return;
    if (!create(newName, queue)) {
      showSaveFailure();
      return;
    }

    toast({ title: 'Playlist saved', description: `${queue.length} songs saved on this device.` });
    setNewName('');
  };

  const startRename = (playlist: SavedPlaylist) => {
    setConfirmDeleteId(null);
    setRenamingId(playlist.id);
    setRenameName(playlist.name);
  };

  const handleRename = (id: string) => {
    if (!rename(id, renameName)) {
      showSaveFailure();
      return;
    }

    setRenamingId(null);
    setRenameName('');
  };

  const handleDelete = (id: string) => {
    if (!remove(id)) {
      showSaveFailure();
      return;
    }

    if (expandedId === id) setExpandedId(null);
    setConfirmDeleteId(null);
  };

  const handleRemoveSong = (playlistId: string, songId: string) => {
    if (!removeSong(playlistId, songId)) {
      showSaveFailure();
    }
  };

  const handleLoad = (playlist: SavedPlaylist) => {
    if (playlist.songs.length === 0) return;
    onQueueSongs(cloneSongsForQueue(playlist.songs));
    toast({ title: 'Playlist loaded', description: `${playlistSongCount(playlist)} added to the queue.` });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playlists"
            className="rounded-xl border-border bg-background/55 pl-10 text-base md:text-sm"
            inputMode="search"
            enterKeyHint="search"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Save current queue</p>
              <p className="text-xs text-muted-foreground">Saved on this device</p>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{queue.length}</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate();
              }}
              placeholder="Playlist name"
              className="min-w-0 rounded-xl border-border bg-background/55"
              disabled={queue.length === 0}
            />
            <Button
              onClick={handleCreate}
              disabled={queue.length === 0}
              className="h-11 shrink-0 rounded-xl"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-karaoke">
        {playlists.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center text-muted-foreground">
            <Save className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm font-medium">No saved playlists</p>
            <p className="mt-1 text-xs">Save the current queue to start a playlist.</p>
          </div>
        ) : visiblePlaylists.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No playlists match.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {visiblePlaylists.map((playlist) => {
              const expanded = expandedId === playlist.id;
              const renaming = renamingId === playlist.id;
              const confirmingDelete = confirmDeleteId === playlist.id;

              return (
                <div key={playlist.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full"
                      onClick={() => setExpandedId(expanded ? null : playlist.id)}
                      aria-label={expanded ? 'Close playlist' : 'Open playlist'}
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    <div className="min-w-0 flex-1">
                      {renaming ? (
                        <div className="flex gap-2">
                          <Input
                            value={renameName}
                            onChange={(event) => setRenameName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleRename(playlist.id);
                              if (event.key === 'Escape') setRenamingId(null);
                            }}
                            className="h-9 min-w-0 rounded-lg border-border bg-background/55"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full text-[hsl(var(--success))]"
                            onClick={() => handleRename(playlist.id)}
                            aria-label="Save playlist name"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
                            onClick={() => setRenamingId(null)}
                            aria-label="Cancel rename"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-semibold text-foreground">{playlist.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {playlistSongCount(playlist)} · updated {formatUpdatedAt(playlist.updatedAt)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-full"
                      onClick={() => handleLoad(playlist)}
                      disabled={playlist.songs.length === 0}
                    >
                      <ListPlus className="h-4 w-4" />
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-full text-muted-foreground"
                      onClick={() => startRename(playlist)}
                    >
                      <Pencil className="h-4 w-4" />
                      Rename
                    </Button>
                    {confirmingDelete ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-full text-destructive hover:text-destructive"
                          onClick={() => handleDelete(playlist.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-full text-muted-foreground"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-full text-destructive/80 hover:text-destructive"
                        onClick={() => {
                          setRenamingId(null);
                          setConfirmDeleteId(playlist.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-1 pl-11">
                      {playlist.songs.length === 0 ? (
                        <p className="rounded-lg bg-white/[0.03] px-3 py-4 text-sm text-muted-foreground">Playlist is empty.</p>
                      ) : playlist.songs.map((song) => (
                        <div
                          key={song.id}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
                        >
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="h-10 w-14 shrink-0 rounded-md object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{song.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{song.duration}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full text-destructive/80 hover:text-destructive"
                            onClick={() => handleRemoveSong(playlist.id, song.id)}
                            aria-label={`Remove ${song.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
