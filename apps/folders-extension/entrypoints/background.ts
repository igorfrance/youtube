import { LocalValue, type Area } from '@yt/ext-storage';
import type { ChannelId, FeedVideo } from '@yt/shared';
import { channelFeedUrl, parseChannelFeed } from '@yt/youtube-client';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { ActionResult, BackgroundMessage, FeedResult, RefreshResult, TabMessage } from '../src/lib/messages';

const FEED_TTL_MS = 30 * 60 * 1000;
const FEED_CONCURRENCY = 6;

type FeedCache = Record<ChannelId, { fetchedAt: number; videos: FeedVideo[] }>;
const feedCache = new LocalValue<FeedCache>(browser.storage.local as unknown as Area, 'feedCache', () => ({}));

/** Recent uploads for many channels, from each channel's public feed, cached for a while. */
async function getFeed(channelIds: ChannelId[], force = false): Promise<FeedResult> {
  const cache = await feedCache.get();
  const now = Date.now();
  const stale = channelIds.filter((id) => force || !cache[id] || now - cache[id].fetchedAt > FEED_TTL_MS);
  const failed: ChannelId[] = [];
  const queue = [...stale];
  await Promise.all(
    Array.from({ length: Math.min(FEED_CONCURRENCY, queue.length) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          const res = await fetch(channelFeedUrl(id));
          if (!res.ok) throw new Error(String(res.status));
          cache[id] = { fetchedAt: now, videos: parseChannelFeed(await res.text()) };
        } catch {
          if (!cache[id]) failed.push(id);
        }
      }
    }),
  );
  // Forget channels nobody has asked about in a week, so the cache doesn't grow forever.
  for (const [id, entry] of Object.entries(cache)) if (now - entry.fetchedAt > 7 * 24 * 3600_000) delete cache[id];
  if (stale.length) await feedCache.set(cache);
  const videos = channelIds.flatMap((id) => cache[id]?.videos ?? []).sort((a, b) => b.published - a.published);
  return { videos, failed };
}

/** Firefox's sidebar API, which Chrome's typings don't describe. */
const sidebar = () => (browser as unknown as { sidebarAction: { toggle(): Promise<void> } }).sidebarAction;

/**
 * The library can only be read, and the account changed, from inside a
 * YouTube tab (it needs the user's session); relay to one.
 */
async function toYouTubeTab<R>(msg: TabMessage, fallback: (error: string) => R): Promise<R> {
  const tabs = await browser.tabs.query({ url: 'https://www.youtube.com/*' });
  const tab = tabs.find((t) => t.active) ?? tabs[0];
  if (!tab?.id) return fallback('Open YouTube in a tab, then try again.');
  try {
    return (await browser.tabs.sendMessage(tab.id, msg)) as R;
  } catch {
    return fallback('Reload your YouTube tab, then try again.');
  }
}

export default defineBackground(() => {
  if (import.meta.env.FIREFOX) {
    // Firefox has a sidebar instead of a side panel; the toolbar button toggles it.
    browser.action.onClicked.addListener(() => void sidebar().toggle());
  } else {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'open-switcher' || !tab?.id || !tab.url?.startsWith('https://www.youtube.com/')) return;
    await browser.tabs.sendMessage(tab.id, { type: 'switcher:open' } satisfies TabMessage).catch(() => {});
  });

  browser.runtime.onMessage.addListener((msg: BackgroundMessage, sender, sendResponse) => {
    switch (msg.type) {
      case 'feed:get':
        void getFeed(msg.channelIds, msg.force).then(sendResponse);
        return true;
      case 'library:refresh':
        void toYouTubeTab<RefreshResult>(msg, (error) => ({ ok: false, error })).then(sendResponse);
        return true;
      case 'account:action':
        void toYouTubeTab<ActionResult>(msg, (error) => ({ ok: false, error })).then(sendResponse);
        return true;
      case 'sidepanel:open': {
        if (import.meta.env.FIREFOX) {
          // Firefox only opens the sidebar from its own UI, not from a page click; use a tab.
          void browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html') }).then(() => sendResponse(true));
          return true;
        }
        const windowId = sender.tab?.windowId;
        if (windowId === undefined) return false;
        // Must be called synchronously within the user's click to count as a user gesture.
        browser.sidePanel.open({ windowId }).then(
          () => sendResponse(true),
          () => sendResponse(false),
        );
        return true;
      }
    }
    return false;
  });
});
