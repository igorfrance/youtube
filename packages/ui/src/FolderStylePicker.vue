<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { firstGrapheme, FOLDER_ICONS, FOLDER_PALETTE, glyphOf } from './folder-style';
import Icon from './Icon.vue';

/** Changes to a folder's look. `icon: undefined` means the default folder icon. */
export interface FolderStylePatch {
  color?: string;
  icon?: string | undefined;
}

/** Color swatches (plus a custom color), built-in icons and an emoji field for one folder. */
const props = defineProps<{ color?: string; icon?: string }>();
const emit = defineEmits<{ change: [patch: FolderStylePatch] }>();

const glyph = computed(() => glyphOf(props.icon));
const current = computed(() => props.color?.toLowerCase());
const custom = computed(() => !!current.value && !(FOLDER_PALETTE as readonly string[]).includes(current.value));
const drawColor = computed(() => props.color ?? 'currentColor');

const emoji = ref('');
watch(glyph, (g) => (emoji.value = g.kind === 'emoji' ? g.text : ''), { immediate: true });

function commitEmoji() {
  const e = firstGrapheme(emoji.value);
  emoji.value = e;
  const now = glyph.value.kind === 'emoji' ? glyph.value.text : '';
  if (e !== now) emit('change', { icon: e || undefined });
}

const pickIcon = (name: string) => emit('change', { icon: name === 'folder' ? undefined : name });
</script>

<template>
  <div class="picker">
    <div class="group" role="radiogroup" aria-label="Folder color">
      <span class="caption">Color</span>
      <div class="swatches">
        <button
          v-for="c in FOLDER_PALETTE"
          :key="c"
          type="button"
          class="swatch"
          role="radio"
          :aria-checked="current === c"
          :aria-label="`Color ${c}`"
          :title="c"
          :style="{ background: c }"
          @click="emit('change', { color: c })"
        >
          <Icon v-if="current === c" name="check" :size="14" color="#fff" />
        </button>
        <label class="swatch custom" :class="{ on: custom }" :style="custom ? { background: color } : undefined" title="Custom color">
          <input type="color" :value="color ?? '#5f6368'" aria-label="Custom color" @change="emit('change', { color: ($event.target as HTMLInputElement).value })" />
          <Icon v-if="custom" name="check" :size="14" color="#fff" />
        </label>
      </div>
    </div>

    <div class="group" role="radiogroup" aria-label="Folder icon">
      <span class="caption">Icon</span>
      <div class="icons">
        <button
          v-for="name in FOLDER_ICONS"
          :key="name"
          type="button"
          class="icon"
          role="radio"
          :aria-checked="glyph.kind === 'icon' && glyph.name === name"
          :aria-label="`Icon ${name}`"
          :title="name"
          @click="pickIcon(name)"
        >
          <Icon :name="name" :size="20" :color="drawColor" />
        </button>
      </div>
      <label class="emoji">
        <span>Or an emoji</span>
        <input
          v-model="emoji"
          class="ytf-input"
          maxlength="16"
          placeholder="🎵"
          aria-label="Emoji icon"
          @change="commitEmoji"
          @keydown.enter.prevent="commitEmoji"
        />
        <button v-if="glyph.kind === 'emoji'" type="button" class="ytf-btn small" @click="pickIcon('folder')">Clear</button>
      </label>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.caption {
  color: var(--ytf-text-2);
  font-weight: 500;
}
.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, 26px);
  gap: 6px;
}
.swatch {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.swatch[aria-checked='true'],
.swatch.on {
  outline: 2px solid var(--ytf-text);
  outline-offset: 2px;
}
.swatch:focus-visible,
.icon:focus-visible,
.custom:focus-within {
  outline: 2px solid var(--ytf-accent);
  outline-offset: 2px;
}
.custom {
  position: relative;
  background: conic-gradient(#d93025, #f9ab00, #1e8e3e, #12b5cb, #1a73e8, #9334e6, #d01884, #d93025);
}
.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, 32px);
  gap: 4px;
}
.icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ytf-text);
}
.icon:hover {
  background: var(--ytf-hover);
}
.icon[aria-checked='true'] {
  background: var(--ytf-active);
  box-shadow: inset 0 0 0 2px var(--ytf-text);
}
.emoji {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--ytf-text-2);
}
.emoji input {
  width: 64px;
  font-size: 16px;
  padding: 4px 8px;
  text-align: center;
}
.emoji input::placeholder {
  opacity: 0.35;
}
.small {
  height: 28px;
  font-size: 13px;
  padding: 0 10px;
}
</style>
