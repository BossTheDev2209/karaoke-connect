import { useCallback, useState } from 'react';
import { Song } from '@/types/karaoke';
import {
  addPlaylist,
  deletePlaylist,
  loadPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
  savePlaylists,
  SavedPlaylist,
} from '@/lib/playlistStore';

const samePlaylists = (left: SavedPlaylist[], right: SavedPlaylist[]) =>
  JSON.stringify(left) === JSON.stringify(right);

export const usePlaylists = () => {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(() => loadPlaylists());

  const persist = useCallback((next: SavedPlaylist[]) => {
    savePlaylists(next);
    const persisted = loadPlaylists();
    const saved = samePlaylists(persisted, next);
    if (saved) setPlaylists(next);
    return saved;
  }, []);

  const create = useCallback((name: string, songs: Song[]) => {
    return persist(addPlaylist(playlists, name, songs));
  }, [persist, playlists]);

  const rename = useCallback((id: string, name: string) => {
    return persist(renamePlaylist(playlists, id, name));
  }, [persist, playlists]);

  const remove = useCallback((id: string) => {
    return persist(deletePlaylist(playlists, id));
  }, [persist, playlists]);

  const removeSong = useCallback((id: string, songId: string) => {
    return persist(removeSongFromPlaylist(playlists, id, songId));
  }, [persist, playlists]);

  return { playlists, create, rename, remove, removeSong };
};
