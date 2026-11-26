// The first OK tapped after a keyboard press, on a touch screen (`input/touchPlay.ts`,
// `ui/touchPad.ts`).
//
//   node tools/playtest/touchAfterKeys.mjs <test-mode build url> [shot.png] [--port=N] [--no-keys]
//
// A phone-sized window (844x390) with touch emulated: a first touch puts the pad up,
// then two real keyboard presses on the title, then one tap of the pad's OK, which
// must start NEW GAME. A keyboard press used to take the pad away, and once kept, the
// touch that turned touch play back on redrew OK's label under the finger, so the
// first OK after a keyboard press was swallowed (the navigation audit, 25 Nov 2026).
// It logs the pointer and key events the tap made, and exits non-zero if it was
// swallowed. `--no-keys` is the control: the same tap with no keyboard press first.
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';
const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, shot] = args.filter((arg) => !arg.startsWith('--'));
if (!url) throw new Error('usage: touchAfterKeys.mjs <test-mode build url> [shot.png] [--port=N] [--no-keys]');
const window = { width: 844, height: 390 };
const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
const page = await browser.openPage('about:blank');
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await page.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
const tap = async (x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(80);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
};
const okAt = () => page.evaluate(`(() => { const b = document.querySelector('[data-key="Space"]'); if (!b) return null; const r = b.getBoundingClientRect(); const root = b.closest('[hidden]'); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hidden: Boolean(root) || r.width === 0 }; })()`);
try {
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await sleep(1500);
  // A first touch somewhere harmless: touch play on, the pad up.
  await tap(5, 5);
  const ok = await okAt();
  console.log('OK button:', JSON.stringify(ok));
  // A real keyboard press (Down: NEW GAME to MAKE A MAP), then back Up.
  for (const key of (args.includes('--no-keys') ? [] : ['ArrowDown', 'ArrowUp'])) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: key === 'ArrowDown' ? 40 : 38 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: key === 'ArrowDown' ? 40 : 38 });
    await sleep(300);
  }
  console.log('after keys, OK button:', JSON.stringify(await okAt()), 'choice:', await page.evaluate(`${GAME}.scene.getScene('title').choice`));
  // The first tap of OK after the keyboard: NEW GAME must start.
  await page.evaluate(`(() => { window.__seen = []; for (const t of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(t, (e) => window.__seen.push(t + ':' + (e.pointerType || e.key || '') + ':' + (e.target?.dataset?.key || e.target?.tagName || '')), true); })()`);
  await tap(ok.x, ok.y);
  await sleep(1500);
  console.log('events:', JSON.stringify(await page.evaluate('window.__seen')));
  const left = !(await page.evaluate(sceneIs('title'))) || (await page.evaluate(`${GAME}.scene.getScene('title').hasStarted === true`));
  console.log(left ? 'ok: the first OK after the keyboard was taken' : 'FAIL: the first OK after the keyboard was swallowed');
  if (shot) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    (await import('node:fs')).writeFileSync(shot, Buffer.from(data, 'base64'));
  }
  if (!left) process.exitCode = 1;
} finally { await browser.close(); }
