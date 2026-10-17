// Renders the store screenshots and promo tiles.
//
// Loads the built Chrome extension into Chromium against a simulated
// youtube.com (dark theme) filled with made-up channels and playlists, takes
// raw shots of each feature, then frames them with a caption.
//
//   bun run build && node store/tools/screenshots.cjs
//
// Needs Playwright with Chromium: set PLAYWRIGHT to its module path if it is
// not installed where Node can find it.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP = path.resolve(__dirname, '../..');
const EXT = path.join(APP, '.output/chrome-mv3');
const OUT = path.join(APP, 'store/images');
const RAW = fs.mkdtempSync(path.join(os.tmpdir(), 'ytf-shots-'));
const ICON = fs.readFileSync(path.join(APP, 'store/icon.svg'), 'utf8');

// --- Made-up library ---------------------------------------------------------
const channelId = (n) => 'UC' + String(n).padStart(22, 'x');
const CHANNELS = [
  ['Kitchen Notes', ['Weeknight ramen from scratch', 'Knife skills you actually need', 'The only pan sauce you need']],
  ['Fermentation Lab', ['Hot sauce, 3 ways', 'Kimchi for beginners', 'Why my miso failed']],
  ['The Sourdough Shed', ['Open crumb without the stress', 'Starter rescue guide', 'Baking at high altitude']],
  ['Butter & Crumb', ['Croissants, start to finish', 'Lamination mistakes', 'Brown butter cookies']],
  ['Weeknight Wok', ['15-minute fried rice', 'Getting wok hei at home', 'Mapo tofu, simplified']],
  ['Bench Tested', ['I tested 12 USB-C chargers', 'Best budget monitor 2026', 'Mechanical keyboards, explained']],
  ['Circuit Garden', ['Soil sensor with an ESP32', 'Solar-powered weather station', 'Fixing a dead amp']],
  ['Retro Computing Bay', ['Restoring a 1984 Macintosh', 'Floppy drive repair', 'The weirdest home computer']],
  ['Type Level', ['TypeScript generics in 10 minutes', 'Branded types are underrated', 'Inference tricks I use daily']],
  ['Rust Corner', ['Lifetimes without tears', 'Async Rust in practice', 'Writing a tiny database']],
  ['Frontend Field Notes', ['CSS container queries, for real', 'View transitions deep dive', 'Accessible menus done right']],
  ['Compiler Nights', ['Build a parser in an hour', 'How register allocation works', 'SSA form, visually']],
  ['Synth Diaries', ['Patch from zero: warm pad', 'Modular on a budget', 'Sound design challenge']],
  ['Jazz Theory Weekly', ['ii–V–I in every key', 'Reharmonizing standards', 'Walking bass basics']],
  ['Drum Room Sessions', ['Ghost notes groove', 'Tuning toms fast', 'Odd time made easy']],
  ['Garden Year', ['Planting garlic in October', 'No-dig beds, one year later', 'Saving tomato seeds']],
  ['Orbit Explained', ['How gravity assists work', 'Why Mars is so hard', 'Lagrange points in 8 minutes']],
  ['History in Maps', ['The Silk Road, animated', 'How borders were drawn', 'Rome at its peak']],
  ['Math Shapes', ['Visualizing the Fourier transform', 'Why π shows up everywhere', 'Topology for everyone']],
  ['Trail Running Diaries', ['My first ultra', 'Gear for winter trails', 'Training on hills']],
  ['Woodshop Weekend', ['Building a walnut desk', 'Hand-cut dovetails', 'Shop tour 2026']],
  ['Film Grain', ['Shooting Portra in winter', 'Developing at home', 'Cheap cameras, great photos']],
  ['Urban Sketch Club', ['Sketching people quickly', 'Watercolor on location', 'Perspective shortcuts']],
].map(([title, videos], i) => ({ id: channelId(i), title, videos, handle: '@' + title.replace(/[^a-z]/gi, '').toLowerCase() }));
const ch = (title) => CHANNELS.find((c) => c.title === title).id;

