<script setup lang="ts">
import type { LibraryItem } from '@yt/shared';
import { Icon, Thumb } from '@yt/ui';
import { SYSTEM_PLAYLISTS, type MergeProgress, type MergeResult, type PlaylistPrivacy } from '@yt/youtube-client';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import type { BatchResult } from '../lib/bridge';
import { toBackground, type AccountAction, type ActionProgressMessage } from '../lib/messages';

/**
 * Confirms and runs a change to the user's YouTube account: unsubscribing,
 * deleting playlists, or merging playlists.
 */
const props = defineProps<{ mode: 'delete' | 'merge'; items: LibraryItem[]; allPlaylists: LibraryItem[] }>();
const emit = defineEmits<{ close: []; done: [] }>();

// The selection is fixed when the dialog opens: removed items leave the
// library (and so the live selection) before the result comes back.
const picked = props.items.slice();
const isChannels = computed(() => picked[0]?.kind === 'channel');
/** Watch later / Liked videos can't be deleted. */
const builtIn = computed(() => picked.filter((i) => SYSTEM_PLAYLISTS.has(i.id)));
const removable = computed(() => picked.filter((i) => !SYSTEM_PLAYLISTS.has(i.id)));

// --- Merge options ----------------------------------------------------------
const targetMode = ref<'new' | 'existing'>('new');
const newTitle = ref(picked[0] ? `${picked[0].title} (merged)` : 'Merged playlist');
const privacy = ref<PlaylistPrivacy>('PRIVATE');
/** Any playlist except Liked videos (which can't be added to directly). */
const targetChoices = computed(() => props.allPlaylists.filter((p) => p.id !== 'LL' && !p.missing));
const existingId = ref(picked.find((i) => !SYSTEM_PLAYLISTS.has(i.id))?.id ?? targetChoices.value[0]?.id ?? '');
const targetId = computed(() => (targetMode.value === 'existing' ? existingId.value : null));
const willRemove = computed(() => picked.filter((i) => i.id !== targetId.value && !SYSTEM_PLAYLISTS.has(i.id)));

const canRun = computed(() => {
  if (props.mode === 'delete') return removable.value.length > 0;
  return targetMode.value === 'new' ? newTitle.value.trim().length > 0 : !!existingId.value;
});

// --- Running ----------------------------------------------------------------
const running = ref(false);
const progress = ref('');
const error = ref('');
const summary = ref('');

const describe = (p: MergeProgress) =>
  p.step === 'reading'
    ? `Reading playlist ${p.done + 1} of ${p.total}…`
    : p.step === 'adding'
      ? `Adding videos: ${p.done} of ${p.total}…`
      : p.step === 'verifying'
        ? 'Checking the merged playlist…'
        : `Removing merged playlists: ${p.done + 1} of ${p.total}…`;

const onProgress = (msg: ActionProgressMessage) => {
  if (msg?.type === 'action:progress') progress.value = describe(msg.progress);
};
onMounted(() => browser.runtime.onMessage.addListener(onProgress));
onBeforeUnmount(() => browser.runtime.onMessage.removeListener(onProgress));

const titleOf = (id: string) => props.allPlaylists.find((p) => p.id === id)?.title ?? picked.find((i) => i.id === id)?.title ?? id;

async function run() {
  running.value = true;
  error.value = '';
  progress.value = props.mode === 'merge' ? 'Starting…' : isChannels.value ? 'Unsubscribing…' : 'Deleting…';
  let action: AccountAction;
  if (props.mode === 'delete') {
    const ids = removable.value.map((i) => i.id);
    action = isChannels.value ? { kind: 'unsubscribe', ids } : { kind: 'removePlaylists', ids };
  } else {
    action = {
      kind: 'mergePlaylists',
      sources: picked.map((i) => i.id),
      target: targetId.value ? { existing: targetId.value } : { create: { title: newTitle.value.trim(), privacy: privacy.value } },
    };
  }
  const res = await toBackground({ type: 'account:action', action });
  running.value = false;
  progress.value = '';
  if (!res.ok) {
    error.value = res.error;
    return;
  }
  if (props.mode === 'delete') {
    const r = res.result as BatchResult;
    const noun = isChannels.value ? 'channel' : 'playlist';
    summary.value = `${isChannels.value ? 'Unsubscribed from' : 'Removed'} ${r.done.length} ${noun}${r.done.length === 1 ? '' : 's'}.`;
    if (r.failed.length) error.value = `${r.failed.length} failed: ${r.failed.map((f) => `${titleOf(f.id)} (${f.error})`).join('; ')}`;
  } else {
    const r = res.result as MergeResult;
    const target = r.created ? newTitle.value.trim() : titleOf(r.targetId);
    summary.value = `Added ${r.added} videos to "${target}" and removed ${r.removed.length} playlist${r.removed.length === 1 ? '' : 's'}.`;
  }
  emit('done');
}
</script>

