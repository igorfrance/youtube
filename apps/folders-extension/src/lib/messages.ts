import type { ChannelId, FeedVideo } from '@yt/shared';
import type { MergeProgress, MergeResult, MergeTarget } from '@yt/youtube-client';
import type { BatchResult } from './bridge';
import { browser } from 'wxt/browser';

/** Messages handled by the background service worker. */
export type BackgroundMessage =
  | { type: 'feed:get'; channelIds: ChannelId[]; force?: boolean }
  | { type: 'sidepanel:open' }
  | { type: 'library:refresh' }
  | { type: 'account:action'; action: AccountAction };

/** A change to the user's YouTube account, run in a YouTube tab. */
export type AccountAction =
  | { kind: 'unsubscribe'; ids: string[] }
  | { kind: 'removePlaylists'; ids: string[] }
  | { kind: 'mergePlaylists'; sources: string[]; target: MergeTarget };

/** Messages handled by the content script in a YouTube tab. */
export type TabMessage = { type: 'library:refresh' } | { type: 'switcher:open' } | { type: 'account:action'; action: AccountAction };

/** Broadcast by the content script while a merge runs. */
export type ActionProgressMessage = { type: 'action:progress'; progress: MergeProgress };

export type ActionResult = { ok: true; result: BatchResult | MergeResult } | { ok: false; error: string };

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
export function toBackground(msg: { type: 'account:action'; action: AccountAction }): Promise<ActionResult>;
export function toBackground(msg: BackgroundMessage): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}
