import { describe, expect, it } from 'vitest';
import { roomCodeFromSearch, remoteJoinUrl, roleFromSearch } from './remoteJoin';

describe('remoteJoinUrl', () => {
  it('links directly to remote mode for the current room', () => {
    expect(remoteJoinUrl('https://karaoke.example', 'S4VJ')).toBe(
      'https://karaoke.example/join?code=S4VJ&role=remote',
    );
  });
});

describe('roomCodeFromSearch', () => {
  it('prefills an uppercase room code from a QR deep link', () => {
    expect(roomCodeFromSearch('?code=s4vj&role=remote')).toBe('S4VJ');
  });
});

describe('roleFromSearch', () => {
  it('returns remote for QR deep links', () => {
    expect(roleFromSearch('?role=remote')).toBe('remote');
  });

  it('ignores unsupported role values', () => {
    expect(roleFromSearch('?role=player')).toBeUndefined();
  });
});
