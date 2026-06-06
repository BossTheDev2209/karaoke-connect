import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPlaylist,
  deletePlaylist,
  filterPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
  SavedPlaylist,
} from './playlistStore';
import { Song } from '@/types/karaoke';

const song = (id: string, title = id): Song => ({
  id,
  videoId: `video-${id}`,
  title,
  artist: `artist-${id}`,
  thumbnail: `thumb-${id}`,
  duration: '3:00',
  addedBy: 'user-1',
});

describe('playlistStore pure helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    vi.stubGlobal('crypto', { randomUUID: () => 'playlist-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('adds a playlist without mutating the original list', () => {
    const existing: SavedPlaylist[] = [];
    const songs = [song('s1'), song('s2')];

    const next = addPlaylist(existing, ' Road Trip ', songs);

    expect(existing).toEqual([]);
    expect(next).toEqual([
      {
        id: 'playlist-1',
        name: 'Road Trip',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        songs,
      },
    ]);
    expect(next[0].songs).not.toBe(songs);
  });

  it('renames one playlist and refreshes updatedAt', () => {
    const list: SavedPlaylist[] = [
      { id: 'p1', name: 'Old', createdAt: 1, updatedAt: 1, songs: [song('s1')] },
      { id: 'p2', name: 'Keep', createdAt: 2, updatedAt: 2, songs: [song('s2')] },
    ];

    const next = renamePlaylist(list, 'p1', ' New Name ');

    expect(next[0]).toMatchObject({ id: 'p1', name: 'New Name', createdAt: 1, updatedAt: 1_700_000_000_000 });
    expect(next[1]).toBe(list[1]);
  });

  it('deletes a playlist by id', () => {
    const list: SavedPlaylist[] = [
      { id: 'p1', name: 'One', createdAt: 1, updatedAt: 1, songs: [] },
      { id: 'p2', name: 'Two', createdAt: 2, updatedAt: 2, songs: [] },
    ];

    expect(deletePlaylist(list, 'p1').map((playlist) => playlist.id)).toEqual(['p2']);
  });

  it('removes a song from a playlist and refreshes updatedAt', () => {
    const list: SavedPlaylist[] = [
      { id: 'p1', name: 'One', createdAt: 1, updatedAt: 1, songs: [song('s1'), song('s2')] },
    ];

    const next = removeSongFromPlaylist(list, 'p1', 's1');

    expect(next[0].songs.map((item) => item.id)).toEqual(['s2']);
    expect(next[0].updatedAt).toBe(1_700_000_000_000);
  });

  it('filters playlists by case-insensitive name query', () => {
    const list: SavedPlaylist[] = [
      { id: 'p1', name: 'Thai Karaoke', createdAt: 1, updatedAt: 1, songs: [] },
      { id: 'p2', name: 'Road Mix', createdAt: 2, updatedAt: 2, songs: [] },
    ];

    expect(filterPlaylists(list, ' thai ').map((playlist) => playlist.id)).toEqual(['p1']);
    expect(filterPlaylists(list, '')).toEqual(list);
  });
});
