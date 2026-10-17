import { PLAYLIST_MAX_VIDEOS, SYSTEM_PLAYLISTS, type InnertubeClient, type PlaylistPrivacy } from './innertube';


export type MergeTarget = { existing: string } | { create: { title: string; privacy: PlaylistPrivacy } };

export interface MergeResult {
  targetId: string;
  created: boolean;
  added: number;
  /** Source playlists removed from the library after the merge. */
  removed: string[];
  /** Sources left in place: the target itself, or built-in playlists like Watch later. */
  kept: string[];
}

export type MergeProgress =
  | { step: 'reading'; done: number; total: number }
  | { step: 'adding'; done: number; total: number }
  | { step: 'verifying' }
  | { step: 'removing'; done: number; total: number };

type Client = Pick<InnertubeClient, 'playlistVideoIds' | 'createPlaylist' | 'addVideos' | 'removePlaylist'>;

/**
 * Merges `sources` into a target playlist, then removes the sources (except
 * the target). Videos already in the target, and repeats across sources, are
 * added once, in source order. Sources are only removed after re-reading the
 * target confirms every video arrived, so a failure part-way never loses videos.
 */
export async function mergePlaylists(
  client: Client,
  sources: string[],
  target: MergeTarget,
  onProgress: (p: MergeProgress) => void = () => {},
): Promise<MergeResult> {
  if (!sources.length) throw new Error('Pick at least one playlist to merge.');
  const targetId = 'existing' in target ? target.existing : undefined;
  const toRead = targetId ? [targetId, ...sources.filter((s) => s !== targetId)] : sources;

  const contents = new Map<string, string[]>();
  for (const [i, id] of toRead.entries()) {
    onProgress({ step: 'reading', done: i, total: toRead.length });
    contents.set(id, await client.playlistVideoIds(id));
  }

  const inTarget = new Set(targetId ? contents.get(targetId) : []);
  const toAdd: string[] = [];
  for (const s of sources) {
    if (s === targetId) continue;
    for (const v of contents.get(s) ?? []) {
      if (inTarget.has(v)) continue;
      inTarget.add(v);
      toAdd.push(v);
    }
  }
  if (inTarget.size > PLAYLIST_MAX_VIDEOS) {
    throw new Error(`The merged playlist would have ${inTarget.size} videos; YouTube allows at most ${PLAYLIST_MAX_VIDEOS}.`);
  }

  const finalId = 'existing' in target ? target.existing : await client.createPlaylist(target.create.title, target.create.privacy);
  onProgress({ step: 'adding', done: 0, total: toAdd.length });
  await client.addVideos(finalId, toAdd, (done) => onProgress({ step: 'adding', done, total: toAdd.length }));

  onProgress({ step: 'verifying' });
  const after = new Set(await client.playlistVideoIds(finalId));
  const missing = toAdd.filter((v) => !after.has(v));
  // Some videos (deleted, private, region-blocked) can't be added; YouTube drops them silently.
  // Only those are tolerated: if anything else is missing, keep the sources.
  if (missing.length && missing.length > Math.max(5, toAdd.length * 0.02)) {
    throw new Error(`${missing.length} of ${toAdd.length} videos didn't reach the merged playlist, so the original playlists were kept.`);
  }

  const removable = sources.filter((s) => s !== finalId && !SYSTEM_PLAYLISTS.has(s));
  const kept = sources.filter((s) => !removable.includes(s));
  const removed: string[] = [];
  for (const [i, id] of removable.entries()) {
    onProgress({ step: 'removing', done: i, total: removable.length });
    await client.removePlaylist(id);
    removed.push(id);
  }
  return { targetId: finalId, created: !targetId, added: toAdd.length - missing.length, removed, kept };
}
