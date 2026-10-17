<script setup lang="ts">
import { CommandPalette, type PaletteEntry } from '@yt/ui';
import { computed } from 'vue';
import { useLibrary, useOrg } from '../lib/store';
import { folderLabel, isUnsorted } from '../lib/view';
import { foldersOf, getFolder } from '../model/org';
import FolderOverlay from './FolderOverlay.vue';
import { openFolderId, paletteOpen } from './ui-state';

const org = useOrg();
const lib = useLibrary();

const entries = computed<PaletteEntry[]>(() => {
  const folders = org.value.folders.map((f) => ({
    id: `f:${f.id}`,
    label: f.name,
    group: 'Folders',
    hint: `${f.tree === 'subscriptions' ? 'Subscriptions' : 'Playlists'} · ${folderLabel(org.value, f.id)}`,
    folder: { color: f.color, icon: f.icon },
  }));
  const items = (list: typeof lib.value.channels, group: string) =>
    list.map((it) => ({
      id: `i:${it.id}`,
      label: it.title,
      group,
      hint: foldersOf(org.value, it.id).map((f) => f.name).join(', ') || 'Unsorted',
      thumbnail: it.thumbnail,
      round: it.kind === 'channel',
    }));
  return [...folders, ...items(lib.value.channels, 'Channels'), ...items(lib.value.playlists, 'Playlists')];
});

function pick(entry: PaletteEntry, alt: boolean) {
  paletteOpen.value = false;
  const id = entry.id.slice(2);
  if (entry.id.startsWith('f:')) {
    openFolderId.value = id;
    return;
  }
  const item = lib.value.channels.find((c) => c.id === id) ?? lib.value.playlists.find((p) => p.id === id);
  if (!item) return;
  const first = foldersOf(org.value, id)[0];
  // Shift+Enter on a channel or playlist opens the folder it is in.
  if (alt && first) openFolderId.value = first.id;
  else location.assign(item.url);
}

const overlayFolder = computed(() => {
  const id = openFolderId.value;
  return id && (isUnsorted(id) || getFolder(org.value, id)) ? id : null;
});
</script>

<template>
  <FolderOverlay v-if="overlayFolder" :folder-id="overlayFolder" @close="openFolderId = null" />
  <CommandPalette
    v-if="paletteOpen"
    :entries="entries"
    placeholder="Jump to a folder, channel or playlist"
    :style="{ zIndex: 2100 }"
    @pick="pick"
    @close="paletteOpen = false"
  />
</template>

