// How long the screen is black between a wild encounter and the battle's first
// frame, measured on a real build at real speed (`docs/screens/shiny-black-screen/`).
//
//   node tools/playtest/battleGap.mjs <build url> [--fights=N] [--latency=ms] [--team=..] [--wild-shiny] [--shot=file.png] [--port=N]
//
// It deploys a new save into Greystone Vale, starts each fight the way the grass
// does (`WorldScene.transitionToBattle`, a level-6 Caterpie) and prints, per
// fight, how long after the encounter the battle's `create` ran and its first
// frame was drawn, with the main thread's long tasks in between. A fight with
// nothing to download draws in about 0.2s; one that waited on a download used
// to stay black for as long as the line took. `--latency` puts the page on a
// slow line with its cache off; `--team=pidgey:8::shiny` deploys a shiny beside
// the starter (`deploy.mjs`), and `--wild-shiny` makes the Caterpie shiny and
// reports which colours it is drawn in six seconds on. `--shot` photographs the
// screen 0.7s after the encounter, and again at six seconds with --wild-shiny.
// `--port` drives a browser something else started (`attachBrowser`). It runs against any URL - the published game too, which exposes the game
// handle it drives.
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep, writeScreenshot } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const [url] = args.filter((arg) => !arg.startsWith('--'));
if (!url) throw new Error('usage: battleGap.mjs <build url> [--fights=N] [--latency=ms] [--team=..] [--wild-shiny] [--shot=file.png]');
const fights = Number(option('fights') ?? 1);
const latency = option('latency');
const team = option('team')?.split(',') ?? [];
const wildShiny = args.includes('--wild-shiny');
const shot = option('shot');

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const page = await browser.openPage('about:blank');
await page.send('Page.bringToFront');
const until = async (expression, what = expression) => {
  for (let i = 0; i < 600; i += 1) {
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`never saw ${what}`);
};
const press = async (code) => {
  await page.keyDown(code);
  await sleep(60);
  await page.keyUp(code);
};
const click = async (text) => {
  await until(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    `button "${text}"`,
  );
  await sleep(350);
};
const capture = async (path) => writeScreenshot(path, (await page.send('Page.captureScreenshot', { format: 'png' })).data);

// Times every fight from the encounter: when `create` ran, and the frame after it.
const HOOK = `(() => {
  const gap = (window.__battleGap = { long: [], fights: [] });
  try { new PerformanceObserver((list) => { for (const e of list.getEntries()) gap.long.push({ at: e.startTime, ms: Math.round(e.duration) }); }).observe({ type: 'longtask' }); } catch {}
  const battle = Object.getPrototypeOf(${GAME}.scene.getScene('battle'));
  const create = battle.create;
  battle.create = function (...a) {
    const fight = gap.current;
    const startedAt = performance.now();
    const result = create.apply(this, a);
    if (fight) {
      fight.createAfterMs = Math.round(startedAt - fight.t0);
      requestAnimationFrame(() => {
        fight.drawnAfterMs = Math.round(performance.now() - fight.t0);
        fight.longTasks = gap.long.filter((e) => e.at >= fight.t0).map((e) => ({ atMs: Math.round(e.at - fight.t0), ms: e.ms }));
        delete fight.t0;
        gap.fights.push(fight);
        gap.current = null;
      });
    }
    return result;
  };
  const world = Object.getPrototypeOf(${GAME}.scene.getScene('world'));
  const transition = world.transitionToBattle;
  world.transitionToBattle = function (...a) { gap.current = { t0: performance.now() }; return transition.apply(this, a); };
})()`;

try {
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url });
  await page.waitFor(`document.readyState === 'complete'`);
  await deploy(page, url, { press, click, until, wait: sleep, team });
  await page.evaluate(HOOK);
  if (latency) {
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: Number(latency), downloadThroughput: 50_000, uploadThroughput: 50_000 });
  }
  for (let i = 0; i < fights; i += 1) {
    await until(sceneIs('world'), 'the world');
    await sleep(1500);
    await page.evaluate(`${GAME}.scene.getScene('world').transitionToBattle({ wild: { speciesId: 'caterpie', level: 6, shiny: ${wildShiny} }, teachingBattle: false })`);
    if (shot) {
      await sleep(700);
      await capture(shot);
    }
    await until(`window.__battleGap.fights.length > ${i}`, 'the battle to draw');
    console.log(`fight ${i + 1}: ${JSON.stringify(await page.evaluate(`window.__battleGap.fights[${i}]`))}`);
    if (wildShiny) {
      await sleep(6000);
      console.log(`  drawn from ${await page.evaluate(`${GAME}.scene.getScene('battle').sprites.get('enemy0')?.texture?.key`)} six seconds on`);
      if (shot) await capture(shot.replace(/\.png$/, '-6s.png'));
    }
    // Out again: RUN until it works, and through whatever is said.
    for (let k = 0; k < 200 && (await page.evaluate(sceneIs('battle'))); k += 1) {
      await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('battle'); if (b.state?.outcome == null && !b.isPresentingCombatEvents && !b.dialog?.visible) b.flee(); })()`);
      await press('Space');
      await sleep(300);
    }
  }
} finally {
  await browser.close();
}
