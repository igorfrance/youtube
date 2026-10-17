/** A YouTube channel id, always starting with `UC`. */
export type ChannelId = string;
/** A YouTube playlist id (`PL…`, `OLAK…`, `VL…` stripped, etc.). */
export type PlaylistId = string;

export type ItemKind = 'channel' | 'playlist';

/** Something the user can file into a folder: a subscribed channel or a playlist. */
export interface LibraryItem {
  id: ChannelId | PlaylistId;
  kind: ItemKind;
  title: string;
  /** Avatar (channels) or cover (playlists) URL. */
  thumbnail?: string;
  /** Site-relative URL such as `/@handle` or `/playlist?list=…`. */
  url: string;
  /** Channels: the `@handle`, when YouTube reports one. */
  handle?: string;
  /** Playlists: who owns it, and how many videos it has. */
  owner?: string;
  videoCount?: number;
  /**
   * Set when the item used to be in the user's library but was not in the
   * last successful import (unsubscribed, playlist removed). Kept so folders
   * never silently lose items after a flaky fetch.
   */
  missing?: boolean;
}

/** A recent upload, as shown in a folder feed. */
export interface FeedVideo {
  videoId: string;
  channelId: ChannelId;
  channelTitle: string;
  title: string;
  published: number;
  thumbnail: string;
  views?: number;
  isShort: boolean;
}

export const isChannelId = (id: string): boolean => /^UC[\w-]{22}$/.test(id);

export function itemUrl(item: Pick<LibraryItem, 'kind' | 'id' | 'handle'>): string {
  if (item.kind === 'playlist') return `/playlist?list=${item.id}`;
  return item.handle ? `/${item.handle}` : `/channel/${item.id}`;
}

/**
 * Small fuzzy matcher: every query character must appear in order. Scores
 * favour prefix and word-start matches and tight runs.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 1000 - t.length;
  const idx = t.indexOf(q);
  if (idx >= 0) return (/\W/.test(t[idx - 1] ?? ' ') ? 800 : 600) - idx;
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    run = found === ti ? run + 1 : 0;
    score += 10 + run * 5 + (found === 0 || /\W/.test(t[found - 1]!) ? 15 : 0);
    ti = found + 1;
  }
  return score;
}
