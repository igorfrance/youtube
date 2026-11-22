<script setup lang="ts">
import { FolderGlyph, FolderStylePicker, Icon } from '@yt/ui';
import { computed, ref, watch } from 'vue';
import { mutate, useOrg } from '../lib/store';
import { folderLabel, isUnsorted } from '../lib/view';
import { createFolder, deleteFolder, getFolder, updateFolder } from '../model/org';

/** Header for the selected folder: rename, color and icon, sub-folder, delete. */
const props = defineProps<{ folderId: string; count: number }>();
const emit = defineEmits<{ select: [id: string] }>();

const org = useOrg();
const folder = computed(() => getFolder(org.value, props.folderId));
const name = ref('');
watch(folder, (f) => (name.value = f?.name ?? ''), { immediate: true });

function rename() {
  const n = name.value.trim();
  if (folder.value && n && n !== folder.value.name) void mutate((s) => updateFolder(s, props.folderId, { name: n }));
  else name.value = folder.value?.name ?? '';
}

const editing = ref(false);
const confirming = ref(false);
watch(() => props.folderId, () => {
  editing.value = false;
  confirming.value = false;
});

async function addSub() {
  const f = folder.value;
  if (!f) return;
  let id = '';
  await mutate((s) => {
    const [next, newId] = createFolder(updateFolder(s, f.id, { collapsed: false }), f.tree, 'New folder', f.id);
    id = newId;
    return next;
  });
  emit('select', id);
}

async function remove() {
  const f = folder.value;
  if (!f) return;
  await mutate((s) => deleteFolder(s, f.id));
  emit('select', f.parentId ?? '');
}
</script>

<template>
  <div class="bar">
    <div class="title">
      <button v-if="folder" class="glyph-btn" :aria-expanded="editing" aria-label="Color and icon" title="Color and icon" @click="editing = !editing">
        <FolderGlyph :color="folder.color" :icon="folder.icon" :size="22" />
      </button>
      <FolderGlyph v-else :size="22" />
      <input
        v-if="folder"
        v-model="name"
        class="name"
        aria-label="Folder name"
        @blur="rename"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.esc="name = folder.name; ($event.target as HTMLInputElement).blur()"
      />
      <span v-else class="name static">{{ isUnsorted(folderId) ? 'Unsorted' : 'All' }}</span>
      <span class="count">{{ count }}</span>
      <button v-if="folder" class="ytf-icon-btn" :aria-expanded="editing" aria-label="Folder options" title="Folder options" @click="editing = !editing">
        <Icon name="more" />
      </button>
    </div>
    <p v-if="folder && folder.parentId" class="path">{{ folderLabel(org, folder.id) }}</p>

    <div v-if="folder && editing" class="edit">
      <FolderStylePicker :color="folder.color" :icon="folder.icon" @change="(patch) => mutate((s) => updateFolder(s, folderId, patch))" />
      <div class="actions">
        <button class="ytf-btn" @click="addSub"><Icon name="plus" :size="16" /> Sub-folder</button>
        <button v-if="!confirming" class="ytf-btn danger" @click="confirming = true"><Icon name="trash" :size="16" /> Delete</button>
        <template v-else>
          <span class="confirm">Delete "{{ folder.name }}"? Its contents move up a level.</span>
          <button class="ytf-btn danger" @click="remove">Delete</button>
          <button class="ytf-btn" @click="confirming = false">Cancel</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar {
  padding: 8px 12px;
}
.title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  color: var(--ytf-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
}
.name:hover:not(.static),
.name:focus {
  border-color: var(--ytf-border);
  outline: none;
}
.count {
  color: var(--ytf-text-2);
  font-size: 13px;
}
.path {
  margin: 2px 0 0 38px;
  font-size: 12px;
  color: var(--ytf-text-2);
}
.edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding: 10px;
  border-radius: var(--ytf-radius);
  background: var(--ytf-hover);
}
.glyph-btn {
  display: inline-flex;
  padding: 4px;
  margin: -4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.glyph-btn:hover {
  background: var(--ytf-active);
}
.glyph-btn:focus-visible {
  outline: 2px solid var(--ytf-accent);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.danger {
  color: var(--ytf-danger);
}
.confirm {
  font-size: 13px;
  flex-basis: 100%;
}
</style>
