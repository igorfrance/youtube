<script setup lang="ts">
import type { LibraryItem } from '@yt/shared';
import { FolderGlyph, Icon } from '@yt/ui';
import { pageRef } from '@yt/youtube-dom';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callBridge } from '../lib/bridge';
import { libraryValue, mutate, useLibrary, useOrg } from '../lib/store';
import { upsertItem } from '../model/library';
import { addToFolder, buildTree, createFolder, foldersOf, removeFromFolder, treeOf, type TreeNode } from '../model/org';
import { currentUrl } from './ui-state';

/** The "Folders" button next to Subscribe/Save on channel and playlist pages. */
const org = useOrg();
const lib = useLibrary();

const ref_ = computed(() => pageRef(new URL(currentUrl.value)));
const fromPage = ref<LibraryItem | null>(null);

const item = computed<LibraryItem | null>(() => {
  const r = ref_.value;
  if (!r) return null;
  if (r.kind === 'playlist') return lib.value.playlists.find((p) => p.id === r.playlistId) ?? (fromPage.value?.id === r.playlistId ? fromPage.value : null);
  const handle = r.handle?.toLowerCase();
  const found = lib.value.channels.find((c) => c.id === r.channelId || (handle && c.handle?.toLowerCase() === handle));
  if (found) return found;
  const page = fromPage.value?.kind === 'channel' ? fromPage.value : null;
  return (page && lib.value.channels.find((c) => c.id === page.id)) ?? page;
});

// Channels the user isn't subscribed to (or playlists not in the library yet)
// are read from the page itself, so they can still be filed.
watch(
  currentUrl,
  async () => {
    fromPage.value = null;
    // The page's data arrives with the navigation; give it a moment.
    await new Promise((r) => setTimeout(r, 300));
    if (!item.value && ref_.value) fromPage.value = await callBridge('pageItem', 5000).catch(() => null);
  },
  { immediate: true },
);

const memberOf = computed(() => (item.value ? foldersOf(org.value, item.value.id) : []));
const memberIds = computed(() => new Set(memberOf.value.map((f) => f.id)));

const rows = computed(() => {
  if (!item.value) return [];
  const out: { id: string; name: string; color?: string; icon?: string; depth: number }[] = [];
  const walk = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      out.push({ id: n.folder.id, name: n.folder.name, color: n.folder.color, icon: n.folder.icon, depth: n.depth });
      walk(n.children);
    });
  walk(buildTree(org.value, treeOf(item.value.kind)));
  return out;
});

const open = ref(false);
const button = ref<HTMLButtonElement>();
const pos = ref({ top: 0, left: 0 });
function toggleOpen() {
  open.value = !open.value;
  const r = button.value?.getBoundingClientRect();
  if (r) pos.value = { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 300)) };
}

async function ensureInLibrary(it: LibraryItem) {
  const current = await libraryValue.get();
  const list = it.kind === 'channel' ? current.channels : current.playlists;
  if (!list.some((x) => x.id === it.id)) await libraryValue.set(upsertItem(current, it));
}

async function setMember(folderId: string, on: boolean) {
  const it = item.value;
  if (!it) return;
  await ensureInLibrary(it);
  await mutate((s) => (on ? addToFolder(s, [it.id], folderId) : removeFromFolder(s, [it.id], folderId)));
}

const newName = ref('');
async function create() {
  const it = item.value;
  const name = newName.value.trim();
  if (!it || !name) return;
  newName.value = '';
  await ensureInLibrary(it);
  await mutate((s) => {
    const [next, id] = createFolder(s, treeOf(it.kind), name);
    return addToFolder(next, [it.id], id);
  });
}

const root = ref<HTMLElement>();
const onDocClick = (e: MouseEvent) => {
  if (open.value && root.value && !e.composedPath().includes(root.value)) open.value = false;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') open.value = false;
};
onMounted(() => {
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKey);
});
watch(currentUrl, () => (open.value = false));

const label = computed(() => {
  const n = memberOf.value.length;
  return n === 0 ? 'Add to folder' : n === 1 ? memberOf.value[0]!.name : `In ${n} folders`;
});
</script>

<template>
  <div v-if="item" ref="root" class="wrap">
    <button ref="button" class="ytf-btn" :class="{ on: memberOf.length }" :aria-expanded="open" aria-haspopup="dialog" @click="toggleOpen">
      <Icon name="folder" :size="18" />
      {{ label }}
    </button>
    <div v-if="open" class="pop" role="dialog" aria-label="Folders" :style="{ top: `${pos.top}px`, left: `${pos.left}px` }">
      <p class="head">{{ item.kind === 'channel' ? 'Subscription folders' : 'Playlist folders' }}</p>
      <p v-if="item.kind === 'channel' && !lib.channels.some((c) => c.id === item!.id)" class="hint">You're not subscribed to this channel; it will still show in your folders.</p>
      <label v-for="r in rows" :key="r.id" class="row" :style="{ paddingLeft: `${10 + r.depth * 20}px` }">
        <input type="checkbox" :checked="memberIds.has(r.id)" @change="setMember(r.id, ($event.target as HTMLInputElement).checked)" />
        <FolderGlyph :color="r.color" :icon="r.icon" :size="18" />
        <span>{{ r.name }}</span>
      </label>
      <p v-if="!rows.length" class="hint">No folders yet. Name one below.</p>
      <form class="new" @submit.prevent="create">
        <Icon name="plus" :size="18" />
        <input v-model="newName" placeholder="New folder…" aria-label="New folder name" />
      </form>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: inline-flex;
  margin-left: 8px;
  font-family: var(--ytf-font);
}
.ytf-btn.on {
  background: var(--ytf-accent-bg);
  color: var(--ytf-accent);
}
.pop {
  position: fixed;
  z-index: 2300;
  width: 290px;
  max-height: 60vh;
  overflow: auto;
  background: var(--ytf-menu);
  color: var(--ytf-text);
  border-radius: 12px;
  box-shadow: var(--ytf-shadow);
  padding: 8px;
}
.head {
  margin: 4px 10px 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ytf-text-2);
}
.hint {
  margin: 4px 10px 8px;
  font-size: 13px;
  color: var(--ytf-text-2);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding-right: 10px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.row:hover {
  background: var(--ytf-hover);
}
.row input {
  width: 16px;
  height: 16px;
  accent-color: var(--ytf-accent);
}
.new {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 4px;
  margin-top: 6px;
  border-top: 1px solid var(--ytf-border);
  color: var(--ytf-text-2);
}
.new input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--ytf-text);
}
</style>
