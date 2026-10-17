<script setup lang="ts">
import { FolderTree, Icon, Thumb, type UiTreeNode } from '@yt/ui';
import { computed, ref } from 'vue';
import { toBackground } from '../lib/messages';
import { refreshLibrary } from '../lib/library-sync';
import { mutate, useLibrary, useOrg } from '../lib/store';
import { isUnsorted, itemsInFolder, treeOfUnsorted, treeView } from '../lib/view';
import { createFolder, getFolder, updateFolder, type TreeKind } from '../model/org';
import { openFolderId, unsortedCollapsed } from './ui-state';

const org = useOrg();
const lib = useLibrary();

const trees = computed(() =>
  (['subscriptions', 'playlists'] as const).map((tree) => ({
    tree,
    title: tree === 'subscriptions' ? 'Subscriptions' : 'Playlists',
    allHref: tree === 'subscriptions' ? '/feed/channels' : '/feed/playlists',
    nodes: treeView(org.value, lib.value, tree, unsortedCollapsed.value[tree]),
  })),
);

const empty = computed(() => !lib.value.channels.length && !lib.value.playlists.length);
const refreshing = ref(false);
async function retry() {
  refreshing.value = true;
  await refreshLibrary();
  refreshing.value = false;
}

function toggle(id: string) {
  if (isUnsorted(id)) {
    const tree = treeOfUnsorted(id);
    unsortedCollapsed.value = { ...unsortedCollapsed.value, [tree]: !unsortedCollapsed.value[tree] };
    return;
  }
  const f = getFolder(org.value, id);
  if (f) void mutate((s) => updateFolder(s, id, { collapsed: !f.collapsed }));
}

const newFolderIn = ref<TreeKind | null>(null);
const newName = ref('');
function startNew(tree: TreeKind) {
  newFolderIn.value = tree;
  newName.value = '';
}
async function commitNew() {
  const tree = newFolderIn.value;
  newFolderIn.value = null;
  if (tree && newName.value.trim()) await mutate((s) => createFolder(s, tree, newName.value)[0]);
}

/** Focuses an input as soon as it appears. */
const vFocus = { mounted: (el: HTMLElement) => el.focus() };

const itemsFor = (node: UiTreeNode) => itemsInFolder(org.value, lib.value, node.id);

function organize() {
  void toBackground({ type: 'sidepanel:open' });
}
</script>

<template>
  <div class="sidebar">
    <section v-for="t in trees" :key="t.tree" class="section">
      <div class="head">
        <a class="title" :href="t.allHref">{{ t.title }}</a>
        <button class="ytf-icon-btn" :aria-label="`New ${t.title.toLowerCase()} folder`" title="New folder" @click="startNew(t.tree)">
          <Icon name="plus" :size="18" />
        </button>
        <button class="ytf-icon-btn" aria-label="Organize folders" title="Organize folders" @click="organize">
          <Icon name="edit" :size="18" />
        </button>
      </div>

      <form v-if="newFolderIn === t.tree" class="new" @submit.prevent="commitNew">
        <input v-model="newName" class="ytf-input" placeholder="Folder name" aria-label="Folder name" v-focus @blur="commitNew" @keydown.esc="newFolderIn = null" />
      </form>

      <FolderTree :nodes="t.nodes" :label="`${t.title} folders`" :selected-id="openFolderId ?? undefined" @select="(id) => (openFolderId = id)" @toggle="toggle">
        <template #item="{ node, depth }">
          <li v-for="it in itemsFor(node)" :key="it.id" class="item">
            <a :href="it.url" :style="{ paddingLeft: `${28 + (depth - 1) * 16}px` }" :title="it.missing ? 'No longer in your library' : it.title">
              <Thumb :src="it.thumbnail" :title="it.title" :round="it.kind === 'channel'" :size="24" />
              <span class="label" :class="{ missing: it.missing }">{{ it.title }}</span>
            </a>
          </li>
        </template>
      </FolderTree>
    </section>

    <p v-if="empty" class="note">
      <template v-if="lib.error">Couldn't read your library: {{ lib.error }}</template>
      <template v-else>Reading your subscriptions and playlists…</template>
      <button class="ytf-btn" :disabled="refreshing" @click="retry"><Icon name="refresh" :size="16" /> Try again</button>
    </p>
    <p v-else-if="!org.folders.length" class="note">
      Create folders here with +, or open the organizer to sort everything at once.
    </p>

    <button class="native-toggle" @click="mutate((s) => ({ ...s, settings: { ...s.settings, replaceNativeSubscriptions: !s.settings.replaceNativeSubscriptions } }))">
      {{ org.settings.replaceNativeSubscriptions ? "Show YouTube's subscription list" : "Hide YouTube's subscription list" }}
    </button>
  </div>
</template>

<style scoped>
.sidebar {
  font-family: var(--ytf-font);
  color: var(--ytf-text);
  padding: 4px 12px 12px;
  border-bottom: 1px solid var(--ytf-border);
}
.section + .section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ytf-border);
}
.head {
  display: flex;
  align-items: center;
  padding: 6px 0 6px 12px;
}
.title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--ytf-text);
  text-decoration: none;
}
.title:hover {
  text-decoration: underline;
}
.new {
  display: flex;
  padding: 4px 4px 8px;
}
.new input {
  flex: 1;
}
.item {
  list-style: none;
}
.item a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding-right: 10px;
  border-radius: var(--ytf-radius);
  color: var(--ytf-text);
  text-decoration: none;
  font-size: 14px;
}
.item a:hover {
  background: var(--ytf-hover);
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label.missing {
  color: var(--ytf-text-2);
  text-decoration: line-through;
}
.note {
  font-size: 13px;
  color: var(--ytf-text-2);
  padding: 4px 12px;
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.native-toggle {
  border: none;
  background: transparent;
  color: var(--ytf-accent);
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  cursor: pointer;
}
</style>
