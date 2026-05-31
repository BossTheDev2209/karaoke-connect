import { describe, expect, it } from 'vitest';
import { applyPlayableVideoFilters } from '../../supabase/functions/youtube-search/videoSearchParams';

describe('applyPlayableVideoFilters', () => {
  it('restricts search results to videos playable in embedded external players', () => {
    const url = applyPlayableVideoFilters(new URL('https://www.googleapis.com/youtube/v3/search'));

    expect(url.searchParams.get('videoEmbeddable')).toBe('true');
    expect(url.searchParams.get('videoSyndicated')).toBe('true');
  });
});
