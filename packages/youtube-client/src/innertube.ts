import type { LibraryItem } from '@yt/shared';
import { extractChannels, extractContinuations, extractInitialData, extractPlaylists } from './extract';

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

  async browse(params: { browseId: string } | { continuation: string }): Promise<unknown> {
    const key = this.cfg.apiKey ? `&key=${encodeURIComponent(this.cfg.apiKey)}` : '';
    const res = await this.fetchFn(`${this.cfg.origin}/youtubei/v1/browse?prettyPrint=false${key}`, {
      method: 'POST',
      credentials: 'include',
      headers: await this.headers(),
      body: JSON.stringify({ context: this.cfg.context, ...params }),
    });
    if (!res.ok) throw new Error(`YouTube browse failed: HTTP ${res.status}`);
    return res.json();
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
