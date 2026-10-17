import type { LibraryItem } from '@yt/shared';
import { extractChannels, extractContinuations, extractInitialData, extractPlaylists, extractPlaylistVideoIds } from './extract';

/**
 * What the client needs from the page's `ytcfg`. Only readable from the
 * page's main world, so the extension's main-world script collects it.
 */
export interface InnertubeConfig {
  apiKey?: string;
  /** `ytcfg.get('INNERTUBE_CONTEXT')`, sent as `context` with every request. */
  context: Record<string, unknown>;
  clientName?: string | number;
  clientVersion?: string;
  sessionIndex?: string | number;
  delegatedSessionId?: string;
  /** Value of the `SAPISID` (or `__Secure-3PAPISID`) cookie; signs requests for the logged-in user. */
  sapisid?: string;
  origin: string;
}

export const BROWSE_SUBSCRIPTIONS = 'FEchannels';
export const BROWSE_PLAYLISTS = 'FEplaylist_aggregation';

/** Watch later and Liked videos: listed with playlists but can't be deleted. */
export const SYSTEM_PLAYLISTS = new Set(['WL', 'LL']);
/** YouTube's cap on videos in one playlist. */
export const PLAYLIST_MAX_VIDEOS = 5000;
const ADD_BATCH = 50;

export type PlaylistPrivacy = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The `Authorization` header YouTube's web client sends for signed-in requests. */
export async function sapisidHash(sapisid: string, origin: string, now = Date.now()): Promise<string> {
  const ts = Math.floor(now / 1000);
  return `SAPISIDHASH ${ts}_${await sha1Hex(`${ts} ${sapisid} ${origin}`)}`;
}

export class InnertubeClient {
  constructor(
    private readonly cfg: InnertubeConfig,
    private readonly fetchFn: Fetch = (i, init) => fetch(i, init),
    /** Hard stop for paging, so a parsing bug can never loop forever. */
    private readonly maxPages = 50,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Origin': this.cfg.origin,
      'X-Goog-AuthUser': String(this.cfg.sessionIndex ?? 0),
    };
    if (this.cfg.clientName !== undefined) h['X-Youtube-Client-Name'] = String(this.cfg.clientName);
    if (this.cfg.clientVersion) h['X-Youtube-Client-Version'] = this.cfg.clientVersion;
    if (this.cfg.delegatedSessionId) h['X-Goog-PageId'] = this.cfg.delegatedSessionId;
    if (this.cfg.sapisid) h.Authorization = await sapisidHash(this.cfg.sapisid, this.cfg.origin);
    return h;
  }

  /** POSTs to an InnerTube endpoint (e.g. `browse`, `playlist/create`) as the signed-in user. */
  async post(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const key = this.cfg.apiKey ? `&key=${encodeURIComponent(this.cfg.apiKey)}` : '';
    const res = await this.fetchFn(`${this.cfg.origin}/youtubei/v1/${endpoint}?prettyPrint=false${key}`, {
      method: 'POST',
      credentials: 'include',
      headers: await this.headers(),
      body: JSON.stringify({ context: this.cfg.context, ...body }),
    });
    if (!res.ok) throw new Error(`YouTube ${endpoint} failed: HTTP ${res.status}`);
    return res.json();
  }

  browse(params: { browseId: string } | { continuation: string }): Promise<unknown> {
    return this.post('browse', params);
  }

  /** Fetches a browse page and follows every continuation. */
  private async collect(browseId: string, extract: (d: unknown) => LibraryItem[]): Promise<LibraryItem[]> {
    const items = new Map<string, LibraryItem>();
    const seen = new Set<string>();
    let queue: string[] = [];
    const take = (data: unknown) => {
      for (const it of extract(data)) items.set(it.id, it);
      queue.push(...extractContinuations(data).filter((t) => !seen.has(t)));
    };
    take(await this.browse({ browseId }));
    for (let page = 0; queue.length && page < this.maxPages; page++) {
      const token = queue.shift()!;
      seen.add(token);
      take(await this.browse({ continuation: token }));
      queue = queue.filter((t) => !seen.has(t));
    }
    return [...items.values()];
  }

  fetchSubscriptions(): Promise<LibraryItem[]> {
    return this.collect(BROWSE_SUBSCRIPTIONS, extractChannels);
  }

  fetchPlaylists(): Promise<LibraryItem[]> {
    return this.collect(BROWSE_PLAYLISTS, extractPlaylists);
  }

  // --- Changes to the user's account --------------------------------------

  async unsubscribe(channelId: string): Promise<void> {
    await this.post('subscription/unsubscribe', { channelIds: [channelId] });
  }

  /**
   * Removes a playlist from the user's library: deletes it if the user owns
   * it, otherwise un-saves it (someone else's playlist can't be deleted).
   */
  async removePlaylist(playlistId: string): Promise<'deleted' | 'unsaved'> {
    if (SYSTEM_PLAYLISTS.has(playlistId)) throw new Error(`${playlistId} is a built-in playlist and can't be removed`);
    try {
      await this.post('playlist/delete', { playlistId });
      return 'deleted';
    } catch (e) {
      try {
        await this.post('like/removelike', { target: { playlistId } });
        return 'unsaved';
      } catch {
        throw e;
      }
    }
  }

  /** Video ids in a playlist, in playlist order, following every continuation. */
  async playlistVideoIds(playlistId: string): Promise<string[]> {
    const ids: string[] = [];
    const seen = new Set<string>();
    const take = (data: unknown) => {
      for (const id of extractPlaylistVideoIds(data)) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      return extractContinuations(data);
    };
    let queue = take(await this.browse({ browseId: `VL${playlistId}` }));
    const done = new Set<string>();
    for (let page = 0; queue.length && page < this.maxPages * 4; page++) {
      const token = queue.shift()!;
      done.add(token);
      queue.push(...take(await this.browse({ continuation: token })));
      queue = queue.filter((t) => !done.has(t));
    }
    return ids;
  }

  /** Creates a playlist and returns its id. */
  async createPlaylist(title: string, privacy: PlaylistPrivacy = 'PRIVATE'): Promise<string> {
    const res = await this.post('playlist/create', { title, privacyStatus: privacy });
    const id = res.playlistId;
    if (typeof id !== 'string') throw new Error('YouTube did not return the new playlist');
    return id;
  }

  /** Appends videos to a playlist, in batches. */
  async addVideos(playlistId: string, videoIds: string[], onProgress?: (added: number) => void): Promise<void> {
    for (let i = 0; i < videoIds.length; i += ADD_BATCH) {
      const actions = videoIds.slice(i, i + ADD_BATCH).map((addedVideoId) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId }));
      const res = await this.post('browse/edit_playlist', { playlistId, actions });
      if (typeof res.status === 'string' && res.status !== 'STATUS_SUCCEEDED') throw new Error(`Adding videos failed: ${res.status}`);
      onProgress?.(Math.min(i + ADD_BATCH, videoIds.length));
    }
  }
}

/**
 * Fallback when InnerTube calls fail: load the page HTML and read the first
 * batch of items from `ytInitialData`. Long lists may be incomplete.
 */
export async function fetchFromPageHtml(
  path: '/feed/channels' | '/feed/playlists',
  origin: string,
  fetchFn: Fetch = (i, init) => fetch(i, init),
): Promise<LibraryItem[]> {
  const res = await fetchFn(`${origin}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`YouTube page fetch failed: HTTP ${res.status}`);
  const data = extractInitialData(await res.text());
  if (!data) throw new Error('Could not find ytInitialData in page');
  return path === '/feed/channels' ? extractChannels(data) : extractPlaylists(data);
}
