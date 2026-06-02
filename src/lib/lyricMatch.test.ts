import { describe, it, expect } from 'vitest';
import {
  parseArtistTitle,
  scoreCandidate,
  pickBest,
  similarity,
  cleanText,
  coreTitle,
} from '../../supabase/functions/fetch-lyrics/lyricMatch';

describe('coreTitle', () => {
  it('keeps the part before a Thai/English dual-title separator', () => {
    expect(coreTitle('ช่วงที่ดีที่สุด / The Sweetest Moment')).toBe('ช่วงที่ดีที่สุด');
  });
  it('drops parenthetical tags and a trailing feat clause', () => {
    expect(coreTitle('ห่างไกลเหลือเกิน (So Far Away) feat. Pod Moderndog')).toBe('ห่างไกลเหลือเกิน');
  });
});

describe('parseArtistTitle core variants', () => {
  it('offers a clean core title for a "/ English" YouTube title with no dash', () => {
    const guesses = parseArtistTitle('ช่วงที่ดีที่สุด / The Sweetest Moment', 'BOYdPOD - Topic');
    expect(guesses.some((g) => g.artist === 'BOYdPOD' && g.title === 'ช่วงที่ดีที่สุด')).toBe(true);
  });
  it('strips a trailing (English) feat. clause so the bare song name is queried', () => {
    const guesses = parseArtistTitle(
      'Boyd Kosiyabong - ห่างไกลเหลือเกิน (So Far Away) feat. Pod Moderndog [Official MV]',
      'Bakery Music [ Official ]',
    );
    expect(guesses.some((g) => g.title === 'ห่างไกลเหลือเกิน')).toBe(true);
  });
});

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

// Real cases from the Spotify Thailand Top 200 benchmark. pickBest must score
// against the parsed clean guesses (not the noisy raw YouTube title) and must
// not accept a title-only match for a common ASCII title with zero artist
// agreement (the Yorch -> Jamiroquai false positive).
describe('pickBest with parsed guesses (benchmark)', () => {
  it('REJECTS a wrong same-title track when the title is common ASCII and artist does not agree', () => {
    // Yorch - Blow Your Mind is NOT on LRCLIB; only Jamiroquai shares the title.
    const guesses = parseArtistTitle('Yorch - Blow Your Mind (Official MV)', 'Yorch - Topic');
    const cands = [
      { id: 1, artistName: 'Jamiroquai', trackName: 'Blow Your Mind', syncedLyrics: '[00:01.0]x', plainLyrics: 'x' },
    ];
    expect(pickBest(cands, guesses)).toBeNull();
  });

  it('KEEPS a title-only match when the title is distinctive non-Latin (romanized-artist rescue)', () => {
    // FREEHAND (Latin channel) vs LRCLIB artist ฟรีแฮน (Thai) -> artist sim 0,
    // but the Thai title is distinctive enough to trust.
    const guesses = parseArtistTitle(
      'FREEHAND - เมื่อถูกค้นพบ (Finally She Found.) (Official MV)',
      'FREEHAND - Topic',
    );
    const cands = [
      { id: 2, artistName: 'ฟรีแฮน', trackName: 'เมื่อถูกค้นพบ (Finally She Found.)', syncedLyrics: '[00:01.0]x' },
    ];
    expect(pickBest(cands, guesses)?.artistName).toBe('ฟรีแฮน');
  });

  it('recovers a feat./variant-suffixed track (scored against the clean guess, not raw metadata)', () => {
    const guesses = parseArtistTitle('aespa - Switchblade (Official MV)', 'aespa - Topic');
    const cands = [
      { id: 3, artistName: 'aespa & Ty Dolla $ign', trackName: 'Switchblade (feat. Ty Dolla $ign)', syncedLyrics: '[00:01.0]x' },
    ];
    expect(pickBest(cands, guesses)?.trackName).toContain('Switchblade');
  });

  it('recovers a Thai feat.-suffixed track with matching artist', () => {
    const guesses = parseArtistTitle('ป๊อบ ปองกูล - สลักจิต (Official MV)', 'ป๊อบ ปองกูล - Topic');
    const cands = [
      { id: 4, artistName: 'ป๊อบ ปองกูล', trackName: 'สลักจิต (feat. Da Endorphine)', plainLyrics: 'x' },
    ];
    expect(pickBest(cands, guesses)?.artistName).toBe('ป๊อบ ปองกูล');
  });

  it('still rejects when even the best guess has a weak title match', () => {
    const guesses = parseArtistTitle('Some Artist - Totally Different Song', 'Some Artist');
    const cands = [
      { id: 5, artistName: 'Some Artist', trackName: 'Unrelated Track', syncedLyrics: '[00:01.0]x' },
    ];
    expect(pickBest(cands, guesses)).toBeNull();
  });
});

describe('similarity', () => {
  it('is 1 for identical and 0 for empty', () => {
    expect(similarity('Yellow', 'yellow')).toBe(1);
    expect(similarity('', 'x')).toBe(0);
  });
});
