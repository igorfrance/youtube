import type { LibraryItem } from '@yt/shared';
import { browser } from 'wxt/browser';
import type { TabMessage } from './messages';

type Target = Pick<LibraryItem, 'kind' | 'id' | 'url'>;

/**
 * Where a click asks for a link to open, following the browser's own habits:
 * Ctrl/Cmd+click or middle-click opens a new background tab, and adding Shift
 * brings that tab to the front. A plain click opens it in the current tab.
 */
export function clickTarget(e: MouseEvent): { newTab: boolean; foreground: boolean } {
  const newTab = e.ctrlKey || e.metaKey || e.button === 1;
  return { newTab, foreground: newTab && e.shiftKey };
}

/**
 * Opens a channel or playlist from the organizer. "Current tab" is the tab the
 * side panel sits next to; when that is a YouTube tab the page changes in
 * place, the way YouTube's own links do, instead of reloading.
 */
export async function openItem(item: Target, { newTab, foreground }: { newTab: boolean; foreground: boolean }): Promise<void> {
  const url = `https://www.youtube.com${item.url}`;
  // Set when the organizer itself runs in a tab (Firefox fallback); never navigate that away.
  const self = await browser.tabs.getCurrent();
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  if (newTab || self || !active?.id) {
    const near = active?.id ? { openerTabId: active.id, index: active.index + 1 } : {};
    await browser.tabs.create({ url, active: newTab ? foreground : true, ...near });
    return;
  }
  if (active.url?.startsWith('https://www.youtube.com/')) {
    try {
      await browser.tabs.sendMessage(active.id, { type: 'item:open', item } satisfies TabMessage);
      return;
    } catch {
      // No content script in that tab (opened before the extension was loaded): load the page instead.
    }
  }
  await browser.tabs.update(active.id, { url });
}
