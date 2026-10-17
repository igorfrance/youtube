# Store listings

Everything needed to submit Folders for YouTube to the Chrome Web Store,
Microsoft Edge Add-ons and Firefox Add-ons (AMO). Images are in
[`images/`](images/); they are regenerated with `node store/tools/screenshots.cjs`
after `bun run build` (and the icons with `store/tools/icons.cjs`).

## Packages

From the repo root, `bun run zip:all` writes to `apps/folders-extension/.output/`:

| Store | Upload |
| --- | --- |
| Chrome Web Store | `folders-extension-<version>-chrome.zip` |
| Edge Add-ons | `folders-extension-<version>-edge.zip` |
| Firefox Add-ons | `folders-extension-<version>-firefox.zip`, plus `folders-extension-<version>-sources.zip` when asked for source code |

Bump `version` in `apps/folders-extension/package.json` before each new upload;
the stores reject a version they have already seen.

## Listing text (all stores)

**Name:** Folders for YouTube

**Short description** (Chrome 132 chars max; also the manifest description):

> Organize your YouTube subscriptions and playlists into folders.

**Summary** (Firefox, 250 chars max; Edge short description):

> Put your YouTube subscriptions and playlists into folders. Folders replace the long subscription list in the sidebar, each folder gets its own feed of new videos, and you can merge playlists and clean up subscriptions in bulk.

**Description:**

> YouTube has no folders. If you follow hundreds of channels and keep dozens of playlists, finding the one you want means scrolling a long, flat list. Folders for YouTube adds the folders.
>
> **Folders in YouTube's sidebar**
> Your folders replace the subscription list in YouTube's left sidebar. Nest folders inside folders, give them colors or an emoji, and put a channel or playlist in as many folders as you like. Anything you haven't sorted yet waits in Unsorted. You can switch back to YouTube's own list at any time.
>
> **A feed for every folder**
> Click a folder to see the latest uploads from only those channels, with Videos and Shorts filters. Your "Cooking" folder becomes a cooking channel.
>
> **Fast organizing**
> The organizer opens in the side panel. Select many channels at once and file them with one click, or drag them onto a folder. Add the current channel or playlist to a folder right from its page.
>
> **Jump anywhere**
> Press Alt+Shift+F on YouTube to search your folders, channels and playlists from the keyboard.
>
> **Clean up your account**
> Unsubscribe from channels and delete playlists in bulk. Merge several playlists into a new or existing one: videos are copied in order without duplicates, the result is checked, and only then are the merged playlists removed. Watch later and Liked videos are never deleted. Every change to your YouTube account asks for confirmation first.
>
> **Private by design**
> There is no server and no account. Your folders are stored in your browser and follow you to your other computers through your browser's own sync. The extension only talks to YouTube, as you.
>
> Folders for YouTube is an independent project and is not affiliated with or endorsed by YouTube or Google.

**Category:** Chrome: Productivity › Tools. Edge: Productivity. Firefox: Photos, Music & Videos.

**Search terms** (Edge, up to 7): youtube folders, subscriptions, playlists, organize, feed, merge playlists, youtube organizer

**Homepage / support URL:** https://github.com/igorfrance/youtube

**Privacy policy URL:** https://github.com/igorfrance/youtube/blob/main/apps/folders-extension/PRIVACY.md

## Images

| File | Size | Use |
| --- | --- | --- |
| `store-icon-128.png` | 128×128 | Chrome store icon (artwork 96px with padding, as Google asks) |
| `store-logo-300.png` | 300×300 | Edge logo |
| `screenshot-1-folders.png` … `screenshot-5-merge-playlists.png` | 1280×800 | Screenshots for all three stores, in this order |
| `promo-small-440x280.png` | 440×280 | Chrome small promo tile, Edge small promotional tile |
| `promo-marquee-1400x560.png` | 1400×560 | Chrome marquee, Edge large promotional tile |

Firefox uses the 128px icon from the package itself.

## Chrome Web Store: privacy practices tab

**Single purpose:**

> Organize the user's YouTube subscriptions and playlists into folders, and manage them (feeds per folder, unsubscribe, delete and merge playlists).

**Permission justifications:**

- `storage`: Saves the user's folders and settings, and a local cache of their subscription and playlist list and channel feeds.
- `sidePanel`: The folder organizer opens in Chrome's side panel when the toolbar button is clicked.
- Host permission `https://www.youtube.com/*`: Shows the folders inside YouTube's sidebar and pages, reads the user's subscriptions and playlists with their signed-in YouTube session, fetches channels' public video feeds, and carries out the unsubscribe, delete and merge actions the user confirms.

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** Nothing is collected or transmitted to the developer, so leave every data type unchecked and tick the three certifications (no selling, no unrelated use, no creditworthiness use). The extension's requests go only to YouTube, on the user's behalf.

## Edge Add-ons notes

- Upload the edge zip; the listing text, images and privacy policy are the same as for Chrome.
- "Notes for certification": same as the Firefox reviewer notes below, minus the build steps.

## Firefox Add-ons: notes for reviewers

Paste into "Notes to reviewer" and upload the sources zip when asked:

> **Building from source.** Requires Bun 1.4.2. From the root of the sources zip run `bun install --frozen-lockfile`, then `cd apps/folders-extension && bun run build:firefox`. The output in `apps/folders-extension/.output/firefox-mv3` is identical to the uploaded package. Code is TypeScript and Vue, bundled by WXT (Vite); nothing is fetched or evaluated at runtime.
>
> **Main-world content script.** `content-scripts/youtube-bridge.js` runs in the page's world on www.youtube.com so it can read YouTube's own page configuration (`ytcfg`) and sign requests to YouTube's web API with the user's existing session, exactly as the YouTube page itself does. It only talks to www.youtube.com, and only answers requests in the extension's own message format on that page.
>
> **innerHTML warnings.** The two `UNSAFE_VAR_ASSIGNMENT` warnings come from the Vue runtime's static-content insertion; the extension's own code never assigns `innerHTML` and renders all YouTube data as text.
>
> **Testing.** Sign in to YouTube, open youtube.com: folders appear in the left sidebar. Click the toolbar button to open the organizer in the sidebar.
