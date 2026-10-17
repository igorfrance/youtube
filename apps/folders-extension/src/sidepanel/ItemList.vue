<script setup lang="ts">
import type { LibraryItem } from '@yt/shared';
import { Icon, Thumb, writeDrag } from '@yt/ui';
import { ref, watch } from 'vue';
import { useOrg } from '../lib/store';
import { foldersOf } from '../model/org';

/**
 * Selectable, draggable list of channels or playlists. Click toggles,
 * Shift+click selects a range; dragging takes the whole selection along.
 */
const props = defineProps<{ items: LibraryItem[]; folderId: string | null }>();
const selected = defineModel<Set<string>>('selected', { required: true });

const org = useOrg();
const anchor = ref<number>();
watch(() => props.folderId, () => (anchor.value = undefined));

function toggle(i: number, e: MouseEvent) {
  const next = new Set(selected.value);
  const id = props.items[i]!.id;
  if (e.shiftKey && anchor.value !== undefined) {
    const [a, b] = [Math.min(anchor.value, i), Math.max(anchor.value, i)];
    for (let k = a; k <= b; k++) next.add(props.items[k]!.id);
  } else if (next.has(id)) next.delete(id);
  else next.add(id);
  anchor.value = i;
  selected.value = next;
}

function dragStart(it: LibraryItem, e: DragEvent) {
  const ids = selected.value.has(it.id) ? [...selected.value] : [it.id];
  writeDrag(e, { kind: 'items', ids, from: props.folderId });
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
}

const otherFolders = (it: LibraryItem) =>
  foldersOf(org.value, it.id)
    .filter((f) => f.id !== props.folderId)
    .map((f) => f.name);
</script>

<template>
  <ul class="list" role="listbox" aria-multiselectable="true" aria-label="Items">
    <li
      v-for="(it, i) in items"
      :key="it.id"
      role="option"
      :aria-selected="selected.has(it.id)"
      class="row"
      draggable="true"
      @dragstart="dragStart(it, $event)"
      @click="toggle(i, $event)"
    >
      <input type="checkbox" tabindex="-1" :checked="selected.has(it.id)" aria-hidden="true" @click.prevent />
      <Icon name="grip" :size="16" class="grip" />
      <Thumb :src="it.thumbnail" :title="it.title" :round="it.kind === 'channel'" :size="32" />
      <span class="text">
        <span class="title" :class="{ missing: it.missing }">{{ it.title }}</span>
        <span class="sub">
          <template v-if="it.missing">No longer in your library</template>
          <template v-else-if="otherFolders(it).length">Also in {{ otherFolders(it).join(', ') }}</template>
          <template v-else-if="it.kind === 'playlist'">{{ [it.owner, it.videoCount !== undefined ? `${it.videoCount} videos` : ''].filter(Boolean).join(' · ') }}</template>
          <template v-else>{{ it.handle ?? '' }}</template>
        </span>
      </span>
      <a class="open" :href="`https://www.youtube.com${it.url}`" target="_blank" rel="noreferrer" :aria-label="`Open ${it.title} on YouTube`" title="Open on YouTube" @click.stop>
        <Icon name="chevron" :size="16" />
      </a>
    </li>
    <li v-if="!items.length" class="empty">Nothing here.</li>
  </ul>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--ytf-radius);
  cursor: pointer;
  user-select: none;
}
.row:hover {
  background: var(--ytf-hover);
}
.row[aria-selected='true'] {
  background: var(--ytf-accent-bg);
}
.row input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--ytf-accent);
  pointer-events: none;
}
.grip {
  color: var(--ytf-text-2);
  cursor: grab;
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.title,
.sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title {
  font-size: 14px;
  font-weight: 500;
}
.title.missing {
  text-decoration: line-through;
  color: var(--ytf-text-2);
}
.sub {
  font-size: 12px;
  color: var(--ytf-text-2);
}
.open {
  color: var(--ytf-text-2);
  display: inline-flex;
  padding: 6px;
  border-radius: 50%;
}
.open:hover {
  background: var(--ytf-active);
}
.empty {
  padding: 16px;
  color: var(--ytf-text-2);
  font-size: 14px;
}
</style>
