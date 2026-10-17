import { mergeItems } from '../model/library';
import { callBridge } from './bridge';
import type { RefreshResult } from './messages';
import { libraryValue, orgStore } from './store';

/** How long an imported library is considered fresh. */
export const LIBRARY_TTL_MS = 60 * 60 * 1000;

let inFlight: Promise<RefreshResult> | undefined;

/** Re-reads subscriptions and playlists from YouTube. Must run in a YouTube tab's content script. */
export function refreshLibrary(): Promise<RefreshResult> {
  inFlight ??= (async () => {
    try {
      const fresh = await callBridge('fetchLibrary', []);
      const [prev, org] = await Promise.all([libraryValue.get(), orgStore.load()]);
      // An empty answer while we know of many items is far more likely a broken
      // fetch than a user who unsubscribed from everything; keep what we have.
      const keep = (prevLen: number, freshLen: number) => freshLen === 0 && prevLen > 5;
      await libraryValue.set({
        channels: keep(prev.channels.length, fresh.channels.length) ? prev.channels : mergeItems(prev.channels, fresh.channels, org),
        playlists: keep(prev.playlists.length, fresh.playlists.length) ? prev.playlists : mergeItems(prev.playlists, fresh.playlists, org),
        fetchedAt: Date.now(),
        error: fresh.partial ? 'YouTube only returned part of your library; long lists may be incomplete.' : undefined,
      });
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await libraryValue.set({ ...(await libraryValue.get()), error });
      return { ok: false, error };
    } finally {
      inFlight = undefined;
    }
  })();
  return inFlight;
}

export async function refreshLibraryIfStale(): Promise<void> {
  const lib = await libraryValue.get();
  if (!lib.fetchedAt || Date.now() - lib.fetchedAt > LIBRARY_TTL_MS) await refreshLibrary();
}
