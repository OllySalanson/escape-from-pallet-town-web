// A place's local (`src/game/world/locals.ts`), played as a player meets them:
// a new save's first raid, the "!" over the local's head, a walk up to them,
// their tale read to the end, the box where they ink the place in, and THE MAP
// on M with the whole of the place on it - and the "!" gone, and the tale told
// again without the inking the second time.
//
//   node tools/playtest/localTale.mjs <test-mode build url> <out dir> [--local=NAME] [--port=N]
//
// --local is a local's name (AUNTIE MAB, the default, stands in Mill Square,
// where a new game lands); any other is walked to over the map's own collision.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const localName = option('local') ?? 'AUNTIE MAB';
const port = option('port');
if (!base || !outDir) {
  throw new Error('usage: localTale.mjs <test-mode build url> <out dir> [--local=NAME] [--port=N]');
}
mkdirSync(outDir, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const WORLD = `${GAME}.scene.getScene('world')`;
const DESCRIBE = `${GAME}.describe()`;

const page = await browser.openPage('about:blank');
try {
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 400; i += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await wait(60);
    await page.keyUp(code);
  };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const shot = async (name) => {
    await page.screenshot(`${outDir}/${name}.png`);
    console.log(`     ${outDir}/${name}.png`);
  };
  const dialogue = () => page.evaluate(`${DESCRIBE}.scene.world?.dialogue?.text ?? null`);
  const readThrough = async () => {
    for (let i = 0; i < 60; i += 1) {
      const busy = await page.evaluate(`(() => { const w = ${DESCRIBE}.scene.world; return Boolean(w && (w.dialogue || w.choice || w.busy)); })()`);
      if (!busy) return;
      await press('Space');
      await wait(300);
    }
  };
  /** Walks next to a tile over the scene's own collision, and faces it. */
  const walkUpTo = async (target) => {
    for (let guard = 0; guard < 6; guard += 1) {
      const plan = await page.evaluate(`(() => {
        const w = ${WORLD}; const from = w.currentTile; const t = ${JSON.stringify(target)};
        const key = (p) => p.x + ',' + p.y; const ways = [['ArrowUp',0,-1],['ArrowDown',0,1],['ArrowLeft',-1,0],['ArrowRight',1,0]];
        const seen = new Map([[key(from), null]]); const queue = [from];
        while (queue.length) { const at = queue.shift();
          for (const [code, dx, dy] of ways) { if (at.x + dx === t.x && at.y + dy === t.y) { const path = [code]; let k = key(at); while (seen.get(k)) { const [c, p] = seen.get(k); path.unshift(c); k = p; } return path; } }
          for (const [code, dx, dy] of ways) { const n = { x: at.x + dx, y: at.y + dy }; if (seen.has(key(n)) || w.isBlocked(n)) continue; seen.set(key(n), [code, key(at)]); queue.push(n); } }
        return null; })()`);
      if (!plan) throw new Error(`no way to ${JSON.stringify(target)}`);
      // The last press faces the local from beside them.
      for (const code of plan) {
        await press(code);
        await wait(260);
        if (await page.evaluate(`Boolean(${DESCRIBE}.scene.world?.dialogue)`)) { await readThrough(); break; }
      }
      const at = await page.evaluate(`${WORLD}.currentTile`);
      if (Math.abs(at.x - target.x) + Math.abs(at.y - target.y) === 1) return;
    }
    throw new Error('never got beside the local');
  };

  await page.send('Page.navigate', { url: url.toString() });
  await deploy(page, url.toString(), { press, click, until, wait, paused: true });
  await until(sceneIs('world'), 'the raid');
  await wait(1500);
  await readThrough();
  const local = await page.evaluate(`(() => { const e = ${WORLD}.currentMap.entities.find((one) => one.local?.name === ${JSON.stringify(localName)}); return e ? { x: e.position.x, y: e.position.y, id: e.id } : null; })()`);
  check(local !== null, `${localName} stands on the map`);
  check(await page.evaluate(`${WORLD}.localMarks.has(${JSON.stringify(local.id)})`), 'with a "!" over their head');
  await shot('1-local-marked');
  await walkUpTo(local);
  await press('Space');
  await wait(400);
  const lines = [];
  for (let i = 0; i < 30; i += 1) {
    const text = await dialogue();
    if (text === null) break;
    // Every box typed in full before it is read on.
    await press('Space');
    await wait(200);
    const whole = await dialogue();
    if (whole && lines.at(-1) !== whole) lines.push(whole);
    if (whole?.includes('inks in')) await shot('2-local-inks-in');
    await wait(900);
    await press('Space');
    await wait(300);
  }
  console.log(lines.map((line) => `     > ${line}`).join('\n'));
  check(lines.some((line) => line.startsWith(localName)), 'the tale opens on their name');
  check(lines.at(-1)?.includes('takes your map and inks in all of'), `it ends with the inking: "${lines.at(-1)}"`);
  const places = await page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.placesOnMap`);
  check(Object.values(places ?? {}).flat().length === 1, `the place is saved at once (${JSON.stringify(places)})`);
  check(!(await page.evaluate(`${WORLD}.localMarks.has(${JSON.stringify(local.id)})`)), 'and the "!" is gone');
  await shot('3-after-tale');

  await press('KeyM');
  await until(`(${DESCRIBE}.scene.world?.chart?.known ?? null) !== null`, 'the map');
  const known = await page.evaluate(`${DESCRIBE}.scene.world.chart.known`);
  check(known >= 64 * 64, `THE MAP lights the whole square (${known} tiles)`);
  await wait(300);
  await shot('4-map-close');
  await press('KeyZ');
  await wait(300);
  await shot('5-map-whole');
  await press('KeyM');
  await wait(300);

  await press('Space');
  await wait(400);
  const again = [];
  for (let i = 0; i < 12 && (await dialogue()) !== null; i += 1) {
    await press('Space');
    await wait(200);
    again.push(await dialogue());
    await wait(400);
    await press('Space');
    await wait(300);
  }
  check(!again.some((line) => line?.includes('inks in')), 'heard again, the tale has no second inking');
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.log(`${failures.length} failed`);
  process.exitCode = 1;
}
