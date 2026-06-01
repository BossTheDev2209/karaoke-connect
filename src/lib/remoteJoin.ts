import type { RoomRole } from '@/types/karaoke';

export function remoteJoinUrl(origin: string, roomCode: string): string {
  return `${origin.replace(/\/$/, '')}/join?code=${encodeURIComponent(roomCode)}&role=remote`;
}

export function roomCodeFromSearch(search: string): string {
  return new URLSearchParams(search).get('code')?.toUpperCase() ?? '';
}

export function roleFromSearch(search: string): RoomRole | undefined {
  return new URLSearchParams(search).get('role') === 'remote' ? 'remote' : undefined;
}
