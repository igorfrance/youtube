import type { LibraryItem } from '@yt/shared';

/**
 * The content script runs in an isolated world and cannot see the page's
 * `ytcfg` or navigation data, which signed-in YouTube requests need. A small
 * script in the page's main world (entrypoints/youtube-bridge.content.ts)
 * answers requests over window.postMessage.
 */

export const REQ = 'ytfolders:req';
export const RES = 'ytfolders:res';

export interface BridgeMethods {
  /** Every subscribed channel and every own/saved playlist. */
  fetchLibrary: () => { channels: LibraryItem[]; playlists: LibraryItem[]; partial: boolean };
  /** The channel or playlist the current page is about, read from the page data. */
  pageItem: () => LibraryItem | null;
}

export type BridgeRequest = { source: typeof REQ; id: string; method: keyof BridgeMethods };
export type BridgeResponse = { source: typeof RES; id: string; result?: unknown; error?: string };

/** Calls the main-world bridge. Used from the isolated content script. */
export function callBridge<M extends keyof BridgeMethods>(method: M, timeoutMs = 60_000): Promise<ReturnType<BridgeMethods[M]>> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as BridgeResponse;
      if (e.source !== window || d?.source !== RES || d.id !== id) return;
      cleanup();
      if (d.error) reject(new Error(d.error));
      else resolve(d.result as ReturnType<BridgeMethods[M]>);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('YouTube page did not answer'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ source: REQ, id, method } satisfies BridgeRequest, location.origin);
  });
}
