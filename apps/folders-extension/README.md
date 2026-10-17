# YouTube Folders

Folders for YouTube subscriptions and playlists. Design notes live in the
project's design doc; this is how the code is laid out.

## What it does

- **Sidebar folders.** Two trees, Subscriptions and Playlists, replace YouTube's
  flat subscription list (a link at the bottom brings the native list back).
  Folders nest, and a channel or playlist can be in several folders. Items in no
  folder sit in **Unsorted**.
- **Folder feed.** Click a subscriptions folder to see the latest uploads from
  its channels (All / Videos / Shorts). Click a playlists folder to see its
  playlists.
- **Organizer.** Click the toolbar icon (or the pencil in the sidebar) to open
  the side panel: create, rename, color, nest and delete folders; select or
  drag channels and playlists onto folders (drag moves out of the current
  folder; hold Ctrl to copy). Export and import everything as JSON.
- **Add to folder** button on channel and playlist pages.
- **Quick switcher**: `Alt+Shift+F` on YouTube (change it at
  `chrome://extensions/shortcuts`).

Nothing is ever changed on YouTube's side: the extension never subscribes,
unsubscribes or edits playlists.

## How it works

| Piece | File |
| --- | --- |
| Reads `ytcfg` and page data in YouTube's own JS world, calls YouTube's web API for the library | `entrypoints/youtube-bridge.content.ts` |
| Mounts the sidebar, overlays and page buttons (Shadow DOM, Vue) | `entrypoints/youtube.content/index.ts`, `src/content/` |
| Side panel organizer | `entrypoints/sidepanel/`, `src/sidepanel/` |
| Fetches and caches public channel feeds, relays refresh requests | `entrypoints/background.ts` |
| Folder model (pure functions, unit tested) | `src/model/` |

**Storage.** Folders and placements live in `chrome.storage.local` and are
mirrored to `chrome.storage.sync` (sharded under the 8 KB/item limit) so they
follow your Chrome profile. Channel and playlist details are a local cache,
re-read from YouTube at most hourly. Channels that disappear from your library
but are still in a folder are kept and shown struck through rather than
silently dropped.

**Permissions.** `storage`, `sidePanel`, and access to `www.youtube.com` only.
