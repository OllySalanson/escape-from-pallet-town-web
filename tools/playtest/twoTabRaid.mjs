// A raid out in one tab, and the base open in another on the same save - the
// 9 Nov bug hunts' two-tab sequence, played as a player plays it.
//
//   node tools/playtest/twoTabRaid.mjs <test-mode build url> <out dir> [--port=N] [--window=1200x768]
//
// Tab A starts a new game with a Charmander holding Leftovers and a Pidgey
// Lv 12 beside it, takes both to the Raid Arena's bench and jumps in. Tab B
// opens the same save, walks up the lawn to the DAY-CARE man and chooses the
// Pidgey, then walks into the Pokemon Center and asks BILL'S PC to take the
// Charmander's Leftovers off. Tab A then runs out of clock - the real wipe -
// and the save is read. Photographs each screen and prints what each tab was
// told, so the same run against a build of main and of the fix is the before
// and the after (`docs/screens/two-tab-raid/`).
//
// On the fix it fails loudly if tab B was let near the Pidgey or the
// Leftovers, or if the wipe did not take the Pidgey; `--before` reports what a
// build without the fix does instead of failing on it. --port=N drives a
// browser already running on that CDP port (one from `fm-browser.sh`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:4173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const port = option('port');
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const page = `${url}${url.includes('?') ? '&' : '?'}testmode=pixels`;
const BASE = `${GAME}.scene.getScene('base')`;
// The man's own tile (`DAY_CARE_KEEPER`, `base/dayCarePen.ts`): he is faced from the west.
const DAY_CARE_KEEPER = { x: 45, y: 11 };

const firstStep = (goals) => `(() => { const b = ${BASE}; if (!b.sys.isActive() || !b.ready || b.leaving || b.targetTile) return null;
  const goals = ${JSON.stringify(goals)}; const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, idx = (x, y) => y * W + x;
  const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
  if (at(s.x, s.y)) return 'here';
  const prev = new Map([[idx(s.x, s.y), null]]); const q = [[s.x, s.y]]; let found = null;
  while (q.length) { const [x, y] = q.shift(); if (at(x, y)) { found = [x, y]; break; }
    for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) { const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(idx(nx, ny)) || (!at(nx, ny) && b.isBlocked({ x: nx, y: ny }))) continue;
      prev.set(idx(nx, ny), [x, y, k]); q.push([nx, ny]); } }
  if (!found) return 'unreachable';
  let cur = found, key = null; for (;;) { const p = prev.get(idx(cur[0], cur[1])); if (!p) break; key = p[2]; cur = [p[0], p[1]]; } return key; })()`;

const saved = (tab) => tab.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
const failures = [];
const expect = (ok, what) => {
  if (!ok) failures.push(what);
  console.log(`${ok ? 'ok ' : 'NOT'} ${what}`);
};

