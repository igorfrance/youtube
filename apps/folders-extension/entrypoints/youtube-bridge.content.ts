import { isChannelId, type LibraryItem } from '@yt/shared';
import { fetchFromPageHtml, InnertubeClient, text, type InnertubeConfig } from '@yt/youtube-client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { REQ, RES, type BridgeMethods, type BridgeRequest, type BridgeResponse } from '../src/lib/bridge';

/**
 * Runs in YouTube's own JavaScript world so it can read `ytcfg` and the data
 * of the current page. Answers requests from the isolated content script.
 */
export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    type Ytcfg = { get?: (k: string) => unknown; data_?: Record<string, unknown> };
    const cfg = (k: string): unknown => {
      const y = (window as unknown as { ytcfg?: Ytcfg }).ytcfg;
      return y?.get?.(k) ?? y?.data_?.[k];
    };
    const cookie = (name: string) =>
      document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

    // YouTube is a single-page app: the data for the current page arrives with
    // each navigation, not in window.ytInitialData (which is only the first page).
    let pageData: unknown = (window as unknown as { ytInitialData?: unknown }).ytInitialData;
    document.addEventListener('yt-navigate-finish', (e) => {
      pageData = (e as CustomEvent<{ response?: { response?: unknown } }>).detail?.response?.response ?? pageData;
    });

    const client = () => {
      const config: InnertubeConfig = {
        apiKey: cfg('INNERTUBE_API_KEY') as string | undefined,
        context: (cfg('INNERTUBE_CONTEXT') as Record<string, unknown>) ?? {},
        clientName: cfg('INNERTUBE_CONTEXT_CLIENT_NAME') as number | undefined,
        clientVersion: cfg('INNERTUBE_CLIENT_VERSION') as string | undefined,
        sessionIndex: cfg('SESSION_INDEX') as string | undefined,
        delegatedSessionId: cfg('DELEGATED_SESSION_ID') as string | undefined,
        sapisid: cookie('SAPISID') ?? cookie('__Secure-3PAPISID'),
        origin: location.origin,
      };
      return new InnertubeClient(config);
    };

    const methods: { [K in keyof BridgeMethods]: () => Promise<ReturnType<BridgeMethods[K]>> } = {
      async fetchLibrary() {
        if (!cfg('LOGGED_IN')) throw new Error('Sign in to YouTube to import your subscriptions.');
        let partial = false;
        const viaApi = async (fn: 'fetchSubscriptions' | 'fetchPlaylists', path: '/feed/channels' | '/feed/playlists') => {
          try {
            return await client()[fn]();
          } catch {
            partial = true;
            return fetchFromPageHtml(path, location.origin);
          }
        };
        const [channels, playlists] = await Promise.all([
          viaApi('fetchSubscriptions', '/feed/channels'),
          viaApi('fetchPlaylists', '/feed/playlists'),
        ]);
        return { channels, playlists, partial };
      },

      async pageItem() {
        const url = new URL(location.href);
        const d = pageData as Record<string, any> | undefined;
        if (url.pathname === '/playlist') {
          const id = url.searchParams.get('list');
          if (!id) return null;
          const title =
            text(d?.metadata?.playlistMetadataRenderer?.title) ??
            text(d?.header?.pageHeaderRenderer?.pageTitle) ??
            document.title.replace(/ - YouTube$/, '');
          return { id, kind: 'playlist', title, url: `/playlist?list=${id}` } satisfies LibraryItem;
        }
        const meta = d?.metadata?.channelMetadataRenderer;
        const id: unknown = meta?.externalId;
        if (typeof id !== 'string' || !isChannelId(id)) return null;
        const vanity: string | undefined = meta.vanityChannelUrl;
        const handle = vanity?.match(/\/(@[^/]+)$/)?.[1];
        const thumbs = meta.avatar?.thumbnails;
        return {
          id,
          kind: 'channel',
          title: meta.title ?? id,
          thumbnail: Array.isArray(thumbs) ? thumbs.at(-1)?.url : undefined,
          url: handle ? `/${handle}` : `/channel/${id}`,
          handle,
        } satisfies LibraryItem;
      },
    };

    window.addEventListener('message', async (e) => {
      const req = e.data as BridgeRequest;
      if (e.source !== window || req?.source !== REQ || !(req.method in methods)) return;
      const reply = (r: Omit<BridgeResponse, 'source' | 'id'>) =>
        window.postMessage({ source: RES, id: req.id, ...r } satisfies BridgeResponse, location.origin);
      try {
        reply({ result: await methods[req.method]() });
      } catch (err) {
        reply({ error: err instanceof Error ? err.message : String(err) });
      }
    });
  },
});
