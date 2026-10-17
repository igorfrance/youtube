import { describe, expect, test } from 'bun:test';
import {
  extractChannels,
  extractContinuations,
  extractInitialData,
  extractPlaylists,
  InnertubeClient,
  parseChannelFeed,
  sapisidHash,
} from './index';

const CH1 = 'UC' + 'a'.repeat(22);
const CH2 = 'UC' + 'b'.repeat(22);

const channelRenderer = (id: string, title: string, handle?: string) => ({
  channelRenderer: {
    channelId: id,
    title: { simpleText: title },
    thumbnail: { thumbnails: [{ url: '//yt3.ggpht.com/small' }, { url: '//yt3.ggpht.com/big' }] },
    navigationEndpoint: { browseEndpoint: { browseId: id, canonicalBaseUrl: handle ? `/${handle}` : undefined } },
  },
});

const subsPage = (items: unknown[], token?: string) => ({
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [
        { itemSectionRenderer: { contents: [{ shelfRenderer: { content: { expandedShelfContentsRenderer: { items } } } }] } },
        ...(token ? [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } }] : []),
      ] } } } }],
    },
  },
});

describe('extractChannels', () => {
  test('reads channelRenderer wherever it is nested', () => {
    const items = extractChannels(subsPage([channelRenderer(CH1, 'Kitchen Notes', '@kitchennotes'), channelRenderer(CH2, 'Bench Tested')]));
    expect(items).toEqual([
      { id: CH1, kind: 'channel', title: 'Kitchen Notes', thumbnail: 'https://yt3.ggpht.com/big', url: '/@kitchennotes', handle: '@kitchennotes' },
      { id: CH2, kind: 'channel', title: 'Bench Tested', thumbnail: 'https://yt3.ggpht.com/big', url: `/channel/${CH2}`, handle: undefined },
    ]);
  });

  test('reads guide entries and ignores non-channel ones', () => {
    const guide = { items: [
      { guideEntryRenderer: { formattedTitle: { simpleText: 'Home' }, navigationEndpoint: { browseEndpoint: { browseId: 'FEwhat_to_watch' } } } },
      { guideEntryRenderer: { formattedTitle: { simpleText: 'Synth Diaries' }, navigationEndpoint: { browseEndpoint: { browseId: CH1, canonicalBaseUrl: '/@synth' } } } },
    ] };
    expect(extractChannels(guide).map((c) => [c.id, c.title, c.handle])).toEqual([[CH1, 'Synth Diaries', '@synth']]);
  });
});

describe('extractPlaylists', () => {
  test('reads lockupViewModel playlists', () => {
    const data = { items: [{ lockupViewModel: {
      contentId: 'PL123',
      contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST',
      contentImage: { collectionThumbnailViewModel: { primaryThumbnail: { thumbnailViewModel: {
        image: { sources: [{ url: 'https://i.ytimg.com/pl.jpg' }] },
        overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: '1,204 videos' } }] } }],
      } } } },
      metadata: { lockupMetadataViewModel: {
        title: { content: 'Morning mobility' },
        metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: 'Igor' } }, { text: { content: 'Playlist' } }] }] } },
      } },
    } }, { lockupViewModel: { contentId: 'vid', contentType: 'LOCKUP_CONTENT_TYPE_VIDEO' } }] };
    expect(extractPlaylists(data)).toEqual([{
      id: 'PL123', kind: 'playlist', title: 'Morning mobility', thumbnail: 'https://i.ytimg.com/pl.jpg',
      url: '/playlist?list=PL123', owner: 'Igor', videoCount: 1204,
    }]);
  });

  test('reads legacy gridPlaylistRenderer', () => {
    const data = { gridPlaylistRenderer: { playlistId: 'PLx', title: { runs: [{ text: 'Rust ' }, { text: 'course' }] }, videoCountText: { runs: [{ text: '30' }, { text: ' videos' }] } } };
    const [p] = extractPlaylists({ items: [data] });
    expect(p).toMatchObject({ id: 'PLx', title: 'Rust course', videoCount: 30 });
  });
});

