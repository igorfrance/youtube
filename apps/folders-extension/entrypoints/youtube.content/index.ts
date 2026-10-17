import '@yt/ui/tokens.css';
import { findSubscriptionsSection, onNavigate, pageRef, SELECTORS } from '@yt/youtube-dom';
import { createApp, watch, type App, type Component } from 'vue';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import AddToFolder from '../../src/content/AddToFolder.vue';
import Overlays from '../../src/content/Overlays.vue';
import Sidebar from '../../src/content/Sidebar.vue';
import { currentUrl, paletteOpen } from '../../src/content/ui-state';
import { refreshLibrary, refreshLibraryIfStale } from '../../src/lib/library-sync';
import type { TabMessage } from '../../src/lib/messages';
import { useOrg } from '../../src/lib/store';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const org = useOrg();

    browser.runtime.onMessage.addListener((msg: TabMessage, _sender, sendResponse) => {
      if (msg.type === 'library:refresh') {
        void refreshLibrary().then(sendResponse);
        return true;
      }
      if (msg.type === 'switcher:open') paletteOpen.value = !paletteOpen.value;
      return false;
    });

    // --- Sidebar folders, in place of YouTube's Subscriptions section --------
    let sidebarMounted = false;
    const sidebar = await mountVue(ctx, 'ytf-sidebar', Sidebar, {
      anchor: () => findSubscriptionsSection(),
      append: 'before',
      onChange: (mounted) => {
        sidebarMounted = mounted;
        applyNativeVisibility();
      },
    });
    keepMounted(ctx, sidebar, () => findSubscriptionsSection());

    /** Hides the native list only while our folders are actually showing. */
    function applyNativeVisibility() {
      const section = findSubscriptionsSection() as HTMLElement | null;
      if (section) section.style.display = sidebarMounted && org.value.settings.replaceNativeSubscriptions ? 'none' : '';
    }
    watch(() => org.value.settings.replaceNativeSubscriptions, applyNativeVisibility);
    // The guide re-renders on its own (e.g. when toggled); re-apply when it does.
    const guideObserver = new MutationObserver(() => applyNativeVisibility());
    const observeGuide = () => {
      const sections = document.querySelector(SELECTORS.guideSections);
      if (sections) guideObserver.observe(sections, { childList: true });
    };
    observeGuide();
    ctx.onInvalidated(() => guideObserver.disconnect());

    // --- Folder feed overlay and quick switcher ------------------------------
    const overlays = await mountVue(ctx, 'ytf-overlays', Overlays, { anchor: 'body', append: 'last', isolateEvents: true });
    overlays.mount();

    // --- "Add to folder" on channel and playlist pages -----------------------
    const actionsAnchor = () => {
      const ref = pageRef(new URL(location.href));
      if (!ref) return null;
      return firstVisible(ref.kind === 'channel' ? SELECTORS.channelActions : SELECTORS.playlistActions);
    };
    const actions = await mountVue(ctx, 'ytf-add-to-folder', AddToFolder, { anchor: actionsAnchor, append: 'last' });
    keepMounted(ctx, actions, actionsAnchor);

    const stopNav = onNavigate(() => {
      currentUrl.value = location.href;
      observeGuide();
      applyNativeVisibility();
    });
    ctx.onInvalidated(stopNav);

    // Give YouTube a moment to settle before reading the library.
    ctx.setTimeout(() => void refreshLibraryIfStale(), 2000);
  },
});

/**
 * Keeps a UI mounted at whatever element `anchor()` currently returns,
 * remounting when YouTube re-renders or replaces that element. (WXT's own
 * autoMount only supports selector strings.)
 */
function keepMounted(ctx: ContentScriptContext, ui: ShadowRootContentScriptUi<App>, anchor: () => Element | null) {
  let current: Element | null = null;
  const check = () => {
    const attached = ui.shadowHost.isConnected;
    // Cheap path: nothing changed since last time.
    if (current && attached && current.isConnected && (current as HTMLElement).offsetParent !== null) return;
    const next = anchor();
    if (next && (next !== current || !attached)) {
      if (attached) ui.remove();
      current = next;
      ui.mount();
    } else if (!next && attached) {
      ui.remove();
      current = null;
    }
  };
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      check();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', check);
  check();
  ctx.onInvalidated(() => {
    observer.disconnect();
    document.removeEventListener('yt-navigate-finish', check);
  });
}

/** YouTube keeps previous pages in the DOM, hidden; only the visible one counts. */
function firstVisible(selector: string): Element | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.offsetParent !== null) ?? null;
}

async function mountVue(
  ctx: ContentScriptContext,
  name: string,
  component: Component,
  o: {
    anchor: string | (() => Element | null);
    append: 'before' | 'last';
    isolateEvents?: boolean;
    onChange?: (mounted: boolean) => void;
  },
) {
  return createShadowRootUi<App>(ctx, {
    name,
    position: 'inline',
    anchor: o.anchor,
    append: o.append,
    isolateEvents: o.isolateEvents,
    onMount(container) {
      const app = createApp(component);
      app.mount(container);
      o.onChange?.(true);
      return app;
    },
    onRemove(app) {
      app?.unmount();
      o.onChange?.(false);
    },
  });
}
