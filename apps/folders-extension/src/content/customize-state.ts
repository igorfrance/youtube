import { ref } from 'vue';

/**
 * The folder whose color and icon are being edited from YouTube's sidebar,
 * and where its row is on screen. The sidebar sets it; Overlays shows the
 * popover (it lives above the page, so it isn't clipped by the guide).
 */
export const customizing = ref<{ id: string; anchor: DOMRect } | null>(null);
