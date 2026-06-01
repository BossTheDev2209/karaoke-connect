export interface RibbonVisibilityState {
  zoneHovered: boolean;
  ribbonHovered: boolean;
  focusWithin: boolean;
  touchOpen: boolean;
}

// Near-instant hide on hover-out. The small grace only absorbs the
// hover-zone -> ribbon handoff (both fire in the same tick) so it doesn't flicker.
export const RIBBON_HIDE_DELAY_MS = 120;

export const INITIAL_RIBBON_VISIBILITY: RibbonVisibilityState = {
  zoneHovered: false,
  ribbonHovered: false,
  focusWithin: false,
  touchOpen: false,
};

export function shouldShowRibbon(state: RibbonVisibilityState): boolean {
  return state.zoneHovered || state.ribbonHovered || state.focusWithin || state.touchOpen;
}

export function ribbonTransitionDuration(prefersReducedMotion: boolean): string {
  return prefersReducedMotion ? '0ms' : '160ms';
}
