import { defineConfig } from 'wxt';

/**
 * Public key that pins the Chrome/Edge extension ID to
 * hbboehbfagelbdaihkafoljokmpbbdce for unpacked installs. Without it Chrome
 * derives the ID from the folder path, so each computer would get a different
 * ID, and chrome.storage.sync (which is keyed by ID) would not carry folders
 * between them. The matching private key is not needed and is not kept.
 */
const UNPACKED_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApOwql9ofqQc6qattTbRtgCXNwKBVacOa0RDHMmvba70HgZdzOK88RHTtQ72wdu0lYJe2I68xe8XURLNzl4BLTzGtH5LyYK1i/N4MYCkStCchqJaYjn1ld150lajlQLW6/BR3dYk85ZiCCj6x0b2rYzx+ClcIm+wS/a8JE3rb0/f/6EDLqEv/WfQhVuJQIKOoNXZDrhqQIhXrFLfHhdIVWe6n6uNNbCQVqHcg8PhBRKF7pzZ6yttoxSheyn3Q73WnICDoMg0U0Q6qw1oGEMfeYMFVKme+kMwKzYozQ5ZB/XIRVy/DFF/HX0OJ5WJhOywno0dMw93KdnUGv/vatDiHzQIDAQAB';

/**
 * Store packages are built with STORE=1 (the zip scripts set it). The Chrome
 * Web Store and Edge Add-ons reject a manifest `key`; they assign their own ID.
 */
const store = process.env.STORE === '1';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  zip: {
    // The GitHub release ships a ready-to-load Chrome build under a stable name.
    ...(store ? {} : { artifactTemplate: 'folders-for-youtube-{{browser}}.zip' }),
    // Firefox reviewers rebuild from source, which includes the shared workspace packages.
    sourcesRoot: '../..',
    excludeSources: ['**/node_modules/**', '**/.output/**', '**/.wxt/**', '.github/**', '**/store/**'],
  },
  manifest: ({ browser }) => ({
    name: 'Folders for YouTube',
    description: 'Organize your YouTube subscriptions and playlists into folders.',
    // Firefox shows the organizer as a sidebar (sidebar_action), which needs no permission.
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'sidePanel'],
    host_permissions: ['https://www.youtube.com/*'],
    action: { default_title: 'Organize folders' },
    commands: {
      'open-switcher': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Jump to a folder, channel or playlist',
      },
    },
    // sidePanel.open needs Chrome 116; main-world content scripts need Firefox 128.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'youtube-folders@igorfrance.github.io',
              strict_min_version: '128.0',
              // Required for new add-ons on addons.mozilla.org. Nothing is sent to the developer.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : { minimum_chrome_version: '116', ...(store ? {} : { key: UNPACKED_KEY }) }),
  }),
});
