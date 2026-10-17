/**
 * Typed storage for extensions.
 *
 * `SyncedStore` keeps a value in `chrome.storage.local` (the working copy,
 * fast and roomy) and mirrors it into `chrome.storage.sync` so it follows the
 * user's Chrome profile. Sync allows only ~8 KB per key, so the mirror is
 * split into numbered shards plus a small meta record.
 */

/** The subset of `chrome.storage.StorageArea` we use; easy to fake in tests. */
export interface Area {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export type ChangeListener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void;
export interface ChangeSource {
  addListener(cb: ChangeListener): void;
  removeListener(cb: ChangeListener): void;
}

interface Envelope<T> {
  v: number;
  updatedAt: number;
  data: T;
}
interface SyncMeta {
  v: number;
  updatedAt: number;
  shards: number;
}

/** chrome.storage.sync's per-item limit is 8192 bytes including the key; leave headroom. */
const SHARD_BYTES = 7000;

/** Splits `s` so each piece, once JSON-encoded as a stored string, stays under `max` bytes. */
export function splitForSync(s: string, max = SHARD_BYTES): string[] {
  const enc = new TextEncoder();
  const out: string[] = [];
  let start = 0;
  let size = 2; // the surrounding quotes
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const n = enc.encode(JSON.stringify(ch)).length - 2;
    if (size + n > max) {
      out.push(s.slice(start, i));
      start = i;
      size = 2;
    }
    size += n;
    i += ch.length;
  }
  out.push(s.slice(start));
  return out;
}

export interface SyncedStoreOptions<T> {
  key: string;
  version: number;
  empty: () => T;
  /** Upgrades data saved by an older version. */
  migrate?: (data: unknown, fromVersion: number) => T;
  local: Area;
  /** Omit to keep the value on this device only. */
  sync?: Area;
  changes?: ChangeSource;
  /** Delay before mirroring a save into sync, to batch quick edits. */
  syncDelayMs?: number;
}

export class SyncedStore<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Envelope<T> | undefined;
  /** Last error from writing to sync (usually the quota); local data is still saved. */
  syncError: string | undefined;

  constructor(private readonly o: SyncedStoreOptions<T>) {}

  private get metaKey() {
    return `${this.o.key}:meta`;
  }
  private shardKey(i: number) {
    return `${this.o.key}:${i}`;
  }

  private upgrade(env: Envelope<unknown>): T {
    if (env.v === this.o.version) return env.data as T;
    if (!this.o.migrate) throw new Error(`No migration from v${env.v} to v${this.o.version}`);
    return this.o.migrate(env.data, env.v);
  }

  private async readLocal(): Promise<Envelope<unknown> | undefined> {
    return (await this.o.local.get(this.o.key))[this.o.key] as Envelope<unknown> | undefined;
  }

  private async readSync(): Promise<Envelope<unknown> | undefined> {
    if (!this.o.sync) return undefined;
    const meta = (await this.o.sync.get(this.metaKey))[this.metaKey] as SyncMeta | undefined;
    if (!meta) return undefined;
    const keys = Array.from({ length: meta.shards }, (_, i) => this.shardKey(i));
    const got = await this.o.sync.get(keys);
    if (keys.some((k) => typeof got[k] !== 'string')) return undefined; // a write is mid-flight
    try {
      return { v: meta.v, updatedAt: meta.updatedAt, data: JSON.parse(keys.map((k) => got[k]).join('')) };
    } catch {
      return undefined;
    }
  }

  /** Loads the newest of the local copy and the synced copy. */
  async load(): Promise<T> {
    const [local, synced] = await Promise.all([this.readLocal(), this.readSync()]);
    if (synced && (!local || synced.updatedAt > local.updatedAt)) {
      const data = this.upgrade(synced);
      await this.o.local.set({ [this.o.key]: { v: this.o.version, updatedAt: synced.updatedAt, data } });
      return data;
    }
    return local ? this.upgrade(local) : this.o.empty();
  }

  async save(data: T): Promise<void> {
    const env: Envelope<T> = { v: this.o.version, updatedAt: Date.now(), data };
    await this.o.local.set({ [this.o.key]: env });
    if (!this.o.sync) return;
    this.pending = env;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.o.syncDelayMs ?? 1000);
  }

  /** Writes any pending change to sync now. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const env = this.pending;
    this.pending = undefined;
    if (!env || !this.o.sync) return;
    const shards = splitForSync(JSON.stringify(env.data));
    const prev = (await this.o.sync.get(this.metaKey))[this.metaKey] as SyncMeta | undefined;
    try {
      const items: Record<string, unknown> = {};
      shards.forEach((s, i) => (items[this.shardKey(i)] = s));
      items[this.metaKey] = { v: env.v, updatedAt: env.updatedAt, shards: shards.length } satisfies SyncMeta;
      await this.o.sync.set(items);
      if (prev && prev.shards > shards.length) {
        await this.o.sync.remove(Array.from({ length: prev.shards - shards.length }, (_, i) => this.shardKey(shards.length + i)));
      }
      this.syncError = undefined;
    } catch (e) {
      this.syncError = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * Calls `cb` whenever the value changes: in another context of this
   * extension, or (when `sync` is set) on another device.
   */
  subscribe(cb: (data: T) => void): () => void {
    if (!this.o.changes) return () => {};
    const listener: ChangeListener = (changes, area) => {
      if (area === 'local' && changes[this.o.key]?.newValue) {
        cb(this.upgrade(changes[this.o.key]!.newValue as Envelope<unknown>));
      } else if (area === 'sync' && changes[this.metaKey]) {
        // Another device wrote: pull it into the local copy (which fires the branch above).
        void this.load();
      }
    };
    this.o.changes.addListener(listener);
    return () => this.o.changes!.removeListener(listener);
  }
}

/** A plain value in local storage, for caches that should never sync. */
export class LocalValue<T> {
  constructor(
    private readonly area: Area,
    readonly key: string,
    private readonly fallback: () => T,
  ) {}
  async get(): Promise<T> {
    return ((await this.area.get(this.key))[this.key] as T | undefined) ?? this.fallback();
  }
  set(value: T): Promise<void> {
    return this.area.set({ [this.key]: value });
  }
}

/** In-memory `Area`, for tests and previews. */
export class MemoryArea implements Area {
  readonly data = new Map<string, unknown>();
  constructor(private readonly quotaBytesPerItem = Infinity) {}
  async get(keys: string | string[] | null) {
    const list = keys === null ? [...this.data.keys()] : Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const k of list) if (this.data.has(k)) out[k] = structuredClone(this.data.get(k));
    return out;
  }
  async set(items: Record<string, unknown>) {
    for (const [k, v] of Object.entries(items)) {
      if (new TextEncoder().encode(k + JSON.stringify(v)).length > this.quotaBytesPerItem) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    }
    for (const [k, v] of Object.entries(items)) this.data.set(k, structuredClone(v));
  }
  async remove(keys: string | string[]) {
    for (const k of Array.isArray(keys) ? keys : [keys]) this.data.delete(k);
  }
}