const PLAYLISTS = [
  ['WL', 'Watch later', 34, 'You'],
  ['LL', 'Liked videos', 412, 'You'],
  ['PLsour', 'Sourdough attempts', 18, 'You'],
  ['PLsour2', 'Sourdough: advanced', 9, 'You'],
  ['PLrust', 'Rust in 30 days', 30, 'Rust Corner'],
  ['PLtalks', 'Conference talks 2026', 26, 'You'],
  ['PLsynth', 'Synth patches to try', 14, 'You'],
  ['PLjazz', 'Jazz standards', 48, 'You'],
  ['PLroad', 'Road trip mix', 61, 'You'],
  ['PLweek', 'Weekend projects', 12, 'You'],
  ['PLmob', 'Morning mobility', 7, 'You'],
  ['PLkids', "Kids' science", 22, 'You'],
].map(([id, title, count, owner]) => ({ id, title, count, owner }));

const folder = (id, tree, name, color, parentId = null, order = 1, icon) => ({ id, tree, name, color, parentId, order, ...(icon ? { icon } : {}) });
const ORG = {
  app: 'youtube-folders',
  version: 1,
  org: {
    folders: [
      folder('cook', 'subscriptions', 'Cooking', '#e8710a', null, 1),
      folder('bake', 'subscriptions', 'Baking', '#f9ab00', 'cook', 1),
      folder('tech', 'subscriptions', 'Tech', '#1a73e8', null, 2),
      folder('code', 'subscriptions', 'Programming', '#12b5cb', 'tech', 1),
      folder('music', 'subscriptions', 'Music', '#d01884', null, 3),
      folder('learn', 'subscriptions', 'Learning', '#1e8e3e', null, 4),
      folder('pcook', 'playlists', 'Kitchen', '#e8710a', null, 1),
      folder('pcode', 'playlists', 'Code', '#1a73e8', null, 2),
      folder('pmusic', 'playlists', 'Music', '#d01884', null, 3),
    ],
    placements: {
      [ch('Kitchen Notes')]: ['cook'],
      [ch('Fermentation Lab')]: ['cook'],
      [ch('Weeknight Wok')]: ['cook'],
      [ch('The Sourdough Shed')]: ['bake'],
      [ch('Butter & Crumb')]: ['bake'],
      [ch('Bench Tested')]: ['tech'],
      [ch('Circuit Garden')]: ['tech', 'learn'],
      [ch('Retro Computing Bay')]: ['tech'],
      [ch('Type Level')]: ['code'],
      [ch('Rust Corner')]: ['code'],
      [ch('Frontend Field Notes')]: ['code'],
      [ch('Compiler Nights')]: ['code', 'learn'],
      [ch('Synth Diaries')]: ['music'],
      [ch('Jazz Theory Weekly')]: ['music'],
      [ch('Drum Room Sessions')]: ['music'],
      [ch('Garden Year')]: ['learn'],
      [ch('Orbit Explained')]: ['learn'],
      [ch('History in Maps')]: ['learn'],
      [ch('Math Shapes')]: ['learn'],
      PLsour: ['pcook'],
      PLsour2: ['pcook'],
      PLrust: ['pcode'],
      PLtalks: ['pcode'],
      PLsynth: ['pmusic'],
      PLjazz: ['pmusic'],
    },
    settings: { replaceNativeSubscriptions: true, feedShowShorts: true },
  },
};

