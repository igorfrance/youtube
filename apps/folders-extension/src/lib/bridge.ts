import type { LibraryItem } from '@yt/shared';
import type { MergeProgress, MergeResult, MergeTarget } from '@yt/youtube-client';

/**
 * The content script runs in an isolated world and cannot see the page's
 * `ytcfg` or navigation data, which signed-in YouTube requests need. A small
 * script in the page's main world (entrypoints/youtube-bridge.content.ts)
 * answers requests over window.postMessage.
 */

export const REQ = 'ytfolders:req';
export const RES = 'ytfolders:res';
export const PROGRESS = 'ytfolders:progress';

/** Outcome of a batch change: which ids succeeded, and why the others failed. */
export interface BatchResult {
  done: string[];
  failed: { id: string; error: string }[];
}

export interface BridgeMethods {
  /** Every subscribed channel and every own/saved playlist. */
  fetchLibrary: () => { channels: LibraryItem[]; playlists: LibraryItem[]; partial: boolean };
  /** The channel or playlist the current page is about, read from the page data. */
  pageItem: () => LibraryItem | null;
  unsubscribe: (channelIds: string[]) => BatchResult;
  /** Deletes own playlists, un-saves other people's. */
  removePlaylists: (playlistIds: string[]) => BatchResult;
  mergePlaylists: (args: { sources: string[]; target: MergeTarget }) => MergeResult;
}

export type BridgeMethod = keyof BridgeMethods;
export type BridgeArgs<M extends BridgeMethod> = Parameters<BridgeMethods[M]>;
export type BridgeRequest = { source: typeof REQ; id: string; method: BridgeMethod; args: unknown[] };
export type BridgeResponse = { source: typeof RES; id: string; result?: unknown; error?: string };
export type BridgeProgress = { source: typeof PROGRESS; id: string; progress: MergeProgress };

/** Calls the main-world bridge. Used from the isolated content script. */
export function callBridge<M extends BridgeMethod>(
  method: M,
  args: BridgeArgs<M>,
  o: { timeoutMs?: number; onProgress?: (p: MergeProgress) => void } = {},
): Promise<ReturnType<BridgeMethods[M]>> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('YouTube page did not answer'));
      }, o.timeoutMs ?? 60_000);
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data as BridgeResponse | BridgeProgress;
      if (e.source !== window || d?.id !== id) return;
      if (d.source === PROGRESS) {
        arm(); // long operations stay alive while they report progress
        o.onProgress?.(d.progress);
        return;
      }
      if (d.source !== RES) return;
      cleanup();
      if (d.error) reject(new Error(d.error));
      else resolve(d.result as ReturnType<BridgeMethods[M]>);
    };
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
    window.addEventListener('message', onMessage);
    arm();
    window.postMessage({ source: REQ, id, method, args } satisfies BridgeRequest, location.origin);
  });
}
