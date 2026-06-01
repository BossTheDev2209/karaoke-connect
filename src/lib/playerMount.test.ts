import { describe, expect, it } from 'vitest';
import { ensurePlayerMount } from './playerMount';

describe('ensurePlayerMount', () => {
  it('creates a hook-owned mount once and reuses it', () => {
    const nodes = new Map<string, { id: string; className: string }>();
    let appendCount = 0;
    const documentRef = {
      getElementById: (id: string) => nodes.get(id) ?? null,
      createElement: () => ({ id: '', className: '' }),
    };
    const wrapper = {
      appendChild: (node: { id: string; className: string }) => {
        appendCount += 1;
        nodes.set(node.id, node);
        return node;
      },
    };

    const first = ensurePlayerMount(documentRef, wrapper, 'youtube-player');
    const second = ensurePlayerMount(documentRef, wrapper, 'youtube-player');

    expect(first).toBe(second);
    expect(first).toEqual({ id: 'youtube-player', className: 'h-full w-full' });
    expect(appendCount).toBe(1);
  });
});