// --- Fake YouTube responses --------------------------------------------------
const channelRenderer = (c) => ({
  channelRenderer: {
    channelId: c.id,
    title: { simpleText: c.title },
    thumbnail: { thumbnails: [{ url: `https://yt3.ggpht.com/avatar/${encodeURIComponent(c.title)}` }] },
    navigationEndpoint: { browseEndpoint: { browseId: c.id, canonicalBaseUrl: `/${c.handle}` } },
  },
});
const browse = {
  FEchannels: { contents: { items: CHANNELS.map(channelRenderer) } },
  FEplaylist_aggregation: {
    items: PLAYLISTS.map((p) => ({
      lockupViewModel: {
        contentId: p.id,
        contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST',
        contentImage: { collectionThumbnailViewModel: { primaryThumbnail: { thumbnailViewModel: { image: { sources: [{ url: `https://i.ytimg.com/pl/${p.id}.jpg` }] }, overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: `${p.count} videos` } }] } }] } } } },
        metadata: { lockupMetadataViewModel: { title: { content: p.title }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: p.owner } }] }] } } } },
      },
    })),
  },
};

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const avatarSvg = (name) => {
  const hue = hash(name) % 360;
  const initials = name.split(/\s+/).filter((w) => /[a-z]/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" fill="hsl(${hue} 55% 42%)"/><text x="44" y="56" font-family="Roboto,Arial,sans-serif" font-size="34" font-weight="500" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
};
const thumbSvg = (key) => {
  const h = hash(key);
  const a = h % 360;
  const b = (a + 40 + (h % 80)) % 360;
  const cx = 20 + (h % 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 50% 38%)"/><stop offset="1" stop-color="hsl(${b} 55% 22%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="${cx * 3.2}" cy="${60 + (h % 70)}" r="${40 + (h % 40)}" fill="hsl(${b} 70% 70%)" opacity=".25"/><rect x="${(h >> 3) % 160}" y="${110 - ((h >> 5) % 50)}" width="${90 + ((h >> 7) % 80)}" height="${40 + ((h >> 9) % 40)}" rx="10" fill="hsl(${a} 60% 80%)" opacity=".18"/></svg>`;
};

const DAY = 86400_000;
const now = Date.now();
const rss = (c) => {
  const entries = c.videos.map((title, k) => {
    const vid = `${c.id.slice(-4)}v${k}`;
    const published = new Date(now - (hash(c.title + k) % 9) * DAY - k * 2 * DAY - (hash(title) % 20) * 3600_000).toISOString();
    const views = 1200 + (hash(title) % 480_000);
    return `<entry><yt:videoId>${vid}</yt:videoId><yt:channelId>${c.id}</yt:channelId><title>${title.replace(/&/g, '&amp;')}</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=${vid}"/><author><name>${c.title.replace(/&/g, '&amp;')}</name></author>
<published>${published}</published><media:group><media:thumbnail url="https://i.ytimg.com/vi/${vid}/hqdefault.jpg"/><media:community><media:statistics views="${views}"/></media:community></media:group></entry>`;
  });
  return `<?xml version="1.0"?><feed><title>${c.title.replace(/&/g, '&amp;')}</title>${entries.join('')}</feed>`;
};

const icon = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${d}"/></svg>`;
const ICONS = {
  home: 'M4 10v11h6v-6h4v6h6V10l-8-7z',
  shorts: 'M17 3l-9 5v8l9 5V3zM6 9H3v6h3V9z',
  subs: 'M10 18v-6l5 3-5 3zm7-15H7v1h10V3zm3 3H4v1h16V6zm2 3H2v12h20V9z',
  you: 'M12 3a4 4 0 100 8 4 4 0 000-8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H4z',
  history: 'M13 3a9 9 0 00-9 9H1l4 4 4-4H6a7 7 0 112 4.9l-1.4 1.4A9 9 0 1013 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 109.5 16a6.5 6.5 0 004.2-1.6l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 110-9 4.5 4.5 0 010 9z',
  bell: 'M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6V11c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 00-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1z',
};
const guideEntry = (href, label, iconName) =>
  `<ytd-guide-entry-renderer><a href="${href}">${iconName ? icon(ICONS[iconName]) : `<img src="https://yt3.ggpht.com/avatar/${encodeURIComponent(label)}" />`}<span>${label.replace(/&/g, '&amp;')}</span></a></ytd-guide-entry-renderer>`;

const homeCards = CHANNELS.slice(0, 12)
  .map((c, i) => {
    const t = c.videos[i % 3];
    return `<div class="vcard"><img class="th" src="https://i.ytimg.com/vi/home${i}/hq.jpg"/><div class="row"><img class="av" src="https://yt3.ggpht.com/avatar/${encodeURIComponent(c.title)}"/><div><div class="t">${t}</div><div class="s">${c.title.replace(/&/g, '&amp;')}</div><div class="s">${(hash(t) % 900) + 12}K views · ${(hash(c.title) % 6) + 1} days ago</div></div></div></div>`;
  })
  .join('');

const page = () => `<!doctype html><html dark><head><meta charset="utf-8"><title>YouTube</title>
<script>window.ytcfg={data_:{LOGGED_IN:true,INNERTUBE_API_KEY:'key',INNERTUBE_CONTEXT:{client:{clientName:'WEB',clientVersion:'2.0'}},INNERTUBE_CONTEXT_CLIENT_NAME:1,INNERTUBE_CLIENT_VERSION:'2.0'},get(k){return this.data_[k]}};var ytInitialData={};</script>
<style>
html{--yt-spec-base-background:#0f0f0f;--yt-spec-raised-background:#212121;--yt-spec-menu-background:#282828;--yt-spec-text-primary:#f1f1f1;--yt-spec-text-secondary:#aaa;--yt-spec-badge-chip-background:rgba(255,255,255,.1);--yt-spec-10-percent-layer:rgba(255,255,255,.2);--yt-spec-call-to-action:#3ea6ff;color-scheme:dark}
body{margin:0;background:#0f0f0f;color:#f1f1f1;font-family:Roboto,'Segoe UI',Arial,sans-serif;overflow:hidden}
#masthead-container{position:fixed;top:0;left:0;right:0;height:56px;display:flex;align-items:center;gap:16px;padding:0 16px;background:#0f0f0f;z-index:5}
#masthead-container .ic{color:#f1f1f1;display:flex}
.search{margin:0 auto;display:flex;width:560px;height:40px}
.search div{flex:1;border:1px solid #303030;border-radius:20px 0 0 20px;background:#121212;color:#888;padding:0 16px;display:flex;align-items:center;font-size:15px}
.search span{width:64px;border:1px solid #303030;border-left:none;border-radius:0 20px 20px 0;background:#222;display:flex;align-items:center;justify-content:center;color:#f1f1f1}
.me{width:32px;height:32px;border-radius:50%;background:hsl(210 50% 45%);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500}
tp-yt-app-drawer{display:block;position:fixed;top:56px;left:0;width:240px;bottom:0;overflow:hidden}
#contentContainer{width:240px}
ytd-guide-section-renderer{display:block;padding:12px;border-bottom:1px solid rgba(255,255,255,.2)}
ytd-guide-section-renderer h3{margin:4px 12px 6px;font-size:16px;font-weight:500}
ytd-guide-entry-renderer a{display:flex;align-items:center;gap:24px;height:40px;padding:0 12px;border-radius:10px;color:#f1f1f1;text-decoration:none;font-size:14px}
ytd-guide-entry-renderer:first-child a{background:rgba(255,255,255,.1);font-weight:500}
ytd-guide-entry-renderer img{width:24px;height:24px;border-radius:50%}
#page{position:absolute;top:56px;left:240px;right:0;padding:12px 24px}
.chips{display:flex;gap:12px;margin-bottom:24px}
.chips span{background:rgba(255,255,255,.1);border-radius:8px;padding:6px 12px;font-size:14px;font-weight:500}
.chips span:first-child{background:#f1f1f1;color:#0f0f0f}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:40px 16px}
.vcard .th{width:100%;aspect-ratio:16/9;border-radius:12px;display:block;object-fit:cover}
.vcard .row{display:flex;gap:12px;margin-top:12px}
.vcard .av{width:36px;height:36px;border-radius:50%}
.vcard .t{font-size:16px;font-weight:500;line-height:22px}
.vcard .s{font-size:14px;color:#aaa;line-height:20px}
</style></head>
<body><div id="masthead-container"><span class="ic">${icon(ICONS.menu)}</span><div class="search"><div>Search</div><span>${icon(ICONS.search)}</span></div><span class="ic">${icon(ICONS.bell)}</span><span class="me">I</span></div>
<tp-yt-app-drawer id="guide" opened><div id="contentContainer"><ytd-guide-renderer><div id="sections">
<ytd-guide-section-renderer>${guideEntry('/', 'Home', 'home')}${guideEntry('/shorts', 'Shorts', 'shorts')}${guideEntry('/feed/subscriptions', 'Subscriptions', 'subs')}</ytd-guide-section-renderer>
<ytd-guide-section-renderer><h3>Subscriptions</h3>${CHANNELS.map((c) => guideEntry(`/${c.handle}`, c.title)).join('')}</ytd-guide-section-renderer>
<ytd-guide-section-renderer>${guideEntry('/feed/you', 'You', 'you')}${guideEntry('/feed/history', 'History', 'history')}</ytd-guide-section-renderer>
</div></ytd-guide-renderer></div></tp-yt-app-drawer>
<div id="page"><div class="chips"><span>All</span><span>Music</span><span>Cooking</span><span>Computers</span><span>Live</span><span>Gardening</span><span>Recently uploaded</span></div><div class="grid">${homeCards}</div></div></body></html>`;

// --- Framing -----------------------------------------------------------------
const fileUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const FONT = "font-family:Roboto,'Segoe UI',Arial,sans-serif";
const BRAND = 'background:linear-gradient(135deg,#4f6ef7 0%,#3346c9 55%,#24308f 100%)';
const frame = (title, sub, img) => `<html><body style="margin:0;width:1280px;height:800px;${BRAND};${FONT};color:#fff;overflow:hidden">
<div style="height:120px;display:flex;flex-direction:column;justify-content:center;padding:0 80px">
<div style="font-size:38px;font-weight:700;letter-spacing:-.5px">${title}</div><div style="font-size:19px;opacity:.85;margin-top:6px">${sub}</div></div>
<img src="${img}" style="position:absolute;left:80px;top:136px;width:1120px;height:700px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.45)"/></body></html>`;
const sideBySide = (left, right) => `<html><body style="margin:0;width:1280px;height:800px;display:flex;background:#0f0f0f;overflow:hidden">
<img src="${left}" style="width:880px;height:800px;object-fit:cover;object-position:left top;filter:brightness(.8)"/><img src="${right}" style="width:400px;height:800px;border-left:1px solid #303030"/></body></html>`;

(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ytf-profile-')), {
    headless: true,
    channel: 'chromium',
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 800 },
  });
  await ctx.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.youtube.com') {
      if (url.pathname === '/youtubei/v1/browse') {
        const body = JSON.parse(route.request().postData());
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(browse[body.browseId] ?? {}) });
      }
      return route.fulfill({ contentType: 'text/html', body: page() });
    }
    if (url.hostname === 'yt3.ggpht.com') return route.fulfill({ contentType: 'image/svg+xml', body: avatarSvg(decodeURIComponent(url.pathname.split('/').pop())) });
    if (url.hostname === 'i.ytimg.com') return route.fulfill({ contentType: 'image/svg+xml', body: thumbSvg(url.pathname) });
    return route.fulfill({ status: 404, body: '' });
  });
  await ctx.addCookies([{ name: 'SAPISID', value: 'sid', domain: '.youtube.com', path: '/', secure: true }]);
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  // The service worker's own requests can't be routed; give it the fake feeds directly.
  await sw.evaluate(
    ({ feeds }) => {
      self.fetch = async (url) => new Response(feeds[new URL(url).searchParams.get('channel_id')] ?? '<feed/>');
    },
    { feeds: Object.fromEntries(CHANNELS.map((c) => [c.id, rss(c)])) },
  );

  const yt = await ctx.newPage();
  await yt.goto('https://www.youtube.com/');
  await yt.waitForFunction(() => document.querySelector('ytf-sidebar')?.shadowRoot?.textContent?.includes('Unsorted'), null, { timeout: 20000 });

  // Load the folders through the organizer's own import.
  const sp = await ctx.newPage();
  sp.on('dialog', (d) => d.accept());
  await sp.setViewportSize({ width: 400, height: 800 });
  await sp.goto(`chrome-extension://${extId}/sidepanel.html`);
  await sp.getByText('Kitchen Notes').first().waitFor();
  const orgFile = path.join(RAW, 'folders.json');
  fs.writeFileSync(orgFile, JSON.stringify(ORG));
  await sp.getByRole('button', { name: 'Settings' }).click();
  await sp.locator('input[type=file]').setInputFiles(orgFile);
  await sp.getByText(/Imported \d+ folders/).waitFor();
  await sp.reload();
  await sp.getByText('Programming').first().waitFor();

  const raw = (n) => path.join(RAW, `${n}.png`);
  await yt.bringToFront();
  await yt.waitForFunction(() => document.querySelector('ytf-sidebar')?.shadowRoot?.textContent?.includes('Programming'), null, { timeout: 10000 });
  await yt.waitForTimeout(500);
  await yt.screenshot({ path: raw('sidebar') });

  // Folder feed.
  await yt.locator('ytf-sidebar').getByRole('button', { name: /^Tech/ }).click();
  await yt.locator('ytf-overlays').getByText('I tested 12 USB-C chargers').waitFor({ timeout: 10000 });
  await yt.waitForTimeout(600);
  await yt.screenshot({ path: raw('feed') });
  await yt.keyboard.press('Escape');

  // Quick switcher.
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    await chrome.tabs.sendMessage(tab.id, { type: 'switcher:open' });
  });
  await yt.locator('ytf-overlays').getByRole('combobox').pressSequentially('so', { delay: 40 });
  await yt.waitForTimeout(400);
  await yt.screenshot({ path: raw('switcher') });
  await yt.keyboard.press('Escape');

  // Organizer: select a few unsorted channels, ready to file.
  await sp.bringToFront();
  for (const name of ['Cooking', 'Tech']) await sp.getByRole('button', { name: `Collapse ${name}` }).click();
  await sp.locator('.tree .row', { hasText: 'Unsorted' }).first().locator('.name').click();
  await sp.getByRole('option', { name: /Trail Running Diaries/ }).click();
  await sp.getByRole('option', { name: /Woodshop Weekend/ }).click();
  await sp.waitForTimeout(300);
  await sp.screenshot({ path: raw('organizer') });
  await sp.getByRole('button', { name: 'Clear' }).click().catch(() => {});

  // Merge dialog.
  await sp.getByRole('tab', { name: /Playlists/ }).click();
  await sp.locator('.tree .row', { hasText: 'Kitchen' }).first().locator('.name').click();
  await sp.getByRole('option', { name: /Sourdough attempts/ }).click();
  await sp.getByRole('option', { name: /Sourdough: advanced/ }).click();
  await sp.getByRole('button', { name: /Merge…/ }).click();
  await sp.getByLabel('New playlist name').fill('Sourdough');
  await sp.waitForTimeout(300);
  await sp.screenshot({ path: raw('merge') });

  // Compose.
  const render = async (html, file, w = 1280, h = 800) => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(html);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.isAbsolute(file) ? file : path.join(OUT, file) });
    await p.close();
  };
  const orgWide = raw('organizer-wide');
  await render(sideBySide(fileUrl(raw('sidebar')), fileUrl(raw('organizer'))), orgWide);
  const mergeWide = raw('merge-wide');
  await render(sideBySide(fileUrl(raw('sidebar')), fileUrl(raw('merge'))), mergeWide);

  const shots = [
    ['1-folders', 'Your subscriptions, in folders', 'Folders replace the long subscription list in YouTube’s sidebar. Nest them, color them, file a channel in several.', raw('sidebar')],
    ['2-folder-feed', 'One feed per folder', 'Click a folder to see the latest uploads from just those channels.', raw('feed')],
    ['3-organizer', 'Sort hundreds of channels in minutes', 'Select or drag channels and playlists onto folders in the organizer.', orgWide],
    ['4-quick-switcher', 'Jump anywhere with Alt+Shift+F', 'Search your folders, channels and playlists from the keyboard.', raw('switcher')],
    ['5-merge-playlists', 'Merge and clean up playlists', 'Combine playlists without duplicates, unsubscribe and delete in bulk.', mergeWide],
  ];
  for (const [name, title, sub, img] of shots) await render(frame(title, sub, fileUrl(img)), `screenshot-${name}.png`);

  const iconTag = (size) => ICON.replace('<svg ', `<svg width="${size}" height="${size}" style="filter:drop-shadow(0 8px 20px rgba(0,0,0,.35))" `);
  await render(
    `<html><body style="margin:0;width:440px;height:280px;${BRAND};${FONT};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;overflow:hidden">
${iconTag(96)}<div style="font-size:30px;font-weight:700;letter-spacing:-.3px">Folders for YouTube</div><div style="font-size:16px;opacity:.88">Subscriptions and playlists, organized</div></body></html>`,
    'promo-small-440x280.png',
    440,
    280,
  );
  await render(
    `<html><body style="margin:0;width:1400px;height:560px;${BRAND};${FONT};color:#fff;overflow:hidden;position:relative">
<div style="position:absolute;left:90px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:18px">${iconTag(88)}
<div style="font-size:54px;font-weight:700;letter-spacing:-1px;line-height:1.05">Folders for YouTube</div>
<div style="font-size:22px;opacity:.9;line-height:1.4">Put your subscriptions and playlists into folders, with a feed for each one.</div></div>
<img src="${fileUrl(raw('feed'))}" style="position:absolute;left:700px;top:70px;width:800px;height:500px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.45)"/></body></html>`,
    'promo-marquee-1400x560.png',
    1400,
    560,
  );

  await ctx.close();
  console.log('wrote', fs.readdirSync(OUT).join(', '));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
