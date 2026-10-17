import { describe, expect, test } from 'bun:test';
import { mergePlaylists } from './merge';

/** In-memory stand-in for the YouTube client. */
function fakeClient(playlists: Record<string, string[]>, opts: { dropOnAdd?: string[] } = {}) {
  const log: string[] = [];
  let n = 0;
  return {
    playlists,
    log,
    async playlistVideoIds(id: string) {
      if (!playlists[id]) throw new Error(`no playlist ${id}`);
      return [...playlists[id]];
    },
    async createPlaylist(title: string) {
      const id = `NEW${++n}`;
      playlists[id] = [];
      log.push(`create ${title}`);
      return id;
    },
    async addVideos(id: string, videos: string[]) {
      playlists[id]!.push(...videos.filter((v) => !opts.dropOnAdd?.includes(v)));
      log.push(`add ${id} ${videos.join(',')}`);
    },
    async removePlaylist(id: string) {
      delete playlists[id];
      log.push(`remove ${id}`);
      return 'deleted' as const;
    },
  };
}

describe('mergePlaylists', () => {
  test('into a new playlist: dedupes in source order and removes all sources', async () => {
    const c = fakeClient({ A: ['1', '2'], B: ['2', '3'] });
    const r = await mergePlaylists(c, ['A', 'B'], { create: { title: 'Both', privacy: 'PRIVATE' } });
    expect(r).toEqual({ targetId: 'NEW1', created: true, added: 3, removed: ['A', 'B'], kept: [] });
    expect(c.playlists).toEqual({ NEW1: ['1', '2', '3'] });
  });

  test('into one of the selected playlists: keeps it and skips what it already has', async () => {
    const c = fakeClient({ A: ['1', '2'], B: ['2', '3'], C: ['4'] });
    const r = await mergePlaylists(c, ['A', 'B', 'C'], { existing: 'B' });
    expect(r.removed).toEqual(['A', 'C']);
    expect(r.kept).toEqual(['B']);
    expect(c.playlists).toEqual({ B: ['2', '3', '1', '4'] });
  });

  test('into an existing playlist that was not selected', async () => {
    const c = fakeClient({ A: ['1'], T: ['9'] });
    const r = await mergePlaylists(c, ['A'], { existing: 'T' });
    expect(r.removed).toEqual(['A']);
    expect(c.playlists).toEqual({ T: ['9', '1'] });
  });

  test('never removes built-in playlists like Watch later', async () => {
    const c = fakeClient({ WL: ['1'], A: ['2'] });
    const r = await mergePlaylists(c, ['WL', 'A'], { create: { title: 'x', privacy: 'PRIVATE' } });
    expect(r.removed).toEqual(['A']);
    expect(r.kept).toEqual(['WL']);
    expect(c.playlists.WL).toEqual(['1']);
  });

  test('keeps the sources when videos fail to arrive', async () => {
    const vids = Array.from({ length: 20 }, (_, i) => `v${i}`);
    const c = fakeClient({ A: vids }, { dropOnAdd: vids.slice(0, 10) });
    await expect(mergePlaylists(c, ['A'], { create: { title: 'x', privacy: 'PRIVATE' } })).rejects.toThrow('original playlists were kept');
    expect(c.playlists.A).toEqual(vids);
    expect(c.log.some((l) => l.startsWith('remove'))).toBe(false);
  });

  test('refuses before changing anything when the result would exceed 5000 videos', async () => {
    const big = (p: string) => Array.from({ length: 2600 }, (_, i) => `${p}${i}`);
    const c = fakeClient({ A: big('a'), B: big('b') });
    await expect(mergePlaylists(c, ['A', 'B'], { create: { title: 'x', privacy: 'PRIVATE' } })).rejects.toThrow('at most 5000');
    expect(c.log).toEqual([]);
  });
});
