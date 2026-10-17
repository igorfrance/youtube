import { expect, test } from 'bun:test';
import { pageRef } from './index';

test('pageRef recognises channel and playlist pages', () => {
  const u = (s: string) => new URL(s, 'https://www.youtube.com');
  expect(pageRef(u('/@kitchennotes/videos'))).toEqual({ kind: 'channel', handle: '@kitchennotes' });
  expect(pageRef(u('/@%C3%A9t%C3%A9'))).toEqual({ kind: 'channel', handle: '@été' });
  expect(pageRef(u(`/channel/UC${'x'.repeat(22)}`))).toEqual({ kind: 'channel', channelId: `UC${'x'.repeat(22)}` });
  expect(pageRef(u('/playlist?list=PL123'))).toEqual({ kind: 'playlist', playlistId: 'PL123' });
  expect(pageRef(u('/watch?v=abc&list=PL123'))).toBeNull();
  expect(pageRef(u('/'))).toBeNull();
});