const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
try {
  // Tab A: a new game, the Pidgey and the Leftovers written in, as a player who has raided before.
  const tabA = await browser.openPage(page);
  const pressA = async (code) => {
    await tabA.tap(code);
    await sleep(220);
  };
  await tabA.waitFor(sceneIs('title'));
  await tabA.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await tabA.send('Page.navigate', { url: page });
  await tabA.waitFor(sceneIs('title'));
  await pressA('Space');
  await tabA.waitFor(sceneIs('base'));
  await tabA.waitFor(`${BASE}?.takeStarterForDriver?.("charmander") === true`);
  await tabA.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await tabA.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.pokemon[0].pokemon.heldItemId = 'leftovers';
    save.stash.pokemon.push({ id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 12, currentHp: 36, xp: 1728, moves: ['Tackle', 'Gust'], primaryStatus: null } });
    save.raidProgress.firstContractExtracted = true;
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    save.raidProgress.keysLearned = ['walk', 'look'];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await tabA.send('Page.navigate', { url: page });
  await tabA.waitFor(sceneIs('title'));
  await pressA('Space');
  await tabA.waitFor(sceneIs('base'));
  await walkIntoBase(tabA, 'raid-arena', { acceptFavours: false });
  await tabA.waitFor(takePokemon('Charmander'), { what: 'Charmander on the bench' });
  await tabA.waitFor(takePokemon('Pidgey'), { what: 'Pidgey on the bench' });
  await jumpIn(tabA, { until: (expression, what) => tabA.waitFor(expression, { what, timeoutMs: 60_000 }) });
  await tabA.waitFor(sceneIs('world'), { timeoutMs: 60_000 });
  await sleep(1500);
  const deployed = await saved(tabA);
  console.log(`tab A is out on a raid with ${deployed.raidInFlight?.pokemonIds?.join(', ') ?? '(the save does not say who)'}`);

  // Tab B: the same save, the base open while the raid is live in tab A.
  const tabB = await browser.openPage(page);
  await tabB.send('Page.bringToFront');
  const press = async (code) => {
    await tabB.tap(code);
    await sleep(220);
  };
  const walkTo = async (goals) => {
    for (let guard = 0; guard < 200; guard += 1) {
      const key = await tabB.evaluate(firstStep(goals));
      if (key === 'here') return;
      if (key === 'unreachable') throw new Error(`nothing reaches ${JSON.stringify(goals)}`);
      if (key) await press(key);
      else await sleep(150);
    }
    throw new Error(`gave up walking to ${JSON.stringify(goals)}`);
  };
  const boxText = async () => {
    await tabB.waitFor(`${BASE}.dialogBox.isCurrentMessageComplete`, { what: 'the line to finish typing' });
    return tabB.evaluate(`${BASE}.dialogBox.textObject.text.replace(/\\s+/g, ' ').trim()`);
  };
  const status = () => tabB.evaluate(`${GAME}.scene.getScene('hub')?.status ?? ''`);
  await tabB.waitFor(sceneIs('title'));
  await press('Space');
  await tabB.waitFor(sceneIs('base'));
  await tabB.waitFor(`${BASE}.ready && !${BASE}.leaving`, { what: 'the yard' });
  await sleep(600);

  await walkTo([{ x: DAY_CARE_KEEPER.x - 1, y: DAY_CARE_KEEPER.y }]);
  await press('ArrowRight');
  await press('Space');
  await tabB.waitFor(`${BASE}.dialogBox.visible`, { what: 'his words' });
  await boxText();
  await press('Escape');
  await tabB.waitFor(sceneIs('hub'), { what: 'his list' });
  await sleep(1500);
  await tabB.evaluate(`document.querySelector('button[data-shows="pidgey-1"].px-row')?.focus()`);
  await sleep(400);
  await tabB.screenshot(`${out}/1-day-care-list.png`);
  const pidgeyRow = await tabB.evaluate(
    `(() => { const b = document.querySelector('button[data-shows="pidgey-1"].px-row'); return b && { leave: b.hasAttribute('data-day-care-leave'), text: b.textContent.replace(/\\s+/g, ' ').trim(), help: b.dataset.help ?? '' }; })()`,
  );
  console.log(`tab B's Day-Care list, Pidgey's row: ${JSON.stringify(pidgeyRow)}`);
  expect(before || !pidgeyRow.leave, 'the Day-Care Man does not offer to take the Pidgey that is out');
  await tabB.evaluate(`document.querySelector('button[data-shows="pidgey-1"].px-row').click()`);
  await sleep(900);
  if (await tabB.evaluate(sceneIs('hub'))) {
    console.log(`he says: ${await status()}`);
    await tabB.screenshot(`${out}/2-day-care-refuses.png`);
    await press('Escape');
  } else {
    await tabB.waitFor(`${BASE}.ready && ${BASE}.dialogBox.visible`, { what: 'his answer, back in the yard' });
    console.log(`he says: ${await boxText()}`);
    await tabB.screenshot(`${out}/2-day-care-takes.png`);
    await press('Escape');
  }
  await tabB.waitFor(sceneIs('base'), { timeoutMs: 30_000 });
  await tabB.waitFor(`${BASE}.ready && !${BASE}.leaving`, { what: 'the yard again' });
  await sleep(1000);
  const afterDayCare = await saved(tabB);
  expect(before || afterDayCare.stash.dayCare === null || afterDayCare.stash.dayCare === undefined, 'the Day-Care holds nobody');

  // BILL'S PC: the Leftovers on the Charmander that is out.
  await walkIntoBase(tabB, 'pokemon-centre');
  await sleep(1500);
  await tabB.evaluate(`document.querySelector('button[data-shows="charmander-1"].px-row')?.focus()`);
  await sleep(500);
  await tabB.screenshot(`${out}/3-bills-pc.png`);
  const take = await tabB.evaluate(`(() => { const b = document.querySelector('[data-gear-take="charmander-1"]'); if (!b) return false; b.click(); return true; })()`);
  await sleep(700);
  console.log(`Take Leftovers ${take ? 'pressed' : 'not offered'}: ${await status()}`);
  await tabB.screenshot(`${out}/4-bills-pc-take-gear.png`);
  const afterGear = await saved(tabB);
  const charmander = afterGear.stash.pokemon.find((entry) => entry.id === 'charmander-1');
  console.log(`after tab B: Charmander holds ${charmander?.pokemon.heldItemId ?? 'nothing'}; Leftovers in storage: ${afterGear.stash.items.leftovers ?? 0}`);
  expect(before || (charmander?.pokemon.heldItemId === 'leftovers' && !(afterGear.stash.items.leftovers > 0)), 'the Leftovers stay on the Charmander');

  // Tab A: the clock runs out - the real wipe the clock brings.
  await tabA.send('Page.bringToFront');
  await sleep(1000);
  await tabA.evaluate(`${GAME}.scene.getScene('world').resolveExpiredRun()`);
  await tabA.waitFor(sceneIs('extraction'), { timeoutMs: 60_000, what: 'the result screen' });
  await sleep(2500);
  for (let press = 0; press < 12 && !(await tabA.evaluate(`Boolean(document.querySelector('.px-commit, .extraction-footer, [data-commit]'))`)); press += 1) {
    await tabA.tap('Space');
    await sleep(600);
  }
  await sleep(1000);
  await tabA.screenshot(`${out}/5-wipe-result.png`);
  const afterWipe = await saved(tabA);
  const pidgeyLeft = [
    ...afterWipe.stash.pokemon.filter((entry) => entry.id === 'pidgey-1').map(() => 'the vault'),
    ...(afterWipe.stash.dayCare?.id === 'pidgey-1' ? ['the Day-Care'] : []),
  ];
  console.log(`after the wipe: the Pidgey is in ${pidgeyLeft.join(' and ') || 'nowhere - the wipe took it'}`);
  const leftovers = (afterWipe.stash.items.leftovers ?? 0) + afterWipe.stash.pokemon.filter((entry) => entry.pokemon.heldItemId === 'leftovers').length;
  console.log(`Leftovers the save holds: ${leftovers}`);
  expect(before || pidgeyLeft.length === 0, 'the wipe took the Pidgey it said it took');
  expect(afterWipe.raidInFlight === null || afterWipe.raidInFlight === undefined, 'the raid is settled');
  await tabB.close();
  await tabA.close();
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} broken: ${failures.join('; ')}`);
  process.exit(1);
}
