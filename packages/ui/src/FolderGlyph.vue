<script setup lang="ts">
import Icon from './Icon.vue';

/** A folder's icon: its emoji/character if it has one, else a folder outline in its color. */
withDefaults(defineProps<{ color?: string; icon?: string; size?: number }>(), { size: 20 });
</script>

<template>
  <span v-if="icon" class="glyph" :style="{ width: `${size}px`, fontSize: `${size - 4}px` }" aria-hidden="true">{{ icon }}</span>
  <Icon v-else name="folder" :size="size" :color="color ?? 'currentColor'" />
</template>

<style scoped>
.glyph {
  display: inline-flex;
  justify-content: center;
  flex: none;
  line-height: 1;
}
</style>
