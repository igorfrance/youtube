import { ref } from 'vue';

/** UI state shared by the separate Vue apps the content script mounts into YouTube. */

/** The folder whose feed (or playlist list) is open over the page, if any. */
export const openFolderId = ref<string | null>(null);
export const paletteOpen = ref(false);
/** Updated on every YouTube navigation, so components can react to the current page. */
export const currentUrl = ref(location.href);
/** Collapse state of the Unsorted pseudo-folders (not synced). */
export const unsortedCollapsed = ref({ subscriptions: true, playlists: true });
