<script setup lang="ts">
import { fuzzyScore } from '@yt/shared';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import FolderGlyph from './FolderGlyph.vue';
import Icon from './Icon.vue';
import Thumb from './Thumb.vue';

export interface PaletteEntry {
  id: string;
  label: string;
  group: string;
  hint?: string;
  /** Folders show a folder glyph; others show a thumbnail. */
  folder?: { color?: string; icon?: string };
  thumbnail?: string;
  round?: boolean;
}

const props = withDefaults(defineProps<{ entries: PaletteEntry[]; placeholder?: string; limit?: number }>(), {
  placeholder: 'Search',
  limit: 40,
});
const emit = defineEmits<{ pick: [entry: PaletteEntry, alt: boolean]; close: [] }>();

const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement>();
const list = ref<HTMLElement>();

const results = computed(() => {
  const scored = props.entries
    .map((e) => ({ e, s: Math.max(fuzzyScore(query.value, e.label), fuzzyScore(query.value, e.hint ?? '') * 0.5) }))
    .filter((x) => x.s > 0);
  if (query.value.trim()) scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, props.limit).map((x) => x.e);
});

/** Results grouped for display, keeping the overall order for keyboard navigation. */
const groups = computed(() => {
  const out: { name: string; rows: { entry: PaletteEntry; index: number }[] }[] = [];
  results.value.forEach((entry, index) => {
    let g = out.find((x) => x.name === entry.group);
    if (!g) out.push((g = { name: entry.group, rows: [] }));
    g.rows.push({ entry, index });
  });
  return out;
});

watch(query, () => (active.value = 0));
onMounted(() => input.value?.focus());

function move(delta: number) {
  const n = results.value.length;
  if (!n) return;
  active.value = (active.value + delta + n) % n;
  void nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') move(1);
  else if (e.key === 'ArrowUp') move(-1);
  else if (e.key === 'Escape') emit('close');
  else if (e.key === 'Enter') {
    const entry = results.value[active.value];
    if (entry) emit('pick', entry, e.shiftKey);
  } else return;
  e.preventDefault();
}
</script>

<template>
  <div class="backdrop" @mousedown.self="emit('close')">
    <div class="palette" role="dialog" aria-label="Quick switcher" @keydown="onKey">
      <label class="search">
        <Icon name="search" :size="20" />
        <input
          ref="input"
          v-model="query"
          :placeholder="placeholder"
          role="combobox"
          aria-expanded="true"
          aria-controls="ytf-palette-list"
          aria-autocomplete="list"
        />
        <kbd>Esc</kbd>
      </label>
      <div id="ytf-palette-list" ref="list" class="list" role="listbox">
        <template v-for="g in groups" :key="g.name">
          <div class="group">{{ g.name }}</div>
          <div
            v-for="r in g.rows"
            :key="r.entry.id"
            class="row"
            role="option"
            :aria-selected="r.index === active"
            @mousemove="active = r.index"
            @click="emit('pick', r.entry, $event.shiftKey)"
          >
            <FolderGlyph v-if="r.entry.folder" :color="r.entry.folder.color" :icon="r.entry.folder.icon" :size="24" />
            <Thumb v-else :src="r.entry.thumbnail" :title="r.entry.label" :round="r.entry.round ?? true" :size="28" />
            <span class="label">{{ r.entry.label }}</span>
            <span v-if="r.entry.hint" class="hint">{{ r.entry.hint }}</span>
          </div>
        </template>
        <div v-if="!results.length" class="empty">No matches</div>
      </div>
      <div class="foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Shift</kbd>+<kbd>Enter</kbd> open folder feed</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  font-family: var(--ytf-font);
}
.palette {
  width: min(640px, calc(100vw - 32px));
  background: var(--ytf-menu);
  color: var(--ytf-text);
  border-radius: 16px;
  box-shadow: var(--ytf-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ytf-border);
  color: var(--ytf-text-2);
}
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  color: var(--ytf-text);
}
.list {
  max-height: 50vh;
  overflow: auto;
  padding: 6px;
}
.group {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ytf-text-2);
  padding: 10px 10px 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
}
.row[aria-selected='true'] {
  background: var(--ytf-hover);
}
.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint {
  font-size: 13px;
  color: var(--ytf-text-2);
  white-space: nowrap;
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--ytf-text-2);
}
.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 18px;
  border-top: 1px solid var(--ytf-border);
  font-size: 12px;
  color: var(--ytf-text-2);
}
kbd {
  font: inherit;
  font-size: 11px;
  border: 1px solid var(--ytf-border);
  border-radius: 4px;
  padding: 1px 5px;
  margin: 0 2px;
}
</style>
