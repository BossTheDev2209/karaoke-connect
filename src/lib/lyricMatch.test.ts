import { describe, it, expect } from 'vitest';
import {
  parseArtistTitle,
  scoreCandidate,
  pickBest,
  similarity,
  cleanText,
} from '../../supabase/functions/fetch-lyrics/lyricMatch';

describe('cleanText', () => {
  it('strips YouTube noise markers', () => {
    expect(cleanText('Yellow (Official MV) [HD]')).toBe('Yellow');
    expect(cleanText('Some Song - Official Music Video')).toContain('Some Song');
  });
});

describe('parseArtistTitle', () => {
  it('handles "Artist - Song" and "Song - Artist" by offering both', () => {
    const guesses = parseArtistTitle('TATTOO COLOUR - พระอาทิตย์ (Official MV)', 'TATTOO COLOUR');
    const pairs = guesses.map((g) => `${g.artist}|${g.title}`);
    expect(pairs.some((p) => p.startsWith('TATTOO COLOUR|'))).toBe(true); // channel/artist as artist
    expect(guesses.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the channel as artist when there is no dash', () => {
    const guesses = parseArtistTitle('พระอาทิตย์', 'TATTOO COLOUR');
    expect(guesses.some((g) => g.artist === 'TATTOO COLOUR')).toBe(true);
  });
});

describe('scoreCandidate', () => {
  it('does NOT let an unrelated synced track beat a matching unsynced one', () => {
    const query = { artist: 'Tattoo Colour', title: 'Some Song' };
    const wrongButSynced = { artistName: 'Dept', trackName: 'I feel like that', syncedLyrics: '[00:01.0]x' };
    const rightUnsynced = { artistName: 'Tattoo Colour', trackName: 'Some Song', plainLyrics: 'x' };
    expect(scoreCandidate(rightUnsynced, query)).toBeGreaterThan(scoreCandidate(wrongButSynced, query));
  });
});

describe('pickBest', () => {
  it('returns null when nothing clears the similarity floor', () => {
    const query = { artist: 'Tattoo Colour', title: 'Some Song' };
    const garbage = [{ artistName: 'Dept', trackName: 'I feel like that', syncedLyrics: '[00:01.0]x' }];
    expect(pickBest(garbage, query)).toBeNull();
  });

  it('returns a genuine match', () => {
    const query = { artist: 'Coldplay', title: 'Yellow' };
    const ok = [{ id: 1, artistName: 'Coldplay', trackName: 'Yellow', syncedLyrics: '[00:01.0]x' }];
    expect(pickBest(ok, query)?.trackName).toBe('Yellow');
  });

  it('picks a real match from a noisy full-text candidate pool', () => {
    const query = { artist: 'BLACKPINK', title: 'Pink Venom BLACKPINK' };
    const candidates = [
      { artistName: 'Dept', trackName: 'I feel like that', syncedLyrics: '[00:01.0]x' },
      { artistName: 'BLACKPINK', trackName: 'Pink Venom', syncedLyrics: '[00:01.0]x' },
      { artistName: 'Coldplay', trackName: 'Yellow', syncedLyrics: '[00:01.0]x' },
    ];

    expect(pickBest(candidates, query)?.trackName).toBe('Pink Venom');
  });
});

describe('similarity', () => {
  it('is 1 for identical and 0 for empty', () => {
    expect(similarity('Yellow', 'yellow')).toBe(1);
    expect(similarity('', 'x')).toBe(0);
  });
});
