// Pre-made colorful avatars for karaoke users
export const AVATARS = [
  { id: 1, emoji: '🎤', color: 'from-pink-500 to-rose-500', name: 'Singer' },
  { id: 2, emoji: '🎸', color: 'from-purple-500 to-violet-500', name: 'Rocker' },
  { id: 3, emoji: '🎹', color: 'from-blue-500 to-cyan-500', name: 'Keys' },
  { id: 4, emoji: '🥁', color: 'from-orange-500 to-amber-500', name: 'Drummer' },
  { id: 5, emoji: '🎷', color: 'from-green-500 to-emerald-500', name: 'Jazzy' },
  { id: 6, emoji: '🎺', color: 'from-yellow-500 to-lime-500', name: 'Brass' },
  { id: 7, emoji: '🎻', color: 'from-red-500 to-pink-500', name: 'Strings' },
  { id: 8, emoji: '🪗', color: 'from-teal-500 to-cyan-500', name: 'Accordion' },
  { id: 9, emoji: '🎧', color: 'from-indigo-500 to-purple-500', name: 'DJ' },
  { id: 10, emoji: '🪘', color: 'from-amber-500 to-orange-500', name: 'Percussion' },
  { id: 11, emoji: '🎵', color: 'from-fuchsia-500 to-pink-500', name: 'Note' },
  { id: 12, emoji: '🎶', color: 'from-sky-500 to-blue-500', name: 'Melody' },
];

export const getAvatar = (id: number) => {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
};
