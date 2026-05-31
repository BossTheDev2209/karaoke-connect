export const REACTION_LIBRARY = ['🔥', '❤️', '👏', '🎉', '✨', '😍', '🎤', '💯', '🙌', '🥹', '😂', '🤘', '🫶', '😭', '😮', '💃'] as const;
export const DEFAULT_REACTION_FAVORITES = ['🔥', '❤️', '👏', '🎉', '✨'] as const;
export const REACTION_FAVORITES_STORAGE_KEY = 'karaoke_reaction_favorites';

const MIN_FAVORITES = 4;
const MAX_FAVORITES = 6;

export function normalizeReactionFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_REACTION_FAVORITES];
  if (value.some((emoji) => typeof emoji !== 'string' || !REACTION_LIBRARY.includes(emoji as typeof REACTION_LIBRARY[number]))) {
    return [...DEFAULT_REACTION_FAVORITES];
  }

  const favorites = [...new Set(value as string[])];

  if (favorites.length < MIN_FAVORITES || favorites.length > MAX_FAVORITES) {
    return [...DEFAULT_REACTION_FAVORITES];
  }

  return favorites;
}

export function loadReactionFavorites(storage: Storage): string[] {
  try {
    const saved = storage.getItem(REACTION_FAVORITES_STORAGE_KEY);
    return saved ? normalizeReactionFavorites(JSON.parse(saved)) : [...DEFAULT_REACTION_FAVORITES];
  } catch {
    return [...DEFAULT_REACTION_FAVORITES];
  }
}

export function saveReactionFavorites(storage: Storage, favorites: string[]): void {
  storage.setItem(REACTION_FAVORITES_STORAGE_KEY, JSON.stringify(normalizeReactionFavorites(favorites)));
}
