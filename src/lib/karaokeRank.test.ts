import { describe, it, expect } from 'vitest';
import {
  karaokeScore,
  rankForKaraoke,
  KARAOKE_PROVIDERS,
} from '../../supabase/functions/youtube-search/karaokeRank';

const r = (title: string, channelTitle: string) => ({ title, channelTitle, videoId: title });

describe('karaokeScore', () => {
  it('boosts known providers and karaoke/instrumental titles', () => {
    expect(karaokeScore(r('Yellow (Karaoke Version)', 'Sing King'))).toBeGreaterThan(
      karaokeScore(r('Yellow', 'Coldplay')),
    );
    expect(karaokeScore(r('Yellow Instrumental', 'Random'))).toBeGreaterThan(
      karaokeScore(r('Yellow', 'Random')),
    );
  });

  it('gives a non-provider, non-karaoke result a score of zero', () => {
    expect(karaokeScore(r('Yellow', 'Coldplay'))).toBe(0);
  });
});

describe('rankForKaraoke', () => {
  it('moves karaoke results to the top without dropping others', () => {
    const input = [r('Yellow', 'Coldplay'), r('Yellow (Karaoke)', 'KaraFun')];
    const out = rankForKaraoke(input);
    expect(out[0].channelTitle).toBe('KaraFun');
    expect(out).toHaveLength(2);
  });

  it('is a stable sort (preserves original order within ties)', () => {
    const input = [r('A', 'Coldplay'), r('B', 'Radiohead')];
    const out = rankForKaraoke(input);
    expect(out.map((x) => x.title)).toEqual(['A', 'B']);
  });
});

describe('KARAOKE_PROVIDERS', () => {
  it('is a non-empty list of lowercased provider hints', () => {
    expect(KARAOKE_PROVIDERS.length).toBeGreaterThan(3);
    expect(KARAOKE_PROVIDERS.every((p) => p === p.toLowerCase())).toBe(true);
  });
});
