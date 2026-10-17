import type { ItemKind, LibraryItem } from '@yt/shared';

/**
 * The user's organization: folders and which items sit in them. This is the
 * only data that syncs across devices; everything about the items themselves
 * (titles, thumbnails) is re-read from YouTube.
 *
 * Every function here is pure and returns a new state.
 */

export type TreeKind = 'subscriptions' | 'playlists';
export type FolderId = string;

export interface Folder {
  id: FolderId;
  tree: TreeKind;
  name: string;
  parentId: FolderId | null;
  order: number;
  color?: string;
  /** A short emoji or character shown instead of the folder glyph. */
  icon?: string;
  collapsed?: boolean;
}

export interface Settings {
  /** Hide YouTube's flat Subscriptions list in the sidebar (folders replace it). */
  replaceNativeSubscriptions: boolean;
  /** Include Shorts in folder feeds. */
  feedShowShorts: boolean;
}

export interface OrgState {
  folders: Folder[];
  /** Item id → folders it is in. An item may be in several folders of its tree. */
  placements: Record<string, FolderId[]>;
  settings: Settings;
}

export const ORG_VERSION = 1;

export const emptyOrg = (): OrgState => ({
  folders: [],
  placements: {},
  settings: { replaceNativeSubscriptions: true, feedShowShorts: true },
});

export const treeOf = (kind: ItemKind): TreeKind => (kind === 'channel' ? 'subscriptions' : 'playlists');

export const FOLDER_COLORS = ['#e8710a', '#1e8e3e', '#1a73e8', '#9334e6', '#d01884', '#12b5cb', '#f9ab00', '#5f6368'];

const newId = () => Math.random().toString(36).slice(2, 10);

export const getFolder = (s: OrgState, id: FolderId) => s.folders.find((f) => f.id === id);

export function childrenOf(s: OrgState, tree: TreeKind, parentId: FolderId | null): Folder[] {
  return s.folders.filter((f) => f.tree === tree && f.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** `id` and all folders nested under it. */
export function descendantsOf(s: OrgState, id: FolderId): FolderId[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const f of s.folders) if (f.parentId === out[i]) out.push(f.id);
  return out;
}

export function pathOf(s: OrgState, id: FolderId): Folder[] {
  const out: Folder[] = [];
  for (let f = getFolder(s, id); f; f = f.parentId ? getFolder(s, f.parentId) : undefined) out.unshift(f);
  return out;
}

export function createFolder(s: OrgState, tree: TreeKind, name: string, parentId: FolderId | null = null): [OrgState, FolderId] {
  const id = newId();
  const siblings = childrenOf(s, tree, parentId);
  const color = FOLDER_COLORS[s.folders.filter((f) => f.tree === tree).length % FOLDER_COLORS.length];
  const folder: Folder = { id, tree, name: name.trim() || 'New folder', parentId, order: (siblings.at(-1)?.order ?? 0) + 1, color };
  return [{ ...s, folders: [...s.folders, folder] }, id];
}

export function updateFolder(s: OrgState, id: FolderId, patch: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'collapsed'>>): OrgState {
  return { ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

/**
 * Deletes a folder. Its sub-folders move up to its parent, and its items move
 * to the parent too (or become unsorted at the top level). Items keep their
 * other folders.
 */
export function deleteFolder(s: OrgState, id: FolderId): OrgState {
  const folder = getFolder(s, id);
  if (!folder) return s;
  const folders = s.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: folder.parentId } : f));
  const placements: Record<string, FolderId[]> = {};
  for (const [item, ids] of Object.entries(s.placements)) {
    if (!ids.includes(id)) {
      placements[item] = ids;
      continue;
    }
    const next = ids.filter((x) => x !== id);
    if (folder.parentId && !next.includes(folder.parentId)) next.push(folder.parentId);
    if (next.length) placements[item] = next;
  }
  return { ...s, folders, placements };
}

/** Moves a folder under `parentId` (null = top level) at position `index` among its new siblings. */
export function moveFolder(s: OrgState, id: FolderId, parentId: FolderId | null, index = Infinity): OrgState {
  const folder = getFolder(s, id);
  if (!folder) return s;
  if (parentId && (descendantsOf(s, id).includes(parentId) || getFolder(s, parentId)?.tree !== folder.tree)) return s;
  const siblings = childrenOf(s, folder.tree, parentId).filter((f) => f.id !== id);
  siblings.splice(Math.min(index, siblings.length), 0, { ...folder, parentId });
  const order = new Map(siblings.map((f, i) => [f.id, i + 1]));
  return {
    ...s,
    folders: s.folders.map((f) => (order.has(f.id) ? { ...f, parentId: f.id === id ? parentId : f.parentId, order: order.get(f.id)! } : f)),
  };
}

export function addToFolder(s: OrgState, itemIds: string[], folderId: FolderId): OrgState {
  if (!getFolder(s, folderId)) return s;
  const placements = { ...s.placements };
  for (const it of itemIds) {
    const cur = placements[it] ?? [];
    if (!cur.includes(folderId)) placements[it] = [...cur, folderId];
  }
  return { ...s, placements };
}

