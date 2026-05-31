import type { LyricLine } from '@/types/karaoke';
import { cn } from '@/lib/utils';

interface SingLyricsProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  currentTime: number;
}

export const SingLyrics = ({ lyrics, currentLineIndex, currentTime }: SingLyricsProps) => {
  const activeLine = lyrics[currentLineIndex];
  const previousLine = lyrics[currentLineIndex - 1];
  const nextLine = lyrics[currentLineIndex + 1];
  const nextLineStartsIn = nextLine ? nextLine.time - currentTime : null;

  if (!activeLine) {
    return <p className="text-center text-lg text-white/45">Timed lyrics unavailable.</p>;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 text-center">
      <p className="text-[clamp(1.25rem,2.2vw,2rem)] font-medium leading-relaxed text-white/25">
        {previousLine?.text ?? ' '}
      </p>
      <p className="text-[clamp(2.2rem,5vw,5rem)] font-semibold leading-[1.15] tracking-[-0.06em] text-white">
        {activeLine.words?.length ? activeLine.words.map((word, index) => (
          <span
            key={`${word.time}-${index}`}
            className={cn('transition-colors', word.time <= currentTime ? 'text-primary' : 'text-white')}
          >
            {word.text}{index < activeLine.words!.length - 1 ? ' ' : ''}
          </span>
        )) : activeLine.text}
      </p>
      <div className="min-h-14">
        <p className="text-[clamp(1.25rem,2.2vw,2rem)] font-medium leading-relaxed text-white/45">
          {nextLine?.text ?? ' '}
        </p>
        {nextLineStartsIn !== null && nextLineStartsIn > 0 && nextLineStartsIn <= 3 && (
          <div className="mt-4 flex justify-center gap-2" aria-label="Next lyric line starting soon">
            {[3, 2, 1].map((second) => (
              <span key={second} className={cn('h-1.5 w-1.5 rounded-full', nextLineStartsIn <= second ? 'bg-primary' : 'bg-white/20')} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
