// Plays the hunter's arrival and photographs the warning it is now: a red glow
// at the screen's edge and the chip naming the rival, never a dialogue box
// (`src/game/world/hunterWarning.ts`).
//
//   node tools/playtest/hunterWarning.mjs <url of a test-mode build> <out dir> [--reduced-motion] [--with-search] [--window=WxH]
//
// It deploys a fresh save, brings the hunter in beside the player, and prints
// the glow's strength frame by frame through the arrival and the trail, with
// whether a dialogue box went up and whether the raid clock kept running. It
// photographs the top of the first pulse (`arrival.png`), the trail's beat
// (`trail.png`) and the catch (`caught.png`). --reduced-motion asks the page
// for reduced motion, which holds the border steady instead of pulsing.
// --with-search opens a search of the map's first cache as the hunter comes,
// because the warning has to be read over a search as well as over the map.
import { mkdirSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [base, outDir] = args.filter((a) => !a.startsWith('--'));
const reduced = args.includes('--reduced-motion');
const withSearch = args.includes('--with-search');
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
mkdirSync(outDir, { recursive: true });

const sized = /^(\d+)x(\d+)$/.exec(args.find((a) => a.startsWith('--window='))?.slice(9) ?? '1200x768');
const browser = await launchBrowser({ window: { width: Number(sized[1]), height: Number(sized[2]) } });
const world = `${GAME}.scene.getScene('world')`;
const main = async () => {
  const page = await browser.openPage('about:blank');
  if (reduced) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms, frameMs = 100) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / frameMs))}, ${frameMs})`);
  const until = async (expression, what = expression) => {
    for (let i = 0; i < 300; i += 1) { if (await page.evaluate(expression)) return; await wait(100); }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => {
    await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`, `button "${text}"`);
    await wait(350);
  };
  const shot = async (name) => { await page.screenshot(`${outDir}/${name}.png`); console.log('shot', name); };
  const glow = `(${world}.hunterGlow?.drawn?.strength ?? 0)`;

  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  await wait(1500);
  await deploy(page, url.href, { press, until, wait, click, paused: true });
  await until(sceneIs('world'));
  for (let i = 0; i < 12 && (await page.evaluate(`${world}.dialogBox.visible`)); i += 1) { await press('Space'); await wait(250); }
  await wait(400);
  console.log('before the hunter: glow', await page.evaluate(glow));

  if (withSearch) {
    // Opened where the player stands rather than walked to: what is being
    // photographed is the warning over the panel, not the walk.
    await page.evaluate(`(() => { const w = ${world}; w.beginSearch(w.currentMap.pois.find((p) => p.reward.length > 1 && !p.locked)); })()`);
  }
  await page.evaluate(`(() => { const w = ${world}; const s = w.runSession;
    s.plan = { ...s.plan, hunter: { ...s.plan.hunter, spawnDelayMs: 0 } }; s.stepsTaken = 99; })()`);
  await until(`${world}.hunterArrived !== null`, 'the hunter to arrive');
  const clockAt = await page.evaluate(`${world}.runSession.manager.snapshot().remainingMs`);
  const samples = [];
  let boxed = false;
  for (let i = 0; i < 40; i += 1) {
    await wait(50, 50);
    samples.push(await page.evaluate(glow));
    boxed ||= await page.evaluate(`${world}.dialogBox.visible`);
    if (i === 5) await shot('arrival');
  }
  const chip = await page.evaluate(`${world}.raidHud ? JSON.stringify(${world}.hunterShout()) : null`);
  console.log('arrival, every 50ms:', samples.map((s) => s.toFixed(2)).join(' '));
  console.log('a dialogue box went up:', boxed, '- chip shout:', chip);
  console.log('raid clock ran for', clockAt - (await page.evaluate(`${world}.runSession.manager.snapshot().remainingMs`)), 'ms of 2000');

  // The trail: the hunter a few steps away, beating.
  const trail = [];
  for (let i = 0; i < 30; i += 1) { await wait(50, 50); trail.push(await page.evaluate(glow)); if (i === 4) await shot('trail'); }
  console.log('trail at', await page.evaluate(`${world}.hunterStepsAway()`), 'steps, every 50ms:', trail.map((s) => s.toFixed(2)).join(' '));

  await page.evaluate(`(() => { const w = ${world}; const t = w.currentTile;
    const beside = [[0,-1,'up'],[1,0,'right'],[-1,0,'left'],[0,1,'down']].find(([dx, dy]) => w.collisionData[t.y + dy]?.[t.x + dx] === false);
    const [dx, dy, facing] = beside; const p = { x: t.x + dx, y: t.y + dy };
    w.hunterState = { ...w.hunterState, position: p, mapId: w.currentMap.id };
    w.placeFigure('rival-hunter', p.x, p.y, 'down');
    w.tryWalkIntoHunter(facing); })()`);
  await until(`${world}.dialogBox.visible`, 'the caught line');
  await wait(2000);
  await shot('caught');
};
try {
  await main();
} finally {
  await browser.close();
}
