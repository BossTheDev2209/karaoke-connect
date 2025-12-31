import { AvatarConfig } from '@/types/karaoke';

// Body colors for human silhouettes
export const BODY_COLORS = [
  { id: 'pink', color: '#ec4899', name: 'Pink' },
  { id: 'purple', color: '#a855f7', name: 'Purple' },
  { id: 'blue', color: '#3b82f6', name: 'Blue' },
  { id: 'cyan', color: '#06b6d4', name: 'Cyan' },
  { id: 'green', color: '#22c55e', name: 'Green' },
  { id: 'yellow', color: '#eab308', name: 'Yellow' },
  { id: 'orange', color: '#f97316', name: 'Orange' },
  { id: 'red', color: '#ef4444', name: 'Red' },
];

export const HAIR_STYLES = [
  { id: 'short', name: 'Short' },
  { id: 'long', name: 'Long' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'curly', name: 'Curly' },
  { id: 'bald', name: 'Bald' },
  { id: 'ponytail', name: 'Ponytail' },
] as const;

export const HAIR_COLORS = [
  { id: 'black', color: '#1f2937', name: 'Black' },
  { id: 'brown', color: '#92400e', name: 'Brown' },
  { id: 'blonde', color: '#fcd34d', name: 'Blonde' },
  { id: 'red', color: '#dc2626', name: 'Red' },
  { id: 'blue', color: '#3b82f6', name: 'Blue' },
  { id: 'pink', color: '#ec4899', name: 'Pink' },
  { id: 'purple', color: '#a855f7', name: 'Purple' },
  { id: 'white', color: '#e5e7eb', name: 'White' },
];

export const ACCESSORIES = [
  { id: 'none', name: 'None', emoji: '✖' },
  { id: 'glasses', name: 'Glasses', emoji: '👓' },
  { id: 'headphones', name: 'Headphones', emoji: '🎧' },
  { id: 'hat', name: 'Hat', emoji: '🎩' },
  { id: 'bow', name: 'Bow', emoji: '🎀' },
  { id: 'crown', name: 'Crown', emoji: '👑' },
] as const;

// Generate a unique avatar ID string from config
export function avatarConfigToId(config: AvatarConfig): string {
  return `${config.bodyColor}|${config.hairStyle}|${config.hairColor}|${config.accessory}`;
}

// Parse avatar ID string back to config
export function avatarIdToConfig(id: string): AvatarConfig {
  const [bodyColor, hairStyle, hairColor, accessory] = id.split('|');
  return {
    bodyColor: bodyColor || 'purple',
    hairStyle: (hairStyle as AvatarConfig['hairStyle']) || 'short',
    hairColor: hairColor || 'black',
    accessory: (accessory as AvatarConfig['accessory']) || 'none',
  };
}

// Generate a random avatar config
export function generateRandomAvatar(): AvatarConfig {
  return {
    bodyColor: BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)].id,
    hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].id,
    hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id,
    accessory: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)].id,
  };
}

// Check if avatar config is unique among existing users
export function isAvatarUnique(avatarId: string, existingAvatarIds: string[]): boolean {
  return !existingAvatarIds.includes(avatarId);
}

// Get color by ID
export function getBodyColorValue(id: string): string {
  return BODY_COLORS.find(c => c.id === id)?.color || '#a855f7';
}

export function getHairColorValue(id: string): string {
  return HAIR_COLORS.find(c => c.id === id)?.color || '#1f2937';
}
