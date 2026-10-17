import type { MergeProgress, MergeResult } from '@yt/youtube-client';
import { browser } from 'wxt/browser';
import { removeItems, upsertItem } from '../model/library';
import { forgetItems, inheritFolders } from '../model/org';
import { callBridge, type BatchResult } from './bridge';
import { refreshLibrary } from './library-sync';
import type { AccountAction, ActionProgressMessage } from './messages';
import { libraryValue, mutate } from './store';

/** Long account changes (big merges) report progress; give each step room. */
const STEP_TIMEOUT_MS = 120_000;

/**
 * Runs a change to the user's YouTube account from a YouTube tab, then
 * updates the local library and folders to match. Content script only.
 */
export async function runAccountAction(action: AccountAction): Promise<BatchResult | MergeResult> {
  const progress = (p: MergeProgress) =>
    void browser.runtime.sendMessage({ type: 'action:progress', progress: p } satisfies ActionProgressMessage).catch(() => {});

  if (action.kind === 'unsubscribe' || action.kind === 'removePlaylists') {
    const res =
      action.kind === 'unsubscribe'
        ? await callBridge('unsubscribe', [action.ids], { timeoutMs: STEP_TIMEOUT_MS * 4 })
        : await callBridge('removePlaylists', [action.ids], { timeoutMs: STEP_TIMEOUT_MS * 4 });
    await forget(res.done);
    return res;
  }

  const res = await callBridge('mergePlaylists', [{ sources: action.sources, target: action.target }], { timeoutMs: STEP_TIMEOUT_MS, onProgress: progress });
  if (res.created) {
    const title = 'create' in action.target ? action.target.create.title : res.targetId;
    await libraryValue.set(upsertItem(await libraryValue.get(), { id: res.targetId, kind: 'playlist', title, url: `/playlist?list=${res.targetId}`, videoCount: res.added }));
    await mutate((s) => inheritFolders(s, action.sources, res.targetId));
  }
  await forget(res.removed);
  // Pick up the new counts and thumbnails.
  void refreshLibrary();
  return res;
}

async function forget(ids: string[]) {
  if (!ids.length) return;
  await libraryValue.set(removeItems(await libraryValue.get(), ids));
  await mutate((s) => forgetItems(s, ids));
}

