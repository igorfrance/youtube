# YouTube Utilities

A monorepo for tools that make YouTube easier to organize and use. Built with
Bun, TypeScript, Vite and Vue.

| Path | What it is |
| --- | --- |
| [`apps/folders-extension`](apps/folders-extension) | Chrome extension that adds folders for subscriptions and playlists |
| [`packages/youtube-client`](packages/youtube-client) | Reads the signed-in user's subscriptions and playlists (YouTube's web API, with an HTML fallback) and public channel feeds |
| [`packages/youtube-dom`](packages/youtube-dom) | Every selector and page hook that depends on YouTube's markup, in one place |
| [`packages/ext-storage`](packages/ext-storage) | Typed extension storage: local working copy mirrored into `chrome.storage.sync` in shards |
| [`packages/ui`](packages/ui) | Shared Vue components (folder tree, quick switcher, icons) and theme tokens that follow YouTube's light/dark theme |
| [`packages/shared`](packages/shared) | Common types and small utilities |
| [`tooling/tsconfig`](tooling/tsconfig) | Base TypeScript config |

Packages are consumed as TypeScript source through workspace links; there is no
separate build step for them.

## Getting started

```sh
bun install
bun run dev        # folders extension with hot reload (opens Chrome)
bun run build      # production build in apps/folders-extension/.output/chrome-mv3
bun run zip:all    # store packages for Chrome, Edge and Firefox (+ Firefox sources zip)
bun test           # unit tests across the repo
bun run typecheck  # vue-tsc / tsc in every workspace
```

### Load the extension in Chrome

1. `bun run build`
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** and pick `apps/folders-extension/.output/chrome-mv3`.
4. Open YouTube while signed in. Your subscriptions and playlists are read a
   couple of seconds after the page loads.

CI also attaches the zipped builds to every run.

### Edge and Firefox

- **Edge** runs the Chrome build as is: open `edge://extensions`, turn on
  **Developer mode**, and load `.output/chrome-mv3` (or `.output/edge-mv3`).
- **Firefox** (128 or later): run `bun --filter folders-extension build:firefox`,
  open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**
  and pick `apps/folders-extension/.output/firefox-mv3/manifest.json`. In
  Firefox the organizer opens in the sidebar (toolbar button), or in a tab from
  the pencil in YouTube's sidebar.

Store listings, screenshots and the privacy policy are in
[`apps/folders-extension/store/`](apps/folders-extension/store/README.md).
