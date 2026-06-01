import { describe, it, expect } from 'vitest';
import { hotkeyAction } from './playerHotkeys';

const ev = (key: string, shiftKey = false, tag = 'BODY') =>
  ({ key, shiftKey, target: { tagName: tag, isContentEditable: false } } as unknown as KeyboardEvent);

describe('hotkeyAction', () => {
  it('maps space to playpause', () => {
    expect(hotkeyAction(ev(' '))).toBe('playpause');
  });
  it('maps arrows to seek and shift+arrows to track change', () => {
    expect(hotkeyAction(ev('ArrowLeft'))).toBe('seekback');
    expect(hotkeyAction(ev('ArrowRight'))).toBe('seekfwd');
    expect(hotkeyAction(ev('ArrowRight', true))).toBe('next');
    expect(hotkeyAction(ev('ArrowLeft', true))).toBe('prev');
  });
  it('ignores keys typed into inputs or unmapped keys', () => {
    expect(hotkeyAction(ev(' ', false, 'INPUT'))).toBeNull();
    expect(hotkeyAction(ev('a'))).toBeNull();
  });
});
