export type HotkeyAction = 'playpause' | 'seekback' | 'seekfwd' | 'prev' | 'next';

// Translate a keyboard event into a transport action, ignoring keystrokes that
// belong to text entry so typing in search never hijacks playback.
export function hotkeyAction(e: KeyboardEvent): HotkeyAction | null {
  const target = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return null;
  if (e.key === ' ' || e.key === 'Spacebar') return 'playpause';
  if (e.key === 'ArrowLeft') return e.shiftKey ? 'prev' : 'seekback';
  if (e.key === 'ArrowRight') return e.shiftKey ? 'next' : 'seekfwd';
  return null;
}
