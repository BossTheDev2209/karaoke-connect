import { describe, expect, it } from 'vitest';
import {
  INITIAL_RIBBON_VISIBILITY,
  RIBBON_HIDE_DELAY_MS,
  ribbonTransitionDuration,
  shouldShowRibbon,
} from './ribbonVisibility';

describe('ribbon visibility', () => {
  it('starts hidden', () => {
    expect(shouldShowRibbon(INITIAL_RIBBON_VISIBILITY)).toBe(false);
  });

  it('stays visible for zone hover, ribbon hover, focus, or touch toggle', () => {
    for (const key of ['zoneHovered', 'ribbonHovered', 'focusWithin', 'touchOpen'] as const) {
      expect(shouldShowRibbon({ ...INITIAL_RIBBON_VISIBILITY, [key]: true })).toBe(true);
    }
  });

  it('uses instant reduced-motion transition', () => {
    expect(ribbonTransitionDuration(true)).toBe('0ms');
    expect(ribbonTransitionDuration(false)).toBe('160ms');
  });

  it('hides near-instantly after pointer exit (small grace to avoid handoff flicker)', () => {
    expect(RIBBON_HIDE_DELAY_MS).toBe(120);
  });
});
