import type { Song, PlaybackState } from "@/types/karaoke";

export interface SnapshotRow {
  code: string;
  queue: Song[];
  playback: PlaybackState;
}

export function toSnapshotRow(code: string, queue: Song[], playback: PlaybackState): SnapshotRow {
  return { code, queue, playback };
}

export function fromSnapshotRow(row: unknown): SnapshotRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.code !== "string" || !Array.isArray(r.queue) || !r.playback) return null;
  return { code: r.code, queue: r.queue as Song[], playback: r.playback as PlaybackState };
}
