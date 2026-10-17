import { describe, expect, test } from 'bun:test';
import type { LibraryItem } from '@yt/shared';
import { fuzzyScore } from '@yt/shared';
import { mergeItems } from './library';
import {
  addToFolder,
  buildTree,
  createFolder,
  deleteFolder,
  emptyOrg,
  foldersOf,
  itemIdsIn,
  moveFolder,
  moveItems,
  parseExport,
  removeFromFolder,
  toExport,
  unsortedItems,
  type OrgState,
} from './org';

const ch = (id: string, title = id): LibraryItem => ({ id, kind: 'channel', title, url: `/channel/${id}` });

function setup() {
  let s = emptyOrg();
  let cooking, tech, code;
  [s, cooking] = createFolder(s, 'subscriptions', 'Cooking');
  [s, tech] = createFolder(s, 'subscriptions', 'Tech');
  [s, code] = createFolder(s, 'subscriptions', 'Programming', tech);
  return { s, cooking, tech, code };
}

describe('folders', () => {
  test('items can be in several folders', () => {
    let { s, cooking, code } = setup();
    s = addToFolder(s, ['a', 'b'], cooking);
    s = addToFolder(s, ['a'], code);
    expect(foldersOf(s, 'a').map((f) => f.name)).toEqual(['Cooking', 'Programming']);
    expect(itemIdsIn(s, cooking)).toEqual(['a', 'b']);
  });

  test('nested counts include sub-folders, counting each item once', () => {
    let { s, tech, code } = setup();
    s = addToFolder(s, ['a', 'b'], code);
    s = addToFolder(s, ['a', 'c'], tech);
    const techNode = buildTree(s, 'subscriptions').find((n) => n.folder.id === tech)!;
    expect(techNode.total).toBe(3);
    expect(techNode.children[0]!.folder.id).toBe(code);
    expect(itemIdsIn(s, tech, true).sort()).toEqual(['a', 'b', 'c']);
  });

  test('deleting a folder moves its contents to its parent', () => {
    let { s, tech, code } = setup();
    s = addToFolder(s, ['a'], code);
    s = deleteFolder(s, code);
    expect(itemIdsIn(s, tech)).toEqual(['a']);
  });

  test('deleting a top-level folder leaves its items unsorted, keeping other folders', () => {
    let { s, cooking, tech } = setup();
    s = addToFolder(s, ['a', 'b'], cooking);
    s = addToFolder(s, ['b'], tech);
    s = deleteFolder(s, cooking);
    expect(unsortedItems(s, [ch('a'), ch('b')]).map((i) => i.id)).toEqual(['a']);
  });

  test('moveFolder refuses cycles and reorders siblings', () => {
    let { s, cooking, tech, code } = setup();
    expect(moveFolder(s, tech, code)).toBe(s);
    s = moveFolder(s, tech, null, 0);
    expect(buildTree(s, 'subscriptions').map((n) => n.folder.id)).toEqual([tech, cooking]);
    s = moveFolder(s, cooking, tech);
    expect(buildTree(s, 'subscriptions')[0]!.children.map((n) => n.folder.id)).toEqual([code, cooking]);
  });

  test('moveItems moves out of the source folder only', () => {
    let { s, cooking, tech, code } = setup();
    s = addToFolder(s, ['a'], cooking);
    s = addToFolder(s, ['a'], tech);
    s = moveItems(s, ['a'], cooking, code);
    expect(foldersOf(s, 'a').map((f) => f.name).sort()).toEqual(['Programming', 'Tech']);
    s = removeFromFolder(s, ['a'], tech);
    s = removeFromFolder(s, ['a'], code);
    expect(s.placements.a).toBeUndefined();
  });

  test('export round-trips and drops dangling references', () => {
    let { s, cooking } = setup();
    s = addToFolder(s, ['a'], cooking);
    const tampered = JSON.parse(toExport(s));
    tampered.org.placements.b = ['nope'];
    const back = parseExport(JSON.stringify(tampered));
    expect(back.folders).toEqual(s.folders);
    expect(back.placements).toEqual({ a: [cooking] });
    expect(() => parseExport('{"x":1}')).toThrow('not a YouTube Folders export');
  });
});

test('mergeItems keeps filed items that disappeared, flagged missing', () => {
  const org: OrgState = { ...emptyOrg(), placements: { gone: ['f'] } };
  const merged = mergeItems([ch('gone', 'Gone'), ch('dropped', 'Dropped'), ch('b', 'B old')], [ch('b', 'B'), ch('a', 'A')], org);
  expect(merged.map((i) => [i.id, i.title, !!i.missing])).toEqual([['a', 'A', false], ['b', 'B', false], ['gone', 'Gone', true]]);
});

test('fuzzyScore ranks prefixes, then word starts, then scattered matches', () => {
  const titles = ['Systems Hour', 'Cooking', 'Retro Computing Bay', 'Bread Science'];
  const ranked = titles.map((t) => [t, fuzzyScore('co', t)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  expect(ranked).toEqual(['Cooking', 'Retro Computing Bay']);
  expect(fuzzyScore('rcb', 'Retro Computing Bay')).toBeGreaterThan(0);
  expect(fuzzyScore('xyz', 'Retro Computing Bay')).toBe(0);
});
