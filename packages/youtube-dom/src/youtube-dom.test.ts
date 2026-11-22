import { expect, test } from 'bun:test';
import { navigationEndpoint, pageRef } from './index';

test('pageRef recognises channel and playlist pages', () => {
  const u = (s: string) => new URL(s, 'https://www.youtube.com');
  expect(pageRef(u('/@kitchennotes/videos'))).toEqual({ kind: 'channel', handle: '@kitchennotes' });
  expect(pageRef(u('/@%C3%A9t%C3%A9'))).toEqual({ kind: 'channel', handle: '@été' });
  expect(pageRef(u(`/channel/UC${'x'.repeat(22)}`))).toEqual({ kind: 'channel', channelId: `UC${'x'.repeat(22)}` });
  expect(pageRef(u('/playlist?list=PL123'))).toEqual({ kind: 'playlist', playlistId: 'PL123' });
  expect(pageRef(u('/watch?v=abc&list=PL123'))).toBeNull();
  expect(pageRef(u('/'))).toBeNull();
});

test('navigationEndpoint matches what YouTube puts on its own links', () => {
  const ch = navigationEndpoint({ kind: 'channel', id: `UC${'x'.repeat(22)}` as never, url: '/@kitchennotes' });
  expect(ch.browseEndpoint).toEqual({ browseId: `UC${'x'.repeat(22)}`, canonicalBaseUrl: '/@kitchennotes' });
  expect(ch.commandMetadata).toMatchObject({ webCommandMetadata: { url: '/@kitchennotes', webPageType: 'WEB_PAGE_TYPE_CHANNEL' } });
  const pl = navigationEndpoint({ kind: 'playlist', id: 'PL123' as never, url: '/playlist?list=PL123' });
  expect(pl.browseEndpoint).toEqual({ browseId: 'VLPL123' });
  expect(pl.commandMetadata).toMatchObject({ webCommandMetadata: { url: '/playlist?list=PL123', webPageType: 'WEB_PAGE_TYPE_PLAYLIST' } });
});