<template>
  <div class="backdrop" @mousedown.self="!running && emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="mode === 'merge' ? 'Merge playlists' : 'Delete'">
      <h2>
        <template v-if="mode === 'merge'">Merge {{ picked.length }} playlist{{ picked.length === 1 ? '' : 's' }}</template>
        <template v-else-if="isChannels">Unsubscribe from {{ removable.length }} channel{{ removable.length === 1 ? '' : 's' }}?</template>
        <template v-else>Delete {{ removable.length }} playlist{{ removable.length === 1 ? '' : 's' }}?</template>
      </h2>

      <template v-if="summary">
        <p class="ok"><Icon name="check" :size="18" /> {{ summary }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions"><button class="ytf-btn primary" @click="emit('close')">Done</button></div>
      </template>

      <template v-else>
        <ul class="items">
          <li v-for="it in picked" :key="it.id" :class="{ dim: mode === 'merge' ? !willRemove.includes(it) : !removable.includes(it) }">
            <Thumb :src="it.thumbnail" :title="it.title" :round="it.kind === 'channel'" :size="24" />
            <span>{{ it.title }}</span>
            <span v-if="mode === 'merge' && it.id === targetId" class="tag">target, kept</span>
            <span v-else-if="SYSTEM_PLAYLISTS.has(it.id)" class="tag">built in, kept</span>
          </li>
        </ul>

        <fieldset v-if="mode === 'merge'" :disabled="running">
          <legend>Merge into</legend>
          <label class="radio"><input v-model="targetMode" type="radio" value="new" /> A new playlist</label>
          <div v-if="targetMode === 'new'" class="sub">
            <input v-model="newTitle" class="ytf-input" aria-label="New playlist name" />
            <select v-model="privacy" class="ytf-input" aria-label="Visibility">
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
          <label class="radio"><input v-model="targetMode" type="radio" value="existing" /> An existing playlist</label>
          <div v-if="targetMode === 'existing'" class="sub">
            <select v-model="existingId" class="ytf-input" aria-label="Target playlist">
              <option v-for="p in targetChoices" :key="p.id" :value="p.id">{{ p.title }}{{ picked.some((i) => i.id === p.id) ? ' (selected)' : '' }}</option>
            </select>
          </div>
        </fieldset>

        <p class="warn">
          <template v-if="mode === 'merge'">
            Videos are copied first, skipping duplicates. Once the merged playlist is checked,
            <strong>{{ willRemove.length }} playlist{{ willRemove.length === 1 ? '' : 's' }}</strong> will be removed from your YouTube account.
          </template>
          <template v-else-if="isChannels">This unsubscribes on YouTube and removes the channels from your folders.</template>
          <template v-else>Your own playlists are deleted on YouTube; playlists saved from others are removed from your library.</template>
          This can't be undone.
          <template v-if="mode === 'delete' && builtIn.length"> Watch later and Liked videos can't be deleted and are skipped.</template>
        </p>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="running" class="progress" role="status"><Icon name="refresh" :size="16" class="spin" /> {{ progress }}</p>

        <div class="actions">
          <button class="ytf-btn" :disabled="running" @click="emit('close')">Cancel</button>
          <button class="ytf-btn danger" :disabled="running || !canRun" @click="run">
            <template v-if="mode === 'merge'">Merge{{ willRemove.length ? ` and remove ${willRemove.length}` : '' }}</template>
            <template v-else-if="isChannels">Unsubscribe</template>
            <template v-else>Delete</template>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 10;
}
.dialog {
  width: 100%;
  max-height: 100%;
  overflow: auto;
  background: var(--ytf-menu);
  color: var(--ytf-text);
  border-radius: 14px;
  box-shadow: var(--ytf-shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 17px;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.items li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.items li.dim span:not(.tag) {
  color: var(--ytf-text-2);
}
.tag {
  margin-left: auto;
  font-size: 11px;
  color: var(--ytf-text-2);
  border: 1px solid var(--ytf-border);
  border-radius: 10px;
  padding: 1px 6px;
  white-space: nowrap;
}
fieldset {
  min-width: 0;
  margin: 0;
  border: 1px solid var(--ytf-border);
  border-radius: 10px;
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
legend {
  font-size: 13px;
  color: var(--ytf-text-2);
  padding: 0 4px;
}
.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.sub {
  display: flex;
  gap: 6px;
  padding-left: 24px;
}
.sub input {
  flex: 1;
  min-width: 0;
}
.sub select {
  min-width: 0;
  max-width: 100%;
}
.sub > select:only-child {
  flex: 1;
}
select.ytf-input {
  background: var(--ytf-menu);
}
.warn {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ytf-text-2);
}
.error {
  margin: 0;
  font-size: 13px;
  color: var(--ytf-danger);
}
.ok {
  margin: 0;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.progress {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.danger {
  background: var(--ytf-danger);
  color: var(--ytf-on-danger);
}
.danger:hover {
  background: var(--ytf-danger);
  filter: brightness(1.1);
}
.danger:disabled,
.ytf-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
