import type { ChannelId, FeedVideo } from '@yt/shared';
import { browser } from 'wxt/browser';

/** Messages handled by the background service worker. */
export type BackgroundMessage =
  | { type: 'feed:get'; channelIds: ChannelId[]; force?: boolean }
  | { type: 'sidepanel:open' }
  | { type: 'library:refresh' };

/** Messages handled by the content script in a YouTube tab. */
export type TabMessage = { type: 'library:refresh' } | { type: 'switcher:open' };

export interface FeedResult {
  videos: FeedVideo[];
  /** Channels whose feed could not be loaded. */
  failed: ChannelId[];
}

export interface RefreshResult {
  ok: boolean;
  error?: string;
}

export function toBackground(msg: { type: 'feed:get'; channelIds: ChannelId[]; force?: boolean }): Promise<FeedResult>;
export function toBackground(msg: { type: 'library:refresh' }): Promise<RefreshResult>;
export function toBackground(msg: { type: 'sidepanel:open' }): Promise<boolean>;
export function toBackground(msg: BackgroundMessage): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}
