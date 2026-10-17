<script setup lang="ts">
import { provide, ref, toRef } from 'vue';
import FolderTreeNode from './FolderTreeNode.vue';
import { readDrag, TREE_CONTEXT, writeDrag, type DragPayload, type UiTreeNode } from './tree';

/**
 * A collapsible, optionally drag-and-drop folder tree. The `item` slot renders
 * extra rows (channels, playlists) under an expanded folder.
 */
const props = withDefaults(
  defineProps<{
    nodes: UiTreeNode[];
    selectedId?: string;
    /** Folders can be dragged to re-parent or reorder them. */
    draggable?: boolean;
    /** Folders accept dropped items/folders. */
    acceptsDrop?: boolean;
    label: string;
  }>(),
  { draggable: false, acceptsDrop: false },
);

const emit = defineEmits<{
  select: [id: string, e: MouseEvent];
  toggle: [id: string];
  menu: [id: string, e: MouseEvent];
  drop: [targetId: string, payload: DragPayload];
}>();

const dropTargetId = ref<string>();

provide(TREE_CONTEXT, {
  selectedId: toRef(props, 'selectedId'),
  dropTargetId,
  draggable: toRef(props, 'draggable'),
  acceptsDrop: toRef(props, 'acceptsDrop'),
  select: (id, e) => emit('select', id, e),
  toggle: (id) => emit('toggle', id),
  menu: (id, e) => emit('menu', id, e),
  dragStart: (id, e) => writeDrag(e, { kind: 'folder', id }),
  dragOver(id, e) {
    if (!props.acceptsDrop) return;
    e.preventDefault();
    dropTargetId.value = id;
  },
  dragLeave(id) {
    if (dropTargetId.value === id) dropTargetId.value = undefined;
  },
  drop(id, e) {
    dropTargetId.value = undefined;
    const payload = readDrag(e);
    if (payload && !(payload.kind === 'folder' && payload.id === id)) emit('drop', id, payload);
  },
});
</script>

<template>
  <ul class="tree" role="tree" :aria-label="label">
    <FolderTreeNode v-for="n in nodes" :key="n.id" :node="n" :depth="0">
      <template #item="slotProps"><slot name="item" v-bind="slotProps" /></template>
    </FolderTreeNode>
  </ul>
</template>

<style scoped>
.tree {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
