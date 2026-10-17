import type { ChannelId, FeedVideo } from '@yt/shared';

/** Public per-channel upload feed: no login, last ~15 uploads. */
export const channelFeedUrl = (channelId: ChannelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]!.trim()) : undefined;
};
const attr = (xml: string, name: string, a: string) => {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*?${a}="([^"]*)"`));
  return m ? decode(m[1]!) : undefined;
};

/**
 * Parses a channel's Atom upload feed. Written with regexes rather than
 * DOMParser because it runs in the extension's service worker, which has none.
 */
export function parseChannelFeed(xml: string): FeedVideo[] {
  const feedTitle = tag(xml.split('<entry>')[0] ?? '', 'title') ?? '';
  const out: FeedVideo[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const videoId = tag(entry!, 'yt:videoId');
    const channelId = tag(entry!, 'yt:channelId');
    if (!videoId || !channelId) continue;
    const href = attr(entry!, 'link', 'href') ?? '';
    const views = attr(entry!, 'media:statistics', 'views');
    out.push({
      videoId,
      channelId,
      channelTitle: tag(entry!, 'name') ?? feedTitle,
      title: tag(entry!, 'title') ?? '',
      published: Date.parse(tag(entry!, 'published') ?? '') || 0,
      thumbnail: attr(entry!, 'media:thumbnail', 'url') ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      views: views ? Number(views) : undefined,
      isShort: href.includes('/shorts/'),
    });
  }
  return out;
}
