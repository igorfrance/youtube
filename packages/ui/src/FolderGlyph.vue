<script setup lang="ts">
import { computed } from 'vue';
import { glyphOf } from './folder-style';
import Icon from './Icon.vue';

/** A folder's icon: a built-in icon (the folder outline by default) in its color, or its emoji. */
const props = withDefaults(defineProps<{ color?: string; icon?: string; size?: number }>(), { size: 20 });
const glyph = computed(() => glyphOf(props.icon));
</script>

<template>
  <span v-if="glyph.kind === 'emoji'" class="glyph" :style="{ width: `${size}px`, fontSize: `${size - 4}px` }" aria-hidden="true">{{ glyph.text }}</span>
  <Icon v-else :name="glyph.name" :size="size" :color="color ?? 'currentColor'" />
</template>

<style scoped>
.glyph {
  display: inline-flex;
  justify-content: center;
  flex: none;
  line-height: 1;
}
</style>
