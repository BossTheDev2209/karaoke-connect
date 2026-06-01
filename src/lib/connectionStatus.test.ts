import { describe, it, expect } from 'vitest';
import { connectionStatus } from './connectionStatus';

describe('connectionStatus', () => {
  it('reports a live state when connected', () => {
    expect(connectionStatus(true)).toEqual({ label: 'Live', tone: 'ok' });
  });

  it('reports a reconnecting state when disconnected', () => {
    expect(connectionStatus(false)).toEqual({ label: 'Reconnecting', tone: 'bad' });
  });
});
