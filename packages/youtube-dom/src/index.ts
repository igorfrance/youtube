/**
 * Everything that depends on YouTube's page structure lives here, so a
 * YouTube redesign means fixing one file. Every lookup returns null instead
 * of throwing; callers degrade gracefully.
 */

export const SELECTORS = {
  /** The left sidebar ("guide") list of sections. */
  guideSections: 'ytd-guide-renderer #sections',
  guideSection: 'ytd-guide-section-renderer',
  /** The guide drawer itself; its width tells us where page content starts. */
  guideDrawer: 'tp-yt-app-drawer#guide, #guide-wrapper',
  masthead: '#masthead-container, ytd-masthead',
  /** Action buttons in a channel page header (Subscribe, Join…). */
  channelActions: [
    'yt-page-header-renderer yt-flexible-actions-view-model',
    'ytd-c4-tabbed-header-renderer #buttons',
    '#channel-header #buttons',
  ].join(', '),
  /** Action buttons in a playlist page header (Save, Share…). */
  playlistActions: [
    'ytd-playlist-header-renderer #top-level-buttons-computed',
    'yt-page-header-renderer yt-flexible-actions-view-model',
    'ytd-playlist-header-renderer .metadata-action-bar',
  ].join(', '),
} as const;

/** Is the guide section a list of channels, i.e. the native Subscriptions section? */
export function isSubscriptionsSection(section: Element): boolean {
  const links = [...section.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => a.getAttribute('href') ?? '');
  const channelLinks = links.filter((h) => h.startsWith('/@') || h.startsWith('/channel/UC'));
  return channelLinks.length > 0 && channelLinks.length >= links.length / 2;
}

export function findSubscriptionsSection(root: ParentNode = document): Element | null {
  return [...root.querySelectorAll(SELECTORS.guideSection)].find(isSubscriptionsSection) ?? null;
}

/**
 * Runs `cb` on every in-app navigation (YouTube is a single-page app and
 * fires `yt-navigate-finish`), plus once now. Returns an unsubscribe.
 */
export function onNavigate(cb: () => void): () => void {
  const run = () => cb();
  document.addEventListener('yt-navigate-finish', run);
  window.addEventListener('popstate', run);
  queueMicrotask(run);
  return () => {
    document.removeEventListener('yt-navigate-finish', run);
    window.removeEventListener('popstate', run);
  };
}

/** Resolves with the first element matching `selector`, or null after `timeoutMs`. */
export function waitFor<E extends Element = Element>(selector: string, timeoutMs = 10_000, root: ParentNode = document): Promise<E | null> {
  const found = root.querySelector<E>(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      const el = root.querySelector<E>(selector);
      if (el) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    obs.observe(root instanceof Document ? root.documentElement : (root as Node), { childList: true, subtree: true });
    const timer = setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

export type PageRef =
  | { kind: 'channel'; channelId?: string; handle?: string }
  | { kind: 'playlist'; playlistId: string }
  | null;

/** What library item, if any, the current URL is about. */
export function pageRef(url: URL): PageRef {
  const p = url.pathname;
  if (p === '/playlist') {
    const id = url.searchParams.get('list');
    return id ? { kind: 'playlist', playlistId: id } : null;
  }
  const handle = p.match(/^\/(@[^/]+)/)?.[1];
  if (handle) return { kind: 'channel', handle: decodeURIComponent(handle) };
  const channelId = p.match(/^\/channel\/(UC[\w-]{22})/)?.[1];
  if (channelId) return { kind: 'channel', channelId };
  return null;
}

/** True while focus is in a text field, so keyboard shortcuts stay out of the way. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
  if (!t || !(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

/** The area YouTube uses for page content: below the masthead, right of the sidebar. */
export function pageContentRect(): { top: number; left: number } {
  const top = document.querySelector(SELECTORS.masthead)?.getBoundingClientRect().bottom ?? 56;
  const visibleRight = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > 0 && getComputedStyle(el).visibility !== 'hidden' ? r.right : 0;
  };
  const left = Math.max(visibleRight('tp-yt-app-drawer#guide[opened] #contentContainer'), visibleRight('ytd-mini-guide-renderer'));
  // On narrow windows the full guide floats over the page; then use the whole width.
  return { top: Math.max(0, top), left: left > window.innerWidth / 2 ? 0 : left };
}
