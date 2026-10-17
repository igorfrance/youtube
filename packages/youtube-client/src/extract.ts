import { isChannelId, type LibraryItem } from '@yt/shared';

/**
 * YouTube's responses (ytInitialData and InnerTube JSON) are deep, renderer
 * based trees whose exact nesting changes often. Rather than following one
 * fixed path, we walk the whole tree and pick out the renderers we know by
 * their own shape. That survives most layout reshuffles.
 */

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Visits every object in document order, passing the key it sits under.
 * Array elements are passed with the array's key.
 */
function walk(node: Json, visit: (key: string, value: Obj) => void): void {
  const stack: [string, Json][] = [['', node]];
  while (stack.length) {
    const [key, cur] = stack.pop()!;
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) stack.push([key, cur[i]]);
    } else if (isObj(cur)) {
      if (key) visit(key, cur);
      const entries = Object.entries(cur);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [k, v] = entries[i]!;
        if (typeof v === 'object' && v !== null) stack.push([k, v]);
      }
    }
  }
}

/** Reads YouTube's text shapes: `{simpleText}`, `{runs:[{text}]}` or `{content}`. */
export function text(v: Json): string | undefined {
  if (typeof v === 'string') return v;
  if (!isObj(v)) return undefined;
  if (typeof v.simpleText === 'string') return v.simpleText;
  if (typeof v.content === 'string') return v.content;
  if (Array.isArray(v.runs)) return v.runs.map((r) => (isObj(r) && typeof r.text === 'string' ? r.text : '')).join('');
  return undefined;
}

function get(v: Json, ...path: string[]): Json {
  let cur = v;
  for (const p of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Last (largest) thumbnail URL found anywhere under `v`, protocol-fixed. */
function thumbnail(v: Json): string | undefined {
  let found: string | undefined;
  walk({ v }, (_k, o) => {
    if (found) return;
    const list = Array.isArray(o.thumbnails) ? o.thumbnails : Array.isArray(o.sources) ? o.sources : undefined;
    const last = list?.[list.length - 1];
    if (isObj(last) && typeof last.url === 'string') found = last.url;
  });
  return found?.startsWith('//') ? `https:${found}` : found;
}

function countFromText(s: string | undefined): number | undefined {
  const m = s?.match(/(\d[\d,.\s]*)\s*video/i);
  return m ? Number(m[1]!.replace(/[^\d]/g, '')) : undefined;
}

/** Subscribed channels from the subscriptions page (`FEchannels`) or the guide. */
export function extractChannels(data: Json): LibraryItem[] {
  const out = new Map<string, LibraryItem>();
  walk(data, (key, o) => {
    if (key === 'channelRenderer' && typeof o.channelId === 'string') {
      const url = text(get(o, 'navigationEndpoint', 'browseEndpoint', 'canonicalBaseUrl')) ?? `/channel/${o.channelId}`;
      const handle = url.startsWith('/@') ? url.slice(1) : undefined;
      out.set(o.channelId, {
        id: o.channelId,
        kind: 'channel',
        title: text(o.title) ?? o.channelId,
        thumbnail: thumbnail(o.thumbnail),
        url,
        handle,
      });
    } else if (key === 'guideEntryRenderer') {
      const id = get(o, 'navigationEndpoint', 'browseEndpoint', 'browseId');
      if (typeof id !== 'string' || !isChannelId(id) || out.has(id)) return;
      const url = text(get(o, 'navigationEndpoint', 'browseEndpoint', 'canonicalBaseUrl')) ?? `/channel/${id}`;
      out.set(id, {
        id,
        kind: 'channel',
        title: text(o.formattedTitle) ?? text(o.title) ?? id,
        thumbnail: thumbnail(o.thumbnail),
        url,
        handle: url.startsWith('/@') ? url.slice(1) : undefined,
      });
    }
  });
  return [...out.values()];
}

/** The user's own and saved playlists from the playlists page (`FEplaylist_aggregation`) or library. */
export function extractPlaylists(data: Json): LibraryItem[] {
  const out = new Map<string, LibraryItem>();
  walk(data, (key, o) => {
    if (key === 'lockupViewModel' && o.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' && typeof o.contentId === 'string') {
      const meta = get(o, 'metadata', 'lockupMetadataViewModel');
      const rows = get(meta, 'metadata', 'contentMetadataViewModel', 'metadataRows');
      const parts: string[] = [];
      walk({ rows }, (_k, x) => {
        const t = text(x.text);
        if (t) parts.push(t);
      });
      let badge: string | undefined;
      walk({ img: o.contentImage }, (k, x) => {
        if (k === 'thumbnailBadgeViewModel' && typeof x.text === 'string') badge ??= x.text;
      });
      out.set(o.contentId, {
        id: o.contentId,
        kind: 'playlist',
        title: text(get(meta, 'title')) ?? o.contentId,
        thumbnail: thumbnail(o.contentImage),
        url: `/playlist?list=${o.contentId}`,
        owner: parts.find((p) => !/video|updated|view|private|public|unlisted|playlist/i.test(p)),
        videoCount: countFromText(badge) ?? countFromText(parts.join(' ')),
      });
    } else if ((key === 'gridPlaylistRenderer' || key === 'playlistRenderer') && typeof o.playlistId === 'string') {
      out.set(o.playlistId, {
        id: o.playlistId,
        kind: 'playlist',
        title: text(o.title) ?? o.playlistId,
        thumbnail: thumbnail(o.thumbnail ?? o.thumbnails),
        url: `/playlist?list=${o.playlistId}`,
        owner: text(o.shortBylineText) ?? text(o.longBylineText),
        videoCount: countFromText(text(o.videoCountText) ?? text(o.videoCountShortText)) ?? (typeof o.videoCount === 'string' ? Number(o.videoCount) : undefined),
      });
    }
  });
  return [...out.values()];
}

/** Continuation tokens for the next page of results. */
export function extractContinuations(data: Json): string[] {
  const tokens = new Set<string>();
  walk(data, (key, o) => {
    if (key === 'continuationCommand' && typeof o.token === 'string') tokens.add(o.token);
    else if (key === 'nextContinuationData' && typeof o.continuation === 'string') tokens.add(o.continuation);
  });
  return [...tokens];
}

/** Pulls `ytInitialData` out of a YouTube HTML page. */
export function extractInitialData(html: string): Json | undefined {
  const start = html.search(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*\{/);
  if (start < 0) return undefined;
  const from = html.indexOf('{', start);
  // The JSON can itself contain "};</script>" inside strings, so try each candidate end.
  for (let end = html.indexOf('};', from); end >= 0; end = html.indexOf('};', end + 1)) {
    if (!/^\s*<\/script>/.test(html.slice(end + 2, end + 30))) continue;
    try {
      return JSON.parse(html.slice(from, end + 1));
    } catch {
      // keep looking
    }
  }
  return undefined;
}
