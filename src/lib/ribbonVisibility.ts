export interface RibbonVisibilityState {
  zoneHovered: boolean;
  ribbonHovered: boolean;
  focusWithin: boolean;
  touchOpen: boolean;
}

export const RIBBON_HIDE_DELAY_MS = 600;

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