export function removeFromFolder(s: OrgState, itemIds: string[], folderId: FolderId): OrgState {
  const placements = { ...s.placements };
  for (const it of itemIds) {
    const next = (placements[it] ?? []).filter((x) => x !== folderId);
    if (next.length) placements[it] = next;
    else delete placements[it];
  }
  return { ...s, placements };
}

/** Moves items out of `fromId` (or from nowhere, for unsorted items) into `toId`. */
export function moveItems(s: OrgState, itemIds: string[], fromId: FolderId | null, toId: FolderId): OrgState {
  const added = addToFolder(s, itemIds, toId);
  return fromId && fromId !== toId ? removeFromFolder(added, itemIds, fromId) : added;
}

export function setMembership(s: OrgState, itemId: string, folderIds: FolderId[]): OrgState {
  const placements = { ...s.placements };
  const valid = folderIds.filter((id) => getFolder(s, id));
  if (valid.length) placements[itemId] = valid;
  else delete placements[itemId];
  return { ...s, placements };
}

export const foldersOf = (s: OrgState, itemId: string): Folder[] =>
  (s.placements[itemId] ?? []).map((id) => getFolder(s, id)).filter((f): f is Folder => !!f);

/** Items placed directly in a folder, or (with `nested`) in it or any sub-folder. */
export function itemIdsIn(s: OrgState, folderId: FolderId, nested = false): string[] {
  const ids = new Set(nested ? descendantsOf(s, folderId) : [folderId]);
  return Object.entries(s.placements)
    .filter(([, fs]) => fs.some((f) => ids.has(f)))
    .map(([item]) => item);
}

/** Library items of a tree that are in no folder. */
export function unsortedItems(s: OrgState, items: LibraryItem[]): LibraryItem[] {
  return items.filter((it) => !(s.placements[it.id] ?? []).some((id) => getFolder(s, id)));
}

export interface TreeNode {
  folder: Folder;
  depth: number;
  children: TreeNode[];
  /** Items directly in this folder. */
  itemIds: string[];
  /** Items in this folder and below, counted once each. */
  total: number;
}

export function buildTree(s: OrgState, tree: TreeKind): TreeNode[] {
  const direct = new Map<FolderId, string[]>();
  for (const [item, fs] of Object.entries(s.placements)) for (const f of fs) direct.set(f, [...(direct.get(f) ?? []), item]);
  const build = (parentId: FolderId | null, depth: number): TreeNode[] =>
    childrenOf(s, tree, parentId).map((folder) => {
      const children = build(folder.id, depth + 1);
      const all = new Set(direct.get(folder.id) ?? []);
      const collect = (n: TreeNode) => {
        n.itemIds.forEach((i) => all.add(i));
        n.children.forEach(collect);
      };
      children.forEach(collect);
      return { folder, depth, children, itemIds: direct.get(folder.id) ?? [], total: all.size };
    });
  return build(null, 0);
}

/** Validates an export file and returns the state it holds. Throws a readable message if it is not one. */
export function parseExport(json: string): OrgState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const r = raw as { app?: string; version?: number; org?: OrgState };
  if (r?.app !== 'youtube-folders' || !r.org || !Array.isArray(r.org.folders) || typeof r.org.placements !== 'object') {
    throw new Error('That file is not a Folders for YouTube export.');
  }
  if (r.version !== ORG_VERSION) throw new Error(`Unsupported export version ${r.version}.`);
  const folders = r.org.folders.filter((f) => typeof f?.id === 'string' && typeof f.name === 'string' && (f.tree === 'subscriptions' || f.tree === 'playlists'));
  const ids = new Set(folders.map((f) => f.id));
  const placements: Record<string, FolderId[]> = {};
  for (const [item, fs] of Object.entries(r.org.placements)) {
    const valid = Array.isArray(fs) ? fs.filter((f) => ids.has(f)) : [];
    if (valid.length) placements[item] = valid;
  }
  return {
    folders: folders.map((f) => ({ ...f, parentId: f.parentId && ids.has(f.parentId) ? f.parentId : null })),
    placements,
    settings: { ...emptyOrg().settings, ...r.org.settings },
  };
}

export const toExport = (s: OrgState) => JSON.stringify({ app: 'youtube-folders', version: ORG_VERSION, exportedAt: new Date().toISOString(), org: s }, null, 2);

/** Drops items from every folder (they were removed from YouTube on purpose). */
export function forgetItems(s: OrgState, itemIds: string[]): OrgState {
  const placements = { ...s.placements };
  for (const id of itemIds) delete placements[id];
  return { ...s, placements };
}

/** Puts `toId` into every folder any of `fromIds` is in (keeping its own folders). */
export function inheritFolders(s: OrgState, fromIds: string[], toId: string): OrgState {
  const folders = new Set(s.placements[toId] ?? []);
  for (const id of fromIds) for (const f of s.placements[id] ?? []) folders.add(f);
  return folders.size ? { ...s, placements: { ...s.placements, [toId]: [...folders] } } : s;
}
