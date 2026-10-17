<script setup lang="ts">
import { computed, inject } from 'vue';
import FolderGlyph from './FolderGlyph.vue';
import Icon from './Icon.vue';
import { TREE_CONTEXT, type UiTreeNode } from './tree';

defineOptions({ name: 'FolderTreeNode' });
const props = defineProps<{ node: UiTreeNode; depth: number }>();
defineSlots<{ item(props: { node: UiTreeNode; depth: number }): unknown }>();

const ctx = inject(TREE_CONTEXT)!;
const open = computed(() => !props.node.collapsed);
const selected = computed(() => ctx.selectedId.value === props.node.id);
const dropping = computed(() => ctx.dropTargetId.value === props.node.id);
</script>

<template>
  <li role="treeitem" :aria-expanded="open" :aria-selected="selected">
    <div
      class="row"
      :class="{ selected, dropping }"
      :style="{ paddingLeft: `${4 + depth * 16}px` }"
      :draggable="ctx.draggable.value"
      @dragstart="ctx.dragStart(node.id, $event)"
      @dragover="ctx.dragOver(node.id, $event)"
      @dragleave="ctx.dragLeave(node.id)"
      @drop="ctx.drop(node.id, $event)"
      @contextmenu.prevent="ctx.menu(node.id, $event)"
    >
      <button class="toggle" :aria-label="`${open ? 'Collapse' : 'Expand'} ${node.name}`" @click="ctx.toggle(node.id)">
        <Icon name="chevron" :size="14" :class="{ open }" />
      </button>
      <button class="name" @click="ctx.select(node.id, $event)">
        <FolderGlyph :color="node.color" :icon="node.icon" :size="20" />
        <span class="label">{{ node.name }}</span>
        <span v-if="node.count !== undefined" class="count">{{ node.count }}</span>
      </button>
    </div>
    <ul v-if="open" class="children" role="group">
      <FolderTreeNode v-for="c in node.children" :key="c.id" :node="c" :depth="depth + 1">
        <template #item="slotProps"><slot name="item" v-bind="slotProps" /></template>
      </FolderTreeNode>
      <slot name="item" :node="node" :depth="depth + 1" />
    </ul>
  </li>
</template>

<style scoped>
li {
  list-style: none;
}
.children {
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  border-radius: var(--ytf-radius);
  min-height: 40px;
}
.row:hover {
  background: var(--ytf-hover);
}
.row.selected {
  background: var(--ytf-active);
}
.row.dropping {
  background: var(--ytf-accent-bg);
  box-shadow: inset 0 0 0 2px var(--ytf-accent);
}
.toggle {
  width: 24px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--ytf-text-2);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.toggle svg {
  transition: transform 0.15s;
}
.toggle svg.open {
  transform: rotate(90deg);
}
.name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: transparent;
  color: var(--ytf-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px 8px 4px;
  cursor: pointer;
  text-align: left;
}
.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  font-size: 12px;
  color: var(--ytf-text-2);
}
button:focus-visible {
  outline: 2px solid var(--ytf-accent);
  outline-offset: -2px;
  border-radius: 8px;
}
</style>
