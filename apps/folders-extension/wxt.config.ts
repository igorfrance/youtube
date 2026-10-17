import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'YouTube Folders',
    description: 'Organize your YouTube subscriptions and playlists into folders.',
    permissions: ['storage', 'sidePanel'],
    host_permissions: ['https://www.youtube.com/*'],
    action: { default_title: 'Organize folders' },
    commands: {
      'open-switcher': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Jump to a folder, channel or playlist',
      },
    },
  },
});
