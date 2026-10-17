import type { ItemKind, LibraryItem } from '@yt/shared';
import type { OrgState } from './org';

/** The user's channels and playlists as last read from YouTube. Local only. */
export interface Library {
  channels: LibraryItem[];
  playlists: LibraryItem[];
  fetchedAt?: number;
  error?: string;
}

export const emptyLibrary = (): Library => ({ channels: [], playlists: [] });

export const itemsOf = (lib: Library, kind: ItemKind) => (kind === 'channel' ? lib.channels : lib.playlists);

export function findItem(lib: Library, id: string): LibraryItem | undefined {
  return lib.channels.find((c) => c.id === id) ?? lib.playlists.find((p) => p.id === id);
}

/**
 * Combines a fresh import with what we had. Items that disappeared but are
 * still in a folder are kept and flagged `missing`, so a flaky or partial
 * fetch never makes folders lose items. Items in no folder are simply dropped.
 */
export function mergeItems(prev: LibraryItem[], fresh: LibraryItem[], org: OrgState): LibraryItem[] {
  const ids = new Set(fresh.map((i) => i.id));
  const kept = prev.filter((p) => !ids.has(p.id) && (org.placements[p.id]?.length ?? 0) > 0).map((p) => ({ ...p, missing: true }));
  return [...fresh.map(({ missing: _m, ...i }) => i), ...kept].sort((a, b) => a.title.localeCompare(b.title));
}

/** Adds a single item (e.g. a channel the user just filed from its page). */
export function upsertItem(lib: Library, item: LibraryItem): Library {
  const key = item.kind === 'channel' ? 'channels' : 'playlists';
  const list = lib[key].filter((i) => i.id !== item.id);
  return { ...lib, [key]: [...list, item].sort((a, b) => a.title.localeCompare(b.title)) };
}
