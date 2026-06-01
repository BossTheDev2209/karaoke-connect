import type { User } from '@/types/karaoke';

// Supabase presence emits one entry per connection under each key; a single
// user with multiple tabs/connections therefore appears multiple times.
// Collapse to one user per id (latest wins) so the roster shows each person once.
export function dedupePresence(state: Record<string, User[]>): User[] {
  const byId = new Map<string, User>();
  for (const presences of Object.values(state)) {
    if (!Array.isArray(presences)) continue;
    for (const p of presences) {
      if (p && typeof p.id === 'string') byId.set(p.id, p);
    }
  }
  return Array.from(byId.values());
}
