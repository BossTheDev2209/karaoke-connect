import { Song } from '@/types/karaoke';

export interface SavedPlaylist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  songs: Song[];
}

const PLAYLIST_STORAGE_KEY = 'karaoke_playlists';

const playlistName = (name: string) => name.trim() || 'Untitled playlist';

const isSong = (value: unknown): value is Song => {
  if (!value || typeof value !== 'object') return false;
  const song = value as Partial<Record<keyof Song, unknown>>;
  return (
    typeof song.id === 'string' &&
    typeof song.videoId === 'string' &&
    typeof song.title === 'string' &&
    typeof song.artist === 'string' &&
    typeof song.thumbnail === 'string' &&
    typeof song.duration === 'string' &&
    typeof song.addedBy === 'string'
  );
};

const isSavedPlaylist = (value: unknown): value is SavedPlaylist => {
  if (!value || typeof value !== 'object') return false;
  const playlist = value as Partial<SavedPlaylist>;
  return (
    typeof playlist.id === 'string' &&
    typeof playlist.name === 'string' &&
    typeof playlist.createdAt === 'number' &&
    typeof playlist.updatedAt === 'number' &&
    Array.isArray(playlist.songs) &&
    playlist.songs.every(isSong)
  );
};

const safeRandomId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `playlist-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

export const addPlaylist = (list: SavedPlaylist[], name: string, songs: Song[]): SavedPlaylist[] => {
  const now = Date.now();
  const playlist: SavedPlaylist = {
    id: safeRandomId(),
    name: playlistName(name),
    createdAt: now,
    updatedAt: now,
    songs: [...songs],
  };

  return [playlist, ...list];
};

export const renamePlaylist = (list: SavedPlaylist[], id: string, name: string): SavedPlaylist[] =>
  list.map((playlist) =>
    playlist.id === id
      ? { ...playlist, name: playlistName(name), updatedAt: Date.now() }
      : playlist
  );

export const deletePlaylist = (list: SavedPlaylist[], id: string): SavedPlaylist[] =>
  list.filter((playlist) => playlist.id !== id);

export const removeSongFromPlaylist = (list: SavedPlaylist[], id: string, songId: string): SavedPlaylist[] =>
  list.map((playlist) =>
    playlist.id === id
      ? {
          ...playlist,
          updatedAt: Date.now(),
          songs: playlist.songs.filter((song) => song.id !== songId),
        }
      : playlist
  );

export const filterPlaylists = (list: SavedPlaylist[], query: string): SavedPlaylist[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return list;
  return list.filter((playlist) => playlist.name.toLowerCase().includes(normalized));
};

export const loadPlaylists = (): SavedPlaylist[] => {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedPlaylist);
  } catch {
    return [];
  }
};

export const savePlaylists = (list: SavedPlaylist[]): void => {
  try {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode/quota failures are intentionally non-fatal.
  }
};
