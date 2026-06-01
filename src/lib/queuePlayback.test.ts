import { describe, expect, it } from 'vitest';
import { removeSongFromQueue } from './queuePlayback';
import type { Song } from '@/types/karaoke';

const song = (id: string): Song => ({
  id,
  videoId: id,
  title: id,
  artist: 'artist',
  thumbnail: '',
  duration: '3:00',
  addedBy: 'user',
});

describe('removeSongFromQueue', () => {
  it('resets playback when removing the final song', () => {
    expect(removeSongFromQueue([song('blocked')], 0, 'blocked')).toEqual({
      queue: [],
      playback: { currentSongIndex: 0, currentTime: 0, isPlaying: false },
    });
  });

  it('starts the replacement song when removing the current song', () => {
    expect(removeSongFromQueue([song('blocked'), song('next')], 0, 'blocked')).toEqual({
      queue: [song('next')],
      playback: { currentSongIndex: 0, currentTime: 0, isPlaying: true },
    });
  });

  it('keeps the current song selected when removing an earlier song', () => {
    expect(removeSongFromQueue([song('old'), song('current')], 1, 'old')).toEqual({
      queue: [song('current')],
      playback: { currentSongIndex: 0 },
    });
  });
});
