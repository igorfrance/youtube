/**
 * The choices a folder can be styled with: a color, and an icon that is
 * either one of the built-in outline icons below (stored by name) or any
 * emoji (stored as the emoji itself). Folders store whatever the user picked,
 * so colors outside the palette (from the custom color input) are fine too.
 */

/** Swatches offered for folders, ordered by hue. New folders cycle through FOLDER_COLORS in the extension, which are all in here. */
export const FOLDER_PALETTE = [
  '#d93025', // red
  '#f4511e', // deep orange
  '#e8710a', // orange
  '#f9ab00', // amber
  '#7cb342', // lime
  '#1e8e3e', // green
  '#00897b', // teal
  '#12b5cb', // cyan
  '#1a73e8', // blue
  '#3949ab', // indigo
  '#9334e6', // purple
  '#d01884', // magenta
  '#e67c73', // salmon
  '#795548', // brown
  '#546e7a', // blue grey
  '#5f6368', // grey
] as const;

/** Built-in folder icons: 24×24 outline paths, drawn in the folder's color. */
export const FOLDER_ICON_PATHS = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
  heart: 'M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 6.9 5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.3 0 5.3 3.3 3.9 6.4C19 15.6 12 20 12 20z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  flame: 'M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-9.5-1 2.5-2.5 3.5-3.5 3.5C11.5 6 11 4 9 2c0 4-4 6.5-4 12 0 4.3 3 8 7 8z',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8',
  gamepad: 'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 10.5v3M5.5 12h3M15.5 11h.01M18 13h.01',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  tv: 'M3 7h18v12H3zM8 3l4 4 4-4',
  camera: 'M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 9.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h4',
  book: 'M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h14v-4',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v5',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.5 1.4-1.5 2.6V17h-4v-.5c0-1.2-.8-2.1-1.5-2.6A6 6 0 0 1 12 3z',
  flask: 'M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10',
  palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01M17 11h.01',
  fitness: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M18 21V3c-2 1-4 3.5-4 8h4',
  home: 'M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5',
  place: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  globe: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9',
  car: 'M5 17H3v-5l2-5h14l2 5v5h-2M3 12h18M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM9 17h6',
  leaf: 'M5 21c0-9 5-15 15-16-1 10-7 15-15 16zM5 21l8-8',
  money: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  smile: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
} as const;

export type FolderIconName = keyof typeof FOLDER_ICON_PATHS;

/** Built-in icon names in picker order; `folder` is the default look. */
export const FOLDER_ICONS = Object.keys(FOLDER_ICON_PATHS) as FolderIconName[];

export const isFolderIconName = (icon: string | undefined): icon is FolderIconName => !!icon && Object.hasOwn(FOLDER_ICON_PATHS, icon);

/** The first character a person would see in `text` (so "👍🏽" or "👨‍👩‍👧" stay whole), or '' for blank text. */
export function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)) return segment;
  }
  return Array.from(t)[0] ?? '';
}

/** How a folder's stored icon should be drawn. */
export function glyphOf(icon: string | undefined): { kind: 'icon'; name: FolderIconName } | { kind: 'emoji'; text: string } {
  if (!icon || icon === 'folder') return { kind: 'icon', name: 'folder' };
  if (isFolderIconName(icon)) return { kind: 'icon', name: icon };
  return { kind: 'emoji', text: icon };
}
