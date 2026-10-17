import { LocalValue, SyncedStore, type Area, type ChangeSource } from '@yt/ext-storage';
import { shallowRef, type ShallowRef } from 'vue';
import { browser } from 'wxt/browser';
import { emptyLibrary, type Library } from '../model/library';
import { emptyOrg, ORG_VERSION, type OrgState } from '../model/org';

const local = browser.storage.local as unknown as Area;
const sync = browser.storage.sync as unknown as Area;
const changes = browser.storage.onChanged as unknown as ChangeSource;

/** Folders and placements: saved locally and mirrored to Chrome sync. */
export const orgStore = new SyncedStore<OrgState>({
  key: 'org',
  version: ORG_VERSION,
  empty: emptyOrg,
  // Older settings objects may miss newer keys; fill them in.
  migrate: (data) => ({ ...emptyOrg(), ...(data as OrgState) }),
  local,
  sync,
  changes,
});

/** Channels and playlists read from YouTube. Local cache only. */
export const libraryValue = new LocalValue<Library>(local, 'library', emptyLibrary);

let orgRef: ShallowRef<OrgState> | undefined;
let libRef: ShallowRef<Library> | undefined;

/** Reactive organization state shared by every Vue app in this context, kept live across contexts. */
export function useOrg(): ShallowRef<OrgState> {
  if (!orgRef) {
    const r = shallowRef(emptyOrg());
    orgRef = r;
    void orgStore.load().then((v) => (r.value = { ...emptyOrg(), ...v }));
    orgStore.subscribe((v) => (r.value = { ...emptyOrg(), ...v }));
  }
  return orgRef;
}

export function useLibrary(): ShallowRef<Library> {
  if (!libRef) {
    const r = shallowRef(emptyLibrary());
    libRef = r;
    void libraryValue.get().then((v) => (r.value = v));
    browser.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.library?.newValue) r.value = c.library.newValue as Library;
    });
  }
  return libRef;
}

/** Applies a pure change to the organization and saves it. */
export async function mutate(fn: (s: OrgState) => OrgState): Promise<void> {
  const next = fn(await orgStore.load());
  if (orgRef) orgRef.value = next;
  await orgStore.save(next);
}
