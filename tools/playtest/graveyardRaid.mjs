// A night raid stood in the Moor Chapel's churchyard, written out as the
// page's whole storage, for the AI playtester to take up there
// (`ai-player/act start --storage=<file>`).
//
//   node tools/playtest/graveyardRaid.mjs <test-mode build url> <storage.json> [--level=N] [--team=species:level,..] [--pack=itemId:n,..]
//
// Puts the page's clock at eleven at night, deploys a new save at Moor Top
// with the team and pack asked for, walks the sheep track through the fog to
// the churchyard - fighting whatever the walk meets with the first move, as a
// player mashing OK would - stops on the churchyard's path, and copies out
// every key of localStorage: the save, and the raid written down beside it
// (`run/raidResume.ts`), which CONTINUE on the title takes up where it stood.
import { writeFileSync } from 'node:fs';
import { launchBrowser, LOGIC_WINDOW } from './browser.mjs';
import { GAME, deploy } from './deploy.mjs';
import { routeTo } from './route.mjs';

const args = process.argv.slice(2);
const [base, out] = args.filter((arg) => !arg.startsWith('--'));
if (!base || !out) throw new Error('usage: graveyardRaid.mjs <test-mode build url> <storage.json> [--level=N] [--team=..] [--pack=..]');
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (name) => (option(name) ? option(name).split(',') : []);
const url = new URL(base);
url.searchParams.set('testmode', '1');
const W = `${GAME}.scene.getScene('world')`;
const B = `${GAME}.scene.getScene('battle')`;
/** Where the walk stops: the corpse road beside the churchyard wall, by the chapel. */
const CHURCHYARD = { x: 20, y: 94 };

const zoneFor = (hour) => {
  let offset = (hour - new Date().getUTCHours() + 24) % 24;
  if (offset > 14) offset -= 24;
  return offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
};

const browser = await launchBrowser({ window: LOGIC_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Emulation.setTimezoneOverride', { timezoneId: zoneFor(23) });
  await page.send('Page.navigate', { url: url.href });
  await page.waitFor(`typeof localStorage !== 'undefined'`);
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: url.href });
  const wait = (ms) => page.evaluate(`${GAME}.stepFrames(${Math.max(1, Math.ceil(ms / 100))})`);
  const until = async (expression, what = expression, tries = 400) => {
    for (let i = 0; i < tries; i += 1) {
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
  const inWorld = `${GAME}.scene.isActive('world')`;
  const inBattle = `${GAME}.scene.isActive('battle')`;
  const dialog = () => page.evaluate(`${W}.dialogBox.visible ? ${W}.dialogBox.textObject?.text ?? '' : null`);
  const busy = () => page.evaluate(`(() => { const w = ${W}; return Boolean(w.pendingTrainerBattle || w.cutscene || w.isWarping || w.targetTile); })()`);

  const pack = list('pack');
  await deploy(page, url.href, {
    press,
    click,
    until,
    wait,
    paused: true,
    insertion: 'greystone-vale-moor-top',
    starter: 'Charmander',
    level: Number(option('level') ?? 13),
    team: list('team').length > 0 ? list('team') : ['pikachu:13'],
    stash: pack,
    pack,
  });
  await until(inWorld, 'the raid');
  const night = await page.evaluate(`${W}.runSession.plan.night`);
  if (!night) throw new Error('the raid deployed by day: the sheep track stays fogged');

  /** Reads on, and plays any fight the walk walked into on its first move. */
  const clear = async () => {
    for (let i = 0; i < 400; i += 1) {
      if (await page.evaluate(inBattle)) {
        const b = await page.evaluate(`(() => { const b = ${B}; return { mode: b.mode, outcome: b.state?.outcome }; })()`);
        await press('Space');
        await wait(b.mode === 'main' || b.mode === 'moves' ? 300 : 600);
        continue;
      }
      if ((await page.evaluate(inWorld)) && (await dialog()) === null && !(await busy())) return;
      await press('Space');
      await wait(300);
    }
    throw new Error('stuck reading on');
  };
  await clear();
  const walk = async (goal) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const keys = await page.evaluate(routeTo(W, goal));
      if (keys === null) throw new Error(`no way to ${JSON.stringify(goal)}`);
      if (keys.length === 0) return;
      for (const key of keys) {
        await press(key);
        await wait(250);
        if (!(await page.evaluate(inWorld)) || (await dialog()) !== null) break;
      }
      await clear();
    }
    throw new Error(`never reached ${JSON.stringify(goal)}`);
  };
  await walk(CHURCHYARD);
  // A second for the raid's walk to be written down where it stands.
  await wait(1500);
  const where = await page.evaluate(`(() => { const w = ${W}; return { tile: w.currentTile, clockMs: w.elapsedMs, party: w.party.pokemon.map((p) => p.name + ' L' + p.level + ' ' + p.currentHp + '/' + p.maxHp + (p.primaryStatus ? ' ' + p.primaryStatus : '')) }; })()`);
  const storage = await page.evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))`);
  writeFileSync(out, storage);
  console.log(`stood at ${JSON.stringify(where)}; wrote ${Object.keys(JSON.parse(storage)).length} keys to ${out}`);
} finally {
  await browser.close();
}
