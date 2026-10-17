<script setup lang="ts">
import { fuzzyScore } from '@yt/shared';
import { FolderGlyph, FolderTree, Icon, readDrag, type DragPayload } from '@yt/ui';
import { computed, ref, watch } from 'vue';
import { toBackground } from '../lib/messages';
import { orgStore, mutate, useLibrary, useOrg } from '../lib/store';
import { isUnsorted, itemsInFolder, kindOfTree, timeAgo, treeView, UNSORTED } from '../lib/view';
import { itemsOf } from '../model/library';
import {
  addToFolder,
  buildTree,
  createFolder,
  getFolder,
  moveFolder,
  moveItems,
  parseExport,
  removeFromFolder,
  toExport,
  updateFolder,
  type TreeKind,
  type TreeNode,
} from '../model/org';
import AccountDialog from './AccountDialog.vue';
import FolderBar from './FolderBar.vue';
import ItemList from './ItemList.vue';

const org = useOrg();
const lib = useLibrary();

const tree = ref<TreeKind>('subscriptions');
/** Selected folder id; '' means "All", an UNSORTED id the unsorted items. */
const folderId = ref<string>(UNSORTED.subscriptions);
const selected = ref(new Set<string>());
const filter = ref('');
const unsortedCollapsed = ref(true);

watch(tree, (t) => {
  folderId.value = UNSORTED[t];
  filter.value = '';
});
watch(folderId, () => (selected.value = new Set()));
// If the selected folder is deleted (here or elsewhere), fall back to Unsorted.
watch(org, (s) => {
  if (folderId.value && !isUnsorted(folderId.value) && !getFolder(s, folderId.value)) folderId.value = UNSORTED[tree.value];
});

const nodes = computed(() => treeView(org.value, lib.value, tree.value, unsortedCollapsed.value));

