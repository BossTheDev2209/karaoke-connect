import { describe, expect, it } from 'vitest';
import {
  applyPlayableVideoFilters,
  filterEmbeddableVideoDetails,
} from '../../supabase/functions/youtube-search/videoSearchParams';

describe('applyPlayableVideoFilters', () => {
  it('restricts search results to videos playable in embedded external players', () => {
    const url = applyPlayableVideoFilters(new URL('https://www.googleapis.com/youtube/v3/search'));

    expect(url.searchParams.get('videoEmbeddable')).toBe('true');
    expect(url.searchParams.get('videoSyndicated')).toBe('true');
  });
});

describe('filterEmbeddableVideoDetails', () => {
  it('keeps only videos explicitly marked embeddable by videos.list', () => {
    const items = [
      { id: 'playable', status: { embeddable: true } },
      { id: 'blocked', status: { embeddable: false } },
      { id: 'unknown' },
    ];

    expect(filterEmbeddableVideoDetails(items)).toEqual([
      { id: 'playable', status: { embeddable: true } },
    ]);
  });
});
