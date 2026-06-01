// Pure re-ranking logic for the "Karaoke" search mode. The provider list is a
// soft ranking signal (not a hardcoded lyric/title map): results from known
// karaoke channels and titles flagged karaoke/instrumental float to the top.

export interface RankItem {
  videoId: string;
  title: string;
  channelTitle: string;
  [k: string]: unknown;
}

// Well-known karaoke / instrumental YouTube channels (lowercased substrings).
export const KARAOKE_PROVIDERS = [
  'sing king',
  'singking',
  'karafun',
  'karaoke version',
  'stingray karaoke',
  'zoom karaoke',
  'sing2piano',
  'piano karaoke',
  'lucky voice',
  'karaoke mugen',
  'kanto karaoke',
  'atomik karaoke',
  'musisi karaoke',
  'aff karaoke',
  'midas karaoke',
  'genie music karaoke',
  'kpop karaoke',
  'thai karaoke',
  'extra karaoke',
  'gmm grammy karaoke',
  'นานา คาราโอเกะ',
  'karaoke',
];

const TITLE_HINT =
  /\b(karaoke|instrumental|backing track|sing along|off vocal|minus one|cover version|คาราโอเกะ)\b/i;

export function karaokeScore(item: RankItem): number {
  let s = 0;
  const ch = (item.channelTitle || '').toLowerCase();
  if (KARAOKE_PROVIDERS.some((p) => ch.includes(p))) s += 2;
  if (TITLE_HINT.test(item.title || '')) s += 1;
  return s;
}

// Stable sort: karaoke-relevant first, original API order preserved within ties.
export function rankForKaraoke<T extends RankItem>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i, s: karaokeScore(item) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}
