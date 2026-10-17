import type { LibraryItem } from '@yt/shared';
import type { UiTreeNode } from '@yt/ui';
import { itemsOf, type Library } from '../model/library';
import { buildTree, getFolder, itemIdsIn, pathOf, unsortedItems, type OrgState, type TreeKind, type TreeNode } from '../model/org';

/** Pseudo-folder ids for items that are in no folder. */
export const UNSORTED: Record<TreeKind, string> = { subscriptions: '__unsorted_subscriptions', playlists: '__unsorted_playlists' };
export const isUnsorted = (id: string) => id === UNSORTED.subscriptions || id === UNSORTED.playlists;
export const treeOfUnsorted = (id: string): TreeKind => (id === UNSORTED.playlists ? 'playlists' : 'subscriptions');

export const kindOfTree = (tree: TreeKind) => (tree === 'subscriptions' ? 'channel' : 'playlist');

export function toUiNodes(nodes: TreeNode[]): UiTreeNode[] {
  return nodes.map((n) => ({
    id: n.folder.id,
    name: n.folder.name,
    color: n.folder.color,
    icon: n.folder.icon,
    collapsed: n.folder.collapsed,
    count: n.total,
    children: toUiNodes(n.children),
  }));
}

/** The tree for display, with an "Unsorted" pseudo-folder at the end. */
export function treeView(org: OrgState, lib: Library, tree: TreeKind, unsortedCollapsed: boolean): UiTreeNode[] {
  const unsorted = unsortedItems(org, itemsOf(lib, kindOfTree(tree)));
  const nodes = toUiNodes(buildTree(org, tree));
  if (unsorted.length || nodes.length)
    nodes.push({ id: UNSORTED[tree], name: 'Unsorted', color: undefined, count: unsorted.length, collapsed: unsortedCollapsed, children: [] });
  return nodes;
}

/** Library items in a folder (directly, or with `nested` also in sub-folders), or the unsorted ones. */
export function itemsInFolder(org: OrgState, lib: Library, folderId: string, nested = false): LibraryItem[] {
  if (isUnsorted(folderId)) return unsortedItems(org, itemsOf(lib, kindOfTree(treeOfUnsorted(folderId))));
  const folder = getFolder(org, folderId);
  if (!folder) return [];
  const ids = new Set(itemIdsIn(org, folderId, nested));
  return itemsOf(lib, kindOfTree(folder.tree)).filter((i) => ids.has(i.id));
}

export function folderLabel(org: OrgState, folderId: string): string {
  if (isUnsorted(folderId)) return 'Unsorted';
  return pathOf(org, folderId).map((f) => f.name).join(' / ');
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  const units: [number, string][] = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [secs, name] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
