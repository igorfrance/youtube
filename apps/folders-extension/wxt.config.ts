import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  zip: {
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
      : { minimum_chrome_version: '116' }),
  }),
});
