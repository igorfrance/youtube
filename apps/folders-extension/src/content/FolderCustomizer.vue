<script setup lang="ts">
import { FolderGlyph, FolderStylePicker, type FolderStylePatch } from '@yt/ui';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mutate, useOrg } from '../lib/store';
import { getFolder, updateFolder } from '../model/org';

/** A popover next to a folder in YouTube's sidebar to rename it and pick its color and icon. */
const props = defineProps<{ folderId: string; anchor: DOMRect }>();
const emit = defineEmits<{ close: [] }>();

const org = useOrg();
const folder = computed(() => getFolder(org.value, props.folderId));
watch(folder, (f) => !f && emit('close'));

const name = ref('');
watch(() => folder.value?.name, (n) => (name.value = n ?? ''), { immediate: true });
function rename() {
  const n = name.value.trim();
  if (folder.value && n && n !== folder.value.name) void mutate((s) => updateFolder(s, props.folderId, { name: n }));
  else name.value = folder.value?.name ?? '';
}

const apply = (patch: FolderStylePatch) => void mutate((s) => updateFolder(s, props.folderId, patch));

const WIDTH = 318;
const MARGIN = 8;
const el = ref<HTMLElement>();
const pos = ref({ top: props.anchor.top, left: props.anchor.right + MARGIN });

/** Beside the row if there's room on the right, else below it; always inside the window. */
function place() {
  const a = props.anchor;
  const h = el.value?.offsetHeight ?? 420;
  let left = a.right + MARGIN;
  let top = a.top;
  if (left + WIDTH > window.innerWidth - MARGIN) {
    left = a.left;
    top = a.bottom + 4;
  }
  pos.value = {
    left: Math.max(MARGIN, Math.min(left, window.innerWidth - WIDTH - MARGIN)),
    top: Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN)),
  };
}
watch(() => props.anchor, () => nextTick(place));

function close() {
  rename();
  emit('close');
}
const onPointer = (e: PointerEvent) => {
  if (el.value && !e.composedPath().includes(el.value)) close();
};
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
onMounted(() => {
  void nextTick(place);
  // Capture, so clicks YouTube swallows still close the popover.
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', close);
  document.addEventListener('yt-navigate-start', close);
});
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointer, true);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', close);
  document.removeEventListener('yt-navigate-start', close);
});
</script>

<template>
  <!-- Esc is handled here too: key events don't leave our shadow root. -->
  <div
    v-if="folder"
    ref="el"
    class="popover"
    role="dialog"
    :aria-label="`Customize ${folder.name}`"
    :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${WIDTH}px` }"
    @keydown.esc.stop="close"
  >
    <div class="head">
      <FolderGlyph :color="folder.color" :icon="folder.icon" :size="24" />
      <input
        v-model="name"
        class="ytf-input name"
        aria-label="Folder name"
        @blur="rename"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>
    <FolderStylePicker :color="folder.color" :icon="folder.icon" @change="apply" />
    <div class="foot">
      <button class="ytf-btn primary" @click="close">Done</button>
    </div>
  </div>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: 2300;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  font-family: var(--ytf-font);
  color: var(--ytf-text);
  background: var(--ytf-menu);
  border-radius: 12px;
  box-shadow: var(--ytf-shadow);
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name {
  flex: 1;
  font-weight: 500;
}
.foot {
  display: flex;
  justify-content: flex-end;
}
</style>