const listItems = computed(() => {
  const all = folderId.value ? itemsInFolder(org.value, lib.value, folderId.value) : itemsOf(lib.value, kindOfTree(tree.value));
  const q = filter.value.trim();
  if (!q) return all;
  return all
    .map((it) => ({ it, s: fuzzyScore(q, it.title) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
});

/** Real folders of this tree, flattened, as bulk "add to" targets. */
const targets = computed(() => {
  const out: { id: string; name: string; color?: string; icon?: string; depth: number }[] = [];
  const walk = (ns: TreeNode[]) =>
    ns.forEach((n) => {
      out.push({ id: n.folder.id, name: n.folder.name, color: n.folder.color, icon: n.folder.icon, depth: n.depth });
      walk(n.children);
    });
  walk(buildTree(org.value, tree.value));
  return out.filter((t) => t.id !== folderId.value);
});
const inRealFolder = computed(() => !!folderId.value && !isUnsorted(folderId.value));

/** After deleting a folder FolderBar asks for its parent ('' at the top level → Unsorted). */
const selectAfterEdit = (id: string) => (folderId.value = id || UNSORTED[tree.value]);

function toggle(id: string) {
  if (isUnsorted(id)) unsortedCollapsed.value = !unsortedCollapsed.value;
  else void mutate((s) => updateFolder(s, id, { collapsed: !getFolder(s, id)?.collapsed }));
}

async function newFolder() {
  let id = '';
  await mutate((s) => {
    const [next, newId] = createFolder(s, tree.value, 'New folder');
    id = newId;
    return next;
  });
  folderId.value = id;
}

/** Dropping items adds them (and, from a real folder, moves them unless Ctrl/Alt is held). */
const copyModifier = ref(false);
function onDrop(target: string, payload: DragPayload) {
  if (payload.kind === 'folder') {
    if (!isUnsorted(target)) void mutate((s) => moveFolder(s, payload.id, target));
    return;
  }
  if (isUnsorted(target)) {
    if (payload.from && !isUnsorted(payload.from)) void mutate((s) => removeFromFolder(s, payload.ids, payload.from!));
    return;
  }
  const from = payload.from && !isUnsorted(payload.from) && !copyModifier.value ? payload.from : null;
  void mutate((s) => moveItems(s, payload.ids, from, target));
  selected.value = new Set();
}
const trackModifier = (e: DragEvent) => (copyModifier.value = e.ctrlKey || e.altKey || e.metaKey);

const rootDrop = ref(false);
function onRootDrop(e: DragEvent) {
  rootDrop.value = false;
  const p = readDrag(e);
  if (p?.kind === 'folder') void mutate((s) => moveFolder(s, p.id, null));
}

const addTo = (target: string) => {
  const ids = [...selected.value];
  void mutate((s) => addToFolder(s, ids, target));
  selected.value = new Set();
};
const removeHere = () => {
  const ids = [...selected.value];
  const from = folderId.value;
  void mutate((s) => removeFromFolder(s, ids, from));
  selected.value = new Set();
};

// --- Library, export/import, settings ---------------------------------------
const refreshing = ref(false);
const message = ref('');
async function refresh() {
  refreshing.value = true;
  message.value = '';
  const res = await toBackground({ type: 'library:refresh' });
  refreshing.value = false;
  if (!res.ok) message.value = res.error ?? 'Refresh failed.';
}

function exportFile() {
  const url = URL.createObjectURL(new Blob([toExport(org.value)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube-folders-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
const fileInput = ref<HTMLInputElement>();
async function importFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const next = parseExport(await file.text());
    if (!confirm(`Replace your folders with the ${next.folders.length} folders in "${file.name}"?`)) return;
    await mutate(() => next);
    message.value = `Imported ${next.folders.length} folders.`;
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
  } finally {
    (e.target as HTMLInputElement).value = '';
  }
}

// --- Changes on YouTube (unsubscribe, delete, merge) -------------------------
const dialog = ref<'delete' | 'merge' | null>(null);
/** Selected items in the order they were selected. */
const selectedItems = computed(() => {
  const all = itemsOf(lib.value, kindOfTree(tree.value));
  return [...selected.value].map((id) => all.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
});
watch(tree, () => (dialog.value = null));

const showSettings = ref(false);
const counts = computed(() => `${lib.value.channels.length} channels · ${lib.value.playlists.length} playlists`);
</script>

<template>
  <div class="app" @dragover="trackModifier">
    <header>
      <h1>Folders for YouTube</h1>
      <button class="ytf-icon-btn" aria-label="Refresh from YouTube" title="Refresh from YouTube" :disabled="refreshing" @click="refresh">
        <Icon name="refresh" :class="{ spin: refreshing }" />
      </button>
      <button class="ytf-icon-btn" aria-label="Settings" title="Settings" :aria-expanded="showSettings" @click="showSettings = !showSettings">
        <Icon name="settings" />
      </button>
    </header>

    <div v-if="showSettings" class="settings">
      <label>
        <input
          type="checkbox"
          :checked="org.settings.replaceNativeSubscriptions"
          @change="mutate((s) => ({ ...s, settings: { ...s.settings, replaceNativeSubscriptions: !s.settings.replaceNativeSubscriptions } }))"
        />
        Hide YouTube's own subscription list in the sidebar
      </label>
      <label>
        <input
          type="checkbox"
          :checked="org.settings.feedShowShorts"
          @change="mutate((s) => ({ ...s, settings: { ...s.settings, feedShowShorts: !s.settings.feedShowShorts } }))"
        />
        Show Shorts in folder feeds
      </label>
      <div class="row-btns">
        <button class="ytf-btn" @click="exportFile"><Icon name="download" :size="16" /> Export</button>
        <button class="ytf-btn" @click="fileInput?.click()"><Icon name="upload" :size="16" /> Import</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
      </div>
      <p class="small">Quick switcher: Alt+Shift+F on YouTube (change it at chrome://extensions/shortcuts).</p>
    </div>

    <div class="tabs" role="tablist">
      <button v-for="t in ['subscriptions', 'playlists'] as const" :key="t" role="tab" :aria-selected="tree === t" @click="tree = t">
        {{ t === 'subscriptions' ? 'Subscriptions' : 'Playlists' }}
      </button>
    </div>

    <div class="folders">
      <div class="folders-head">
        <span>Folders</span>
        <button class="link" @click="newFolder">+ New folder</button>
      </div>
      <button class="all" :class="{ on: folderId === '' }" @click="folderId = ''">
        <Icon name="playlist" :size="18" /> All {{ tree === 'subscriptions' ? 'channels' : 'playlists' }}
        <span class="count">{{ itemsOf(lib, kindOfTree(tree)).length }}</span>
      </button>
      <FolderTree
        :nodes="nodes"
        :label="`${tree} folders`"
        :selected-id="folderId"
        draggable
        accepts-drop
        @select="(id) => (folderId = id)"
        @toggle="toggle"
        @drop="onDrop"
      />
      <div
        class="root-drop"
        :class="{ on: rootDrop }"
        @dragover.prevent="rootDrop = true"
        @dragleave="rootDrop = false"
        @drop="onRootDrop"
      >
        Drop a folder here to move it to the top level
      </div>
    </div>

    <FolderBar :folder-id="folderId" :count="listItems.length" @select="selectAfterEdit" />

    <div class="filter">
      <Icon name="search" :size="16" />
      <input v-model="filter" :placeholder="tree === 'subscriptions' ? 'Filter channels' : 'Filter playlists'" aria-label="Filter" />
      <span class="hint">Drag onto a folder, or select</span>
    </div>

    <div class="items">
      <ItemList v-model:selected="selected" :items="listItems" :folder-id="folderId || null" />
    </div>

    <div v-if="selected.size" class="bulk">
      <div class="bulk-head">
        <strong>{{ selected.size }} selected</strong>
        <button v-if="inRealFolder" class="link" @click="removeHere">Remove from this folder</button>
        <button class="link" @click="selected = new Set()">Clear</button>
      </div>
      <div class="account">
        <button v-if="tree === 'playlists'" class="ytf-btn" @click="dialog = 'merge'"><Icon name="playlist" :size="16" /> Merge…</button>
        <button class="ytf-btn danger" @click="dialog = 'delete'">
          <Icon name="trash" :size="16" /> {{ tree === 'subscriptions' ? 'Unsubscribe…' : 'Delete…' }}
        </button>
      </div>
      <div class="chips">
        <button v-for="t in targets" :key="t.id" class="chip" @click="addTo(t.id)">
          <FolderGlyph :color="t.color" :icon="t.icon" :size="16" /> {{ t.name }}
        </button>
        <span v-if="!targets.length" class="small">Create a folder first.</span>
      </div>
      <span class="small">Adding keeps items in their other folders too.</span>
    </div>

    <AccountDialog
      v-if="dialog"
      :mode="dialog"
      :items="selectedItems"
      :all-playlists="lib.playlists"
      @close="dialog = null"
      @done="selected = new Set()"
    />

    <footer>
      <span v-if="message" class="msg">{{ message }}</span>
      <span v-else-if="lib.error" class="msg">{{ lib.error }}</span>
      <span v-else-if="orgStore.syncError" class="msg">Couldn't sync to your Chrome profile: {{ orgStore.syncError }}</span>
      <span>{{ counts }}<template v-if="lib.fetchedAt"> · updated {{ timeAgo(lib.fetchedAt) }}</template></span>
    </footer>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  height: 100%;
  background: var(--ytf-bg);
  color: var(--ytf-text);
  font-family: var(--ytf-font);
  font-size: 14px;
}
#app {
  height: 100%;
}
</style>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid var(--ytf-border);
}
h1 {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ytf-border);
  background: var(--ytf-hover);
}
.settings label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-btns {
  display: flex;
  gap: 8px;
}
.small {
  font-size: 12px;
  color: var(--ytf-text-2);
  margin: 0;
}
.tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--ytf-border);
}
.tabs button {
  flex: 1;
  font: inherit;
  font-weight: 500;
  padding: 12px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ytf-text-2);
  cursor: pointer;
}
.tabs button[aria-selected='true'] {
  color: var(--ytf-text);
  border-bottom-color: var(--ytf-text);
}
.folders {
  padding: 8px 8px 4px;
  max-height: 40vh;
  overflow: auto;
  border-bottom: 1px solid var(--ytf-border);
}
.folders-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ytf-text-2);
}
.link {
  border: none;
  background: transparent;
  color: var(--ytf-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 4px;
  text-transform: none;
  letter-spacing: normal;
}
.all {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: transparent;
  color: var(--ytf-text);
  font: inherit;
  min-height: 40px;
  padding: 0 10px 0 28px;
  border-radius: var(--ytf-radius);
  cursor: pointer;
}
.all:hover {
  background: var(--ytf-hover);
}
.all.on {
  background: var(--ytf-active);
}
.count {
  margin-left: auto;
  font-size: 12px;
  color: var(--ytf-text-2);
}
.root-drop {
  margin: 4px 0;
  padding: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--ytf-text-2);
  border: 1px dashed transparent;
  border-radius: 8px;
}
.root-drop.on {
  border-color: var(--ytf-accent);
  color: var(--ytf-accent);
}
.filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 6px;
  padding: 6px 10px;
  border: 1px solid var(--ytf-border);
  border-radius: 8px;
  color: var(--ytf-text-2);
}
.filter input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: var(--ytf-text);
}
.hint {
  font-size: 11px;
  white-space: nowrap;
}
.items {
  flex: 1;
  overflow: auto;
}
.bulk {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--ytf-border);
  background: var(--ytf-raised);
}
.bulk-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bulk-head strong {
  flex: 1;
}
.account {
  display: flex;
  gap: 6px;
}
.account .danger {
  color: var(--ytf-danger);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--ytf-text);
  background: var(--ytf-hover);
  border: none;
  border-radius: 16px;
  padding: 6px 12px;
  cursor: pointer;
}
.chip:hover {
  background: var(--ytf-active);
}
footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px;
  border-top: 1px solid var(--ytf-border);
  font-size: 12px;
  color: var(--ytf-text-2);
}
.msg {
  color: var(--ytf-text);
}
</style>