test('extractContinuations finds tokens', () => {
  expect(extractContinuations(subsPage([], 'tok1'))).toEqual(['tok1']);
});

test('extractInitialData parses the inline script', () => {
  const html = `<html><script>var ytInitialData = {"a":{"b":"};</script>"}};</script></html>`;
  expect(extractInitialData(html)).toEqual({ a: { b: '};</script>' } });
});

test('sapisidHash matches the known format', async () => {
  const h = await sapisidHash('abc', 'https://www.youtube.com', 1_700_000_000_000);
  expect(h).toMatch(/^SAPISIDHASH 1700000000_[0-9a-f]{40}$/);
});

test('InnertubeClient follows continuations and signs requests', async () => {
  const calls: { url: string; body: Record<string, unknown>; auth?: string }[] = [];
  const pages: Record<string, unknown> = {
    FEchannels: subsPage([channelRenderer(CH1, 'One')], 'next'),
    next: subsPage([channelRenderer(CH2, 'Two')]),
  };
  const client = new InnertubeClient(
    { context: { client: {} }, origin: 'https://www.youtube.com', sapisid: 'sid', apiKey: 'k' },
    async (url, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url, body, auth: (init?.headers as Record<string, string>).Authorization });
      return new Response(JSON.stringify(pages[body.browseId ?? body.continuation]));
    },
  );
  const subs = await client.fetchSubscriptions();
  expect(subs.map((s) => s.title)).toEqual(['One', 'Two']);
  expect(calls).toHaveLength(2);
  expect(calls[0]!.url).toBe('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&key=k');
  expect(calls[0]!.auth).toStartWith('SAPISIDHASH ');
  expect(calls[1]!.body.continuation).toBe('next');
});

test('parseChannelFeed reads entries', () => {
  const xml = `<?xml version="1.0"?><feed><title>Kitchen Notes</title>
  <entry><id>yt:video:abc</id><yt:videoId>abc</yt:videoId><yt:channelId>${CH1}</yt:channelId>
  <title>Bread &amp; butter</title><link rel="alternate" href="https://www.youtube.com/shorts/abc"/>
  <author><name>Kitchen Notes</name></author><published>2026-10-01T10:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i.ytimg.com/vi/abc/hq.jpg" width="480"/><media:community><media:statistics views="1234"/></media:community></media:group></entry>
  </feed>`;
  expect(parseChannelFeed(xml)).toEqual([{
    videoId: 'abc', channelId: CH1, channelTitle: 'Kitchen Notes', title: 'Bread & butter',
    published: Date.parse('2026-10-01T10:00:00Z'), thumbnail: 'https://i.ytimg.com/vi/abc/hq.jpg', views: 1234, isShort: true,
  }]);
});

test('playlistVideoIds pages through VL browse results', async () => {
  const pages: Record<string, unknown> = {
    VLPL1: { contents: [{ playlistVideoRenderer: { videoId: 'a' } }, { playlistVideoRenderer: { videoId: 'b' } }, { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 't2' } } } }] },
    t2: { items: [{ playlistVideoRenderer: { videoId: 'c' } }, { playlistVideoRenderer: { videoId: 'a' } }] },
  };
  const client = new InnertubeClient({ context: {}, origin: 'https://www.youtube.com' }, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(pages[body.browseId ?? body.continuation]));
  });
  expect(await client.playlistVideoIds('PL1')).toEqual(['a', 'b', 'c']);
});

test('removePlaylist falls back to un-saving playlists the user does not own', async () => {
  const calls: string[] = [];
  const client = new InnertubeClient({ context: {}, origin: 'https://www.youtube.com' }, async (url) => {
    const endpoint = new URL(url).pathname.replace('/youtubei/v1/', '');
    calls.push(endpoint);
    return new Response('{}', { status: endpoint === 'playlist/delete' ? 403 : 200 });
  });
  expect(await client.removePlaylist('PLother')).toBe('unsaved');
  expect(calls).toEqual(['playlist/delete', 'like/removelike']);
  await expect(client.removePlaylist('WL')).rejects.toThrow('built-in');
});
