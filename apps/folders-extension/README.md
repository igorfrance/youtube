# Folders for YouTube

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

- **Unsubscribe and delete.** Select channels or playlists in the organizer and
  unsubscribe from them, or delete them (playlists saved from other people are
  removed from your library instead). Watch later and Liked videos are never
  deleted.
- **Merge playlists.** Select playlists and merge them into a new playlist or an
  existing one (which may be one of the selected). Videos are copied in order
  with duplicates skipped; the merged playlist is re-read and checked, and only
  then are the other selected playlists deleted. If the check fails, nothing is
  deleted. The target keeps its folders and gains those of the merged playlists.

These are the only actions that change your YouTube account, and each asks for
confirmation first. Everything else is local organization.

## Install from GitHub

No Web Store needed. Every change to `main` publishes a ready-to-load build to
the repo's [latest release](https://github.com/igorfrance/youtube/releases/latest).

1. Download
   [folders-for-youtube-chrome.zip](https://github.com/igorfrance/youtube/releases/latest/download/folders-for-youtube-chrome.zip)
   and extract it to a folder you'll keep (for example
   `Documents\Folders for YouTube`). Chrome loads the extension from that
   folder, so don't delete it.
2. Open `chrome://extensions` (or `edge://extensions`), turn on
   **Developer mode**, click **Load unpacked** and pick the folder.
3. Open YouTube while signed in to Chrome.

**To update**, download the zip again, extract it over the same folder, and
click the reload arrow on the extension's card in `chrome://extensions`. Your
folders stay.

**Folders on several computers.** Folders sync through your Chrome profile
(Chrome sync must be on and include *Extensions*, which it does by default).
Install on each computer as above, signed in to the same Chrome profile, and
the folders follow within a minute or so. The extension ID is pinned to
`hbboehbfagelbdaihkafoljokmpbbdce` by a `key` in the manifest, so every
unpacked install, from the release zip or your own `bun run build`, shares the
same synced data. If two computers edit at the same moment, the later save wins.

**Coming from an older unpacked install** (one whose ID in
`chrome://extensions` is not the one above): open its organizer, click
**Export**, remove it, install as above, then **Import** the file. The old
install had a different ID, so its data can't carry over by itself.

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
follow your Chrome profile. Sync holds about 100 KB, enough for roughly 1,500
filed channels and playlists; past that the organizer says sync failed and the
folders stay on this computer. Channel and playlist details are a local cache,
re-read from YouTube at most hourly. If a save never reached sync (the
page closed too soon), the next load pushes it. Channels that disappear from your library
but are still in a folder are kept and shown struck through rather than
silently dropped.

**Permissions.** `storage`, `sidePanel` (Chrome and Edge), and access to
`www.youtube.com` only. See [PRIVACY.md](PRIVACY.md).

**Browsers.** One codebase builds for Chrome, Edge and Firefox (MV3, 128+).
Firefox has no side panel, so the organizer is a sidebar there (WXT maps the
`sidepanel` entrypoint to `sidebar_action`).
