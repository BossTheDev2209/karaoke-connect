import { describe, expect, it } from 'vitest';
import { finalTranscriptFromSpeechEvent } from './voiceSearch';

describe('finalTranscriptFromSpeechEvent', () => {
  it('joins final transcripts from speech results and skips interim text', () => {
    const transcript = finalTranscriptFromSpeechEvent({
      resultIndex: 0,
      results: {
        length: 3,
        0: { isFinal: false, 0: { transcript: 'ignored draft' } },
        1: { isFinal: true, 0: { transcript: '  hello ' } },
        2: { isFinal: true, 0: { transcript: 'world  ' } },
      },
    });

    expect(transcript).toBe('hello world');
  });

  it('starts from resultIndex when present', () => {
    const transcript = finalTranscriptFromSpeechEvent({
      resultIndex: 1,
      results: {
        length: 2,
        0: { isFinal: true, 0: { transcript: 'old' } },
        1: { isFinal: true, 0: { transcript: 'new' } },
      },
    });

    expect(transcript).toBe('new');
  });
});
