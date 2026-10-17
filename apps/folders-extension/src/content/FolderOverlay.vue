<script setup lang="ts">
import type { FeedVideo, LibraryItem } from '@yt/shared';
import { FolderGlyph, Icon, Thumb } from '@yt/ui';
import { pageContentRect } from '@yt/youtube-dom';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { toBackground } from '../lib/messages';
import { useLibrary, useOrg } from '../lib/store';
import { compactNumber, folderLabel, isUnsorted, itemsInFolder, timeAgo, treeOfUnsorted } from '../lib/view';
import { getFolder } from '../model/org';

/**
 * Opens over YouTube's page area. For a subscriptions folder it shows the
 * latest uploads of its channels; for a playlists folder, its playlists.
 */
const props = defineProps<{ folderId: string }>();
const emit = defineEmits<{ close: [] }>();

/** Folder feeds read one public feed per channel; past this many it gets slow and rude. */
const MAX_FEED_CHANNELS = 150;

const org = useOrg();
const lib = useLibrary();

const folder = computed(() => getFolder(org.value, props.folderId));
const tree = computed(() => (isUnsorted(props.folderId) ? treeOfUnsorted(props.folderId) : folder.value?.tree ?? 'subscriptions'));
const title = computed(() => folderLabel(org.value, props.folderId));
const items = computed<LibraryItem[]>(() => itemsInFolder(org.value, lib.value, props.folderId, true));

const rect = ref(pageContentRect());
const place = () => (rect.value = pageContentRect());

type Filter = 'all' | 'videos' | 'shorts';
const filter = ref<Filter>(org.value.settings.feedShowShorts ? 'all' : 'videos');
const videos = ref<FeedVideo[]>([]);
const loading = ref(false);
const failedCount = ref(0);

const channelIds = computed(() => items.value.filter((i) => !i.missing).slice(0, MAX_FEED_CHANNELS).map((i) => i.id));

async function load(force = false) {
  if (tree.value !== 'subscriptions') return;
  loading.value = true;
  try {
    const res = await toBackground({ type: 'feed:get', channelIds: channelIds.value, force });
    videos.value = res.videos;
    failedCount.value = res.failed.length;
  } finally {
    loading.value = false;
  }
}

const shown = computed(() =>
  videos.value
    .filter((v) => filter.value === 'all' || (filter.value === 'shorts') === v.isShort)
    .slice(0, 120),
);

watch(() => [props.folderId, channelIds.value.join()], () => void load(), { immediate: true });

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close');
onMounted(() => {
  window.addEventListener('resize', place);
  window.addEventListener('keydown', onKey);
  document.addEventListener('yt-navigate-start', close);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', place);
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('yt-navigate-start', close);
});
function close() {
  emit('close');
}

const videoUrl = (v: FeedVideo) => (v.isShort ? `/shorts/${v.videoId}` : `/watch?v=${v.videoId}`);
</script>

<template>
  <!-- Esc is handled here too: key events don't leave our shadow root, so the window listener only sees them when focus is on the page. -->
  <div class="overlay" :style="{ top: `${rect.top}px`, left: `${rect.left}px` }" role="region" :aria-label="`${title} folder`" @keydown.esc="close">
    <header>
      <div class="heading">
        <FolderGlyph :color="folder?.color" :icon="folder?.icon" :size="32" />
        <div>
          <h1>{{ title }}</h1>
          <p class="sub">
            {{ items.length }} {{ tree === 'subscriptions' ? 'channels' : 'playlists' }}
            <template v-if="tree === 'subscriptions' && items.length > MAX_FEED_CHANNELS"> · showing uploads from the first {{ MAX_FEED_CHANNELS }}</template>
            <template v-if="failedCount"> · {{ failedCount }} channel feeds didn't load</template>
          </p>
        </div>
      </div>
      <div class="tools">
        <template v-if="tree === 'subscriptions'">
          <button v-for="f in ['all', 'videos', 'shorts'] as const" :key="f" class="chip" :class="{ on: filter === f }" :aria-pressed="filter === f" @click="filter = f">
            {{ f === 'all' ? 'All' : f === 'videos' ? 'Videos' : 'Shorts' }}
          </button>
          <button class="ytf-icon-btn" aria-label="Refresh" title="Refresh" :disabled="loading" @click="load(true)"><Icon name="refresh" /></button>
        </template>
        <button class="ytf-icon-btn" aria-label="Close" title="Close (Esc)" @click="close"><Icon name="close" /></button>
      </div>
    </header>

    <div class="body">
      <template v-if="tree === 'subscriptions'">
        <div v-if="loading && !videos.length" class="grid">
          <div v-for="n in 12" :key="n" class="card skeleton"><div class="thumb" /><div class="line" /><div class="line short" /></div>
        </div>
        <p v-else-if="!items.length" class="empty">This folder has no channels yet. Add some from the organizer or a channel page.</p>
        <p v-else-if="!shown.length" class="empty">No recent uploads here.</p>
        <div v-else class="grid">
          <a v-for="v in shown" :key="v.videoId" class="card" :href="videoUrl(v)">
            <div class="thumb">
              <img :src="v.thumbnail" alt="" loading="lazy" />
              <span v-if="v.isShort" class="badge">Short</span>
            </div>
            <div class="meta">
              <span class="vtitle">{{ v.title }}</span>
              <span class="small">{{ v.channelTitle }}</span>
              <span class="small"><template v-if="v.views !== undefined">{{ compactNumber(v.views) }} views · </template>{{ timeAgo(v.published) }}</span>
            </div>
          </a>
        </div>
      </template>

      <template v-else>
        <p v-if="!items.length" class="empty">This folder has no playlists yet.</p>
        <div v-else class="grid">
          <a v-for="p in items" :key="p.id" class="card" :href="p.url">
            <div class="thumb">
              <img v-if="p.thumbnail" :src="p.thumbnail" alt="" loading="lazy" />
              <span v-if="p.videoCount !== undefined" class="badge"><Icon name="playlist" :size="14" /> {{ p.videoCount }} videos</span>
            </div>
            <div class="meta">
              <span class="vtitle">{{ p.title }}</span>
              <span v-if="p.owner" class="small">{{ p.owner }}</span>
            </div>
          </a>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 2050;
  background: var(--ytf-bg);
  color: var(--ytf-text);
  font-family: var(--ytf-font);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 12px;
}
.heading {
  display: flex;
  align-items: center;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}
.sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--ytf-text-2);
}
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: none;
  background: var(--ytf-hover);
  color: var(--ytf-text);
  cursor: pointer;
}
.chip.on {
  background: var(--ytf-text);
  color: var(--ytf-bg);
}
.body {
  flex: 1;
  overflow: auto;
  padding: 12px 24px 32px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 32px 16px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--ytf-text);
  text-decoration: none;
}
.thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: var(--ytf-hover);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vtitle {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.small {
  font-size: 14px;
  color: var(--ytf-text-2);
}
.empty {
  color: var(--ytf-text-2);
  font-size: 15px;
}
.skeleton .line {
  height: 14px;
  border-radius: 4px;
  background: var(--ytf-hover);
}
.skeleton .line.short {
  width: 60%;
}
</style>
