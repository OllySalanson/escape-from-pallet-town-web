// Misty, then Fuchsia Gym in the same raid, then the Coast's rain - two
// findings of the gyms playtest of 14 Nov 2026, played through real keys
// (`docs/screens/gyms-same-raid-rain/`).
//
//   node tools/playtest/gymsSameRaid.mjs <test-mode build url> <out dir>
//
// LEVEL=16 MISTY_ONLY=1 fights Misty with a starter she can make it rain on
// (at the default level 40 Staryu falls before Rain Dance) and stops there.
// Exit code 1 is anything not where it should be.
import { mkdirSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, deploy } from './deploy.mjs';
import { routeTo } from './route.mjs';

const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const W = `${GAME}.scene.getScene('world')`;
const B = `${GAME}.scene.getScene('battle')`;
const faults = [];
const check = (what, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) faults.push(what); };

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
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
  const press = async (code) => { await page.keyDown(code); await wait(60); await page.keyUp(code); };
  const click = async (text) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
      `button "${text}"`,
    );
    await wait(350);
  };
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const inWorld = `${GAME}.scene.isActive('world')`;
  const inBattle = `${GAME}.scene.isActive('battle')`;
  const dialog = () => page.evaluate(`${W}.dialogBox.visible ? ${W}.dialogBox.textObject?.text ?? '' : null`);
  const busy = () => page.evaluate(`(() => { const w = ${W}; return Boolean(w.pendingTrainerBattle || w.cutscene || w.isWarping || w.targetTile); })()`);

  await deploy(page, url.href, { press, click, until, wait, paused: true, insertion: 'greystone-vale-the-strand', level: Number(process.env.LEVEL ?? 40) });
  await until(inWorld, 'the raid');
  await wait(800);
  const clear = async () => {
    for (let i = 0; i < 30; i += 1) {
      if ((await dialog()) === null && !(await busy())) return;
      await press('Space');
      await wait(300);
    }
  };
  await clear();

  /** Walks the grid to `goal`, ending facing into it when it is a figure or a wall. */
  const walk = async (goal) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const keys = await page.evaluate(routeTo(W, goal));
      if (keys === null) throw new Error(`no way to ${JSON.stringify(goal)}`);
      if (keys.length === 0) return;
      for (const key of keys) {
        await press(key);
        await wait(250);
        if (!(await page.evaluate(inWorld))) return;
        if ((await dialog()) !== null) break;
      }
      await clear();
    }
  };
  const face = async (key) => { await press(key); await wait(200); };
  /** The door warp into the room named `name`. */
  const doorInto = (name) => page.evaluate(`(() => { const w = ${W}; const a = (w.currentMap.areas ?? []).find((p) => p.name === ${JSON.stringify(name)});
    const d = w.currentMap.warps.find((p) => p.activation === 'push' && p.toward === 'up' && p.destination.x >= a.rect.x && p.destination.x < a.rect.x + a.rect.width && p.destination.y >= a.rect.y && p.destination.y < a.rect.y + a.rect.height);
    return { source: d.source, rect: a.rect }; })()`);
  const goIn = async (name) => {
    const door = await doorInto(name);
    await walk({ x: door.source.x, y: door.source.y + 1 });
    await face('ArrowUp');
    await wait(200);
    await press('ArrowUp');
    await wait(1500);
    await clear();
    const tile = await page.evaluate(`${W}.currentTile`);
    check(`walked into ${name} (${JSON.stringify(tile)})`, tile.x >= door.rect.x && tile.x < door.rect.x + door.rect.width && tile.y >= door.rect.y && tile.y < door.rect.y + door.rect.height);
  };
  const boss = (id) => page.evaluate(`${W}.trainersForCurrentMap().find((t) => t.bossId === ${JSON.stringify(id)})?.position ?? null`);
  const guide = () => page.evaluate(`(() => { const w = ${W}; const t = w.currentTile; return w.currentMap.entities.filter((e) => e.design === 'gym-guide').sort((a, b) => Math.hypot(a.position.x - t.x, a.position.y - t.y) - Math.hypot(b.position.x - t.x, b.position.y - t.y))[0].position; })()`);
  /** Talks to the figure at `at`, from the tile on its left, and reads every line, photographing the first. */
  const talkTo = async (at, name) => {
    await walk({ x: at.x - 1, y: at.y });
    await face('ArrowRight');
    await press('Space');
    await wait(1200);
    const lines = [];
    for (let i = 0; i < 12; i += 1) {
      const line = await dialog();
      if (line === null) break;
      await wait(1500);
      const full = await dialog();
      if (i === 0) await shot(name);
      lines.push((full ?? line).replace(/\s+/g, ' '));
      await press('Space');
      await wait(400);
    }
    return lines;
  };
  /** Fights the boss stood at `at` from the tile below, mashing the first move, photographing rain. */
  const fight = async (at, name) => {
    await walk({ x: at.x, y: at.y + 1 });
    await face('ArrowUp');
    for (let i = 0; i < 60 && !(await page.evaluate(inBattle)); i += 1) {
      if (await page.evaluate(`Boolean(${W}.trainerPrompt)`)) {
        await press('ArrowUp');
        await wait(150);
        await press('ArrowLeft');
        await wait(150);
      }
      await press('Space');
      await wait(500);
    }
    await until(inBattle, 'the fight', 200);
    let rained = false;
    for (let i = 0; i < 900 && (await page.evaluate(inBattle)); i += 1) {
      if (!rained && (await page.evaluate(`${B}.shownWeather === 'rain' && ${B}.dialog?.isCurrentMessageComplete`))) {
        rained = true;
        await shot(`${name}-rain`);
        check(`${name}: the field shows rain when the fight says so ("${await page.evaluate(`${B}.dialog.textObject?.text`)}")`, await page.evaluate(`${B}.rain?.showing === true`));
      }
      const said = await page.evaluate(`${B}.dialog?.textObject?.text ?? ''`);
      if (/rain/i.test(said)) console.log('   battle:', said.replace(/\s+/g, ' '), '| shown:', await page.evaluate(`${B}.shownWeather`));
      await press('Space');
      await wait(300);
    }
    await until(`${inWorld} || ${GAME}.scene.isActive('extraction')`, 'the world after the fight');
    await wait(800);
    await clear();
    return rained;
  };

  // --- Misty ---------------------------------------------------------------------
  await goIn('Cerulean Gym');
  const misty = await boss('vale-gym-misty');
  check('Misty stands in Cerulean Gym', misty !== null);
  const ceruleanGuide = await guide();
  const before = await talkTo(ceruleanGuide, '01-cerulean-guide-before');
  console.log('  Cerulean guide, before:', before.join(' | '));
  const rained = await fight(misty, '02-misty');
  if (process.env.MISTY_ONLY) { check('Misty made it rain, and the fight showed it', rained); throw new Error('stop: Misty only'); }
  check('Misty made it rain, and the fight showed it', rained);
  check('Misty is beaten', (await page.evaluate(`${W}.defeatedBosses`)).includes('vale-gym-misty'));
  const after = await talkTo(ceruleanGuide, '03-cerulean-guide-after');
  console.log('  Cerulean guide, after:', after.join(' | '));
  check('Cerulean guide says Misty is beaten', after.join(' ').includes('You beat MISTY'));

  // --- Fuchsia Gym, the same raid -----------------------------------------------------
  // Carried to Tanglewood's road by the scene's own setter (the walk across the
  // vale is not what is being checked): the raid, its wins and its trainers are untouched.
  const door = await doorInto('Fuchsia Gym');
  await page.evaluate(`(() => { const w = ${W}; const off = w.player.y - w.currentTile.y * 16;
    w.currentTile = { x: ${door.source.x}, y: ${door.source.y + 1} }; w.targetTile = null; w.facing = 'up';
    w.setPlayerPosition(${door.source.x} * 16, ${door.source.y + 1} * 16 + off); w.configureCamera(); })()`);
  await wait(800);
  await goIn('Fuchsia Gym');
  const koga = await boss('vale-gym-koga');
  check(`Koga stands at the head of his hall in the same raid (${JSON.stringify(koga)})`, koga !== null);
  await shot('04-fuchsia-koga-there');
  const kogaGuide = await guide();
  const holding = await talkTo(kogaGuide, '05-fuchsia-guide-holding-cascade');
  console.log('  Fuchsia guide, holding CASCADE:', holding.join(' | '));
  check('Fuchsia guide says Koga will fight now', holding.join(' ').includes('KOGA will fight you') && !holding.join(' ').includes('Until then'));
  if (koga) {
    await fight(koga, '06-koga');
    check('Koga is beaten', (await page.evaluate(`${W}.defeatedBosses`)).includes('vale-gym-koga'));
    const done = await talkTo(kogaGuide, '07-fuchsia-guide-after-koga');
    console.log('  Fuchsia guide, after Koga:', done.join(' | '));
    check('Fuchsia guide says Koga is beaten', done.join(' ').includes('You beat KOGA'));
  }

  // --- The Coast's rain, on the map ------------------------------------------------------
  const wet = { x: 172, y: 265 };
  await page.evaluate(`(() => { const w = ${W}; const off = w.player.y - w.currentTile.y * 16;
    w.currentTile = ${JSON.stringify(wet)}; w.targetTile = null; w.facing = 'down';
    w.setPlayerPosition(${wet.x} * 16, ${wet.y} * 16 + off); w.configureCamera(); })()`);
  check(`172,265 rains (${await page.evaluate(`${W}.currentWeather()`)})`, (await page.evaluate(`${W}.currentWeather()`)) === 'rain');
  await wait(1500);
  check('the rain falls on the map in a place that rains', await page.evaluate(`${W}.rain?.showing === true`));
  await shot('08-coast-rain-on-the-map');
} finally {
  await browser.close();
  console.log(faults.length ? `\n${faults.length} FAULTS` : '\nall ok');
  process.exitCode = faults.length ? 1 : 0;
}
