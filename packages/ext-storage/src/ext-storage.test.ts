import { expect, test } from 'bun:test';
import { MemoryArea, splitForSync, SyncedStore } from './index';

const store = (local: MemoryArea, sync: MemoryArea, version = 1, migrate?: (d: unknown, v: number) => { items: string[] }) =>
  new SyncedStore<{ items: string[] }>({ key: 'org', version, empty: () => ({ items: [] }), local, sync, migrate, syncDelayMs: 0 });

test('splitForSync keeps every shard under the byte limit, including multibyte text', () => {
  const s = 'ab"c\\é漢😀'.repeat(3000);
  const shards = splitForSync(s, 1000);
  expect(shards.join('')).toBe(s);
  for (const sh of shards) expect(new TextEncoder().encode(JSON.stringify(sh)).length).toBeLessThanOrEqual(1000);
});

test('saves locally and mirrors large values to sync in shards', async () => {
  const local = new MemoryArea();
  const sync = new MemoryArea(8192);
  const s = store(local, sync);
  const value = { items: Array.from({ length: 2000 }, (_, i) => `UC${String(i).padStart(22, '0')}`) };
  await s.save(value);
  await s.flush();
  expect(s.syncError).toBeUndefined();
  expect((sync.data.get('org:meta') as { shards: number }).shards).toBeGreaterThan(5);

  // A fresh device with only the synced copy gets the same value.
  const other = store(new MemoryArea(), sync);
  expect(await other.load()).toEqual(value);
});

test('removes leftover shards when the value shrinks', async () => {
  const sync = new MemoryArea(8192);
  const s = store(new MemoryArea(), sync);
  await s.save({ items: Array.from({ length: 2000 }, (_, i) => `item-${i}`) });
  await s.flush();
  await s.save({ items: ['one'] });
  await s.flush();
  expect([...sync.data.keys()].sort()).toEqual(['org:0', 'org:meta']);
});

test('prefers whichever copy is newer', async () => {
  const local = new MemoryArea();
  const sync = new MemoryArea();
  const a = store(local, sync);
  await a.save({ items: ['old'] });
  await a.flush();
  await Bun.sleep(5);
  const b = store(new MemoryArea(), sync);
  await b.save({ items: ['new from other device'] });
  await b.flush();
  expect(await a.load()).toEqual({ items: ['new from other device'] });
});

test('migrates data saved by an older version', async () => {
  const local = new MemoryArea();
  await local.set({ org: { v: 1, updatedAt: 1, data: ['x'] } });
  const s = store(local, new MemoryArea(), 2, (d, v) => (v === 1 ? { items: d as string[] } : { items: [] }));
  expect(await s.load()).toEqual({ items: ['x'] });
});
