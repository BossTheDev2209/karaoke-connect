import type { LyricLine, LyricWord } from "@/types/karaoke";

const LINE_TAG = /\[(\d{2}):(\d{2})\.(\d{2})\]/;
const WORD_TAG = /<(\d{2}):(\d{2})\.(\d{2})>/g;

function toSeconds(m: number, s: number, cs: number): number {
  return m * 60 + s + cs / 100;
}

export function parseSyncedLyrics(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const line = raw.trimEnd();
    const tag = line.match(LINE_TAG);
    if (!tag) continue; // skip [ar:]/[ti:]/blank metadata
    const time = toSeconds(+tag[1], +tag[2], +tag[3]);
    const rest = line.slice(tag[0].length);

    if (rest.includes("<")) {
      const words: LyricWord[] = [];
      // split on word tags, keeping the times
      const parts = rest.split(WORD_TAG); // [pre, m,s,cs, word, m,s,cs, word, ...]
      // parts[0] is any text before the first tag (usually empty)
      for (let i = 1; i < parts.length; i += 4) {
        const wTime = toSeconds(+parts[i], +parts[i + 1], +parts[i + 2]);
        const text = (parts[i + 3] ?? "").trim();
        if (text) words.push({ time: wTime, text });
      }
      const text = words.map((w) => w.text).join(" ");
      if (text) out.push({ time, text, words });
    } else {
      const text = rest.trim();
      if (text) out.push({ time, text });
    }
  }
  return out;
}

export function parsePlainLyrics(plain: string): LyricLine[] {
  return plain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ time: 0, text }));
}
