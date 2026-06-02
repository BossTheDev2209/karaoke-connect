export type ConnectionTone = 'ok' | 'bad';

// Pair status with a word, never color alone (WCAG 1.4.1).
export function connectionStatus(isConnected: boolean): { label: string; tone: ConnectionTone } {
  return isConnected ? { label: 'Live', tone: 'ok' } : { label: 'Reconnecting', tone: 'bad' };
}
