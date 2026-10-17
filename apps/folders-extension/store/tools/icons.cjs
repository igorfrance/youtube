// Renders the toolbar icons and store icons from store/icon.svg.
//   node store/tools/icons.cjs store/icon.svg public/icon store/images
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [svgPath, outDir, storeDir] = process.argv.slice(2);
const svg = fs.readFileSync(svgPath, 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const shot = async (size, file, pad = 0) => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
    await p.screenshot({ path: file, omitBackground: true });
  };
  for (const s of [16, 32, 48, 96, 128]) await shot(s, `${outDir}/${s}.png`);
  // Chrome Web Store: 128px with the artwork at 96px. Edge: 300px logo.
  await shot(128, `${storeDir}/store-icon-128.png`, 16);
  await shot(300, `${storeDir}/store-logo-300.png`);
  await b.close();
})();
