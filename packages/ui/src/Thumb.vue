<script setup lang="ts">
import { computed, ref } from 'vue';

/** A channel avatar (round) or playlist cover (rounded rectangle), falling back to an initial. */
const props = withDefaults(defineProps<{ src?: string; title: string; round?: boolean; size?: number }>(), { size: 24, round: true });
const failed = ref(false);
const initial = computed(() => [...props.title.trim()][0]?.toUpperCase() ?? '?');
const style = computed(() => ({
  width: `${props.round ? props.size : Math.round(props.size * 1.6)}px`,
  height: `${props.size}px`,
  borderRadius: props.round ? '50%' : '4px',
  fontSize: `${Math.round(props.size * 0.45)}px`,
}));
</script>

<template>
  <img v-if="src && !failed" class="thumb" :src="src" :style="style" alt="" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" />
  <span v-else class="thumb fallback" :style="style" aria-hidden="true">{{ initial }}</span>
</template>

<style scoped>
.thumb {
  flex: none;
  object-fit: cover;
  background: var(--ytf-hover);
}
.fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ytf-text-2);
  font-weight: 600;
}
</style>
