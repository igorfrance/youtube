import { describe, expect, test } from 'bun:test';
import { firstGrapheme, FOLDER_ICON_PATHS, FOLDER_ICONS, FOLDER_PALETTE, glyphOf, isFolderIconName } from './folder-style';

describe('folder style', () => {
  test('stored icons draw as built-in icons, emoji, or the default folder', () => {
    expect(glyphOf(undefined)).toEqual({ kind: 'icon', name: 'folder' });
    expect(glyphOf('music')).toEqual({ kind: 'icon', name: 'music' });
    expect(glyphOf('🎮')).toEqual({ kind: 'emoji', text: '🎮' });
    expect(isFolderIconName('toString')).toBe(false);
  });

  test('emoji input keeps one whole emoji', () => {
    expect(firstGrapheme('  ')).toBe('');
    expect(firstGrapheme('👍🏽 nice')).toBe('👍🏽');
    expect(firstGrapheme('👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(firstGrapheme('ab')).toBe('a');
  });

  test('palette and icons are well-formed', () => {
    expect(new Set(FOLDER_PALETTE).size).toBe(FOLDER_PALETTE.length);
    for (const c of FOLDER_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(FOLDER_ICONS[0]).toBe('folder');
    for (const d of Object.values(FOLDER_ICON_PATHS)) expect(d).toMatch(/^M[\d\s.,MmLlHhVvCcSsQqTtAaZz-]+$/);
  });
});
