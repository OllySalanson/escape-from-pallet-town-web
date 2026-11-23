// The first load on a slow line, as a friend on poor wifi meets it: a fresh tab
// on a browser already running on <cdp port> (one from `fm-browser.sh`), the
// cache off and the line throttled, photographed at 2, 6, 15, 30, 60, 90, 120
// and 180 seconds until the title is up (`docs/screens/slow-load/`).
//
//   node tools/playtest/slowLoad.mjs <cdp port> <test-mode build url> <out dir> [kbit/s=200] [latency ms=400]
//
// Serve a build, not the dev server: the dev server's hundreds of modules are
// not what a player downloads.
import { join } from 'node:path';
import { reattachPage, sleep, writeScreenshot } from './browser.mjs';
const [port, url, outDir, kbps = '200', latency = '400'] = process.argv.slice(2);
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const page = await reattachPage(Number(port), target.id, { window: { width: 960, height: 600 } });
try {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: Number(latency), downloadThroughput: (Number(kbps) * 1024) / 8, uploadThroughput: 50000 });
  await page.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  const t0 = Date.now();
  page.send('Page.navigate', { url });
  const shots = [2, 6, 15, 30, 60, 90, 120, 180];
  for (const s of shots) {
    while (Date.now() - t0 < s * 1000) await sleep(250);
    const st = await page.evaluate(`JSON.stringify({scenes: window.__escapeFromPalletTownGame__?.scene?.getScenes(true).map(s=>s.scene.key) ?? null, body: document.body?.innerText?.slice(0,200) ?? ''})`).catch((e) => 'eval failed ' + e.message);
    console.log(s + 's', st);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeScreenshot(join(outDir, `slow-${s}s.png`), data);
    if (st.includes('"title"')) { console.log('title at', (Date.now() - t0) / 1000); break; }
  }
} finally {
  // A reattached page's close only drops the connection; the tab is this script's to shut.
  await page.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => undefined);
}
