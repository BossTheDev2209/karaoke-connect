import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REACTION_FAVORITES,
  REACTION_FAVORITES_STORAGE_KEY,
  loadReactionFavorites,
  normalizeReactionFavorites,
  saveReactionFavorites,
} from './reactionFavorites';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('reaction favorites', () => {
  it('uses defaults for missing and malformed storage', () => {
    const storage = new MemoryStorage();
    expect(loadReactionFavorites(storage)).toEqual(DEFAULT_REACTION_FAVORITES);
    storage.setItem(REACTION_FAVORITES_STORAGE_KEY, '{oops');
    expect(loadReactionFavorites(storage)).toEqual(DEFAULT_REACTION_FAVORITES);
  });

  it('keeps valid custom favorites', () => {
    expect(normalizeReactionFavorites(['🫶', '🔥', '👏', '💃'])).toEqual(['🫶', '🔥', '👏', '💃']);
  });

  it('restores defaults for unknown, too few, or too many favorites', () => {
    expect(normalizeReactionFavorites(['🔥', '❤️', '👏', '🎉', 'nope'])).toEqual(DEFAULT_REACTION_FAVORITES);
    expect(normalizeReactionFavorites(['🔥', '❤️', '👏'])).toEqual(DEFAULT_REACTION_FAVORITES);
    expect(normalizeReactionFavorites(['🔥', '❤️', '👏', '🎉', '✨', '😍', '🎤'])).toEqual(DEFAULT_REACTION_FAVORITES);
  });

  it('writes normalized favorites', () => {
    const storage = new MemoryStorage();
    saveReactionFavorites(storage, ['🫶', '🔥', '👏', '💃']);
    expect(loadReactionFavorites(storage)).toEqual(['🫶', '🔥', '👏', '💃']);
  });
});
