export interface SpeechAlternativeLike {
  transcript?: string;
}

export interface SpeechResultLike {
  isFinal: boolean;
  [alternativeIndex: number]: SpeechAlternativeLike | undefined;
}

export interface SpeechResultsLike {
  length: number;
  [resultIndex: number]: SpeechResultLike | undefined;
}

export interface SpeechResultEventLike {
  resultIndex?: number;
  results: SpeechResultsLike;
}

export const finalTranscriptFromSpeechEvent = (event: SpeechResultEventLike) => {
  const start = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
  const parts: string[] = [];

  for (let index = start; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result?.isFinal) continue;

    const transcript = result[0]?.transcript?.trim();
    if (transcript) parts.push(transcript);
  }

  return parts.join(' ');
};
