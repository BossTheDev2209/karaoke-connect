import { describe, it, expect } from 'vitest';
import { dedupePresence } from './presence';
import type { User } from '@/types/karaoke';

const u = (id: string, nickname = id): User => ({ id, nickname } as User);

describe('dedupePresence', () => {
  it('returns one user per presence key, keeping the latest', () => {
    const state = { a: [u('a', 'old'), u('a', 'new')], b: [u('b')] };
    const out = dedupePresence(state);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.id === 'a')?.nickname).toBe('new');
  });

  it('dedupes by id even across keys', () => {
    const state = { a: [u('a')], 'a-2': [u('a')] };
    expect(dedupePresence(state)).toHaveLength(1);
  });

  it('ignores malformed entries without an id', () => {
    const state = { a: [u('a'), {} as User, null as unknown as User] };
    expect(dedupePresence(state)).toHaveLength(1);
  });

  it('returns empty for empty state', () => {
    expect(dedupePresence({})).toEqual([]);
  });
});
