// A raid survives the page it is played in (`src/game/run/raidResume.ts`), end
// to end: deploy, then go away at the awkward moments and come back.
//
//   node tools/playtest/raidResume.mjs http://localhost:5173/ [--shot=dir]
//
// 1. Reload mid-walk: CONTINUE puts the player back on the tile they left, with
//    the clock where it was and the pack, the team and the raid all still out.
// 2. Reload mid-fight, after a turn: the same fight, the other side as that
//    turn left it - never the tile before it, and never the turn again.
// 3. Reload after the turn that lost the fight: the wipe it was.
// 4. A second tab while the first is still in its raid: nothing taken up.
// 5. A reload taken up twice in a row still holds.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase, jumpIn } from './deploy.mjs';

const base = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: raidResume.mjs <dev server url> [--shot=dir]');
}
const shots = process.argv.find((arg) => arg.startsWith('--shot='))?.slice('--shot='.length);
const url = new URL(base);
url.searchParams.set('testmode', shots ? 'pixels' : '1');

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`);
  failures += ok ? 0 : 1;
};
const save = (page) => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
const world = `${GAME}.scene.getScene('world')`;
const battle = `${GAME}.scene.getScene('battle')`;
const where = (page) =>
  page.evaluate(`(() => { const w = ${world}; return { tile: { ...w.currentTile }, map: w.currentMap.id, facing: w.facing,
    remainingMs: w.runSession.manager.snapshot().remainingMs, raidId: w.runSession.raidId,
    bag: w.bag.toJSON(), hp: w.party.pokemon.map((p) => p.currentHp), steps: w.runSession.stepsTaken ?? 0 }; })()`);

async function newGame(page) {
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear()`);
  await page.send('Page.reload', {});
  await sleep(1500);
  await page.waitFor(sceneIs('title'));
  await page.tap('Space', 60);
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await page.waitFor(sceneIs('base'));
}

async function deployFrom(page) {
  await walkIntoBase(page, 'raid-arena');
  await page.waitFor(takePokemon('Charmander'), { what: 'Charmander in the raid party' });
  await jumpIn(page, { until: (expression, what) => page.waitFor(expression, { what }) });
  await page.waitFor(sceneIs('world'));
  await page.waitFor(`${world}.raidWritten === true`, { what: 'the raid written down' });
}

/** Reloads, and presses CONTINUE on the title. */
async function reloadAndContinue(page) {
  await page.send('Page.reload', {});
  await sleep(1500);
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.tap('Space', 60);
}

/** Reads whatever the world's box says, through to its end. */
async function readWorldBox(page) {
  const lines = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const line = await page.evaluate(`(() => { const box = ${world}.dialogBox; return box?.visible ? box.list?.filter((c) => c.type === 'Text').map((c) => c.text).join(' ') ?? 'visible' : ''; })()`);
    if (!line) break;
    lines.push(line);
    await page.tap('Space', 60);
    await sleep(300);
  }
  return lines;
}

/** Presses through a fight's lines until it asks for a command. */
async function untilCommands(page) {
  for (let guard = 0; guard < 60; guard += 1) {
    if (await page.evaluate(`${battle}.mode === 'main'`)) return true;
    await page.tap('Space', 60);
    await sleep(250);
  }
  return false;
}

/** FIGHT, then the first move: one turn. */
async function fightOneTurn(page) {
  for (let guard = 0; guard < 40; guard += 1) {
    const b = await page.evaluate(`(() => { const b = ${battle}; return { mode: b.mode, selected: b.commandTexts?.[b.selectedCommand]?.text ?? '' }; })()`);
    if (b.mode === 'events' && guard > 0) return;
    if (b.mode === 'main' && !b.selected.includes('FIGHT')) {
      await page.tap(guard % 2 === 0 ? 'ArrowLeft' : 'ArrowUp', 60);
      await sleep(200);
      continue;
    }
    await page.tap('Space', 60);
    await sleep(300);
  }
  throw new Error('the turn never resolved');
}

const said = (page) => page.evaluate(`${battle}.dialog?.textObject?.text ?? ''`);

const startWildFight = (page, speciesId, level) =>
  page.evaluate(`void ${world}.transitionToBattle({ wild: { speciesId: ${JSON.stringify(speciesId)}, level: ${level} }, teachingBattle: false })`);

const browser = await launchBrowser({ window: shots ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  const tab = await browser.openPage(url.href);
  await newGame(tab);
  const before = await save(tab);
  await deployFrom(tab);

  // 1. Reload mid-walk, once the landing's words are read.
  await readWorldBox(tab);
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowDown']) {
    await tab.tap(key, 120);
    await sleep(350);
  }
  await sleep(1300);
  const left = await where(tab);
  const raidBefore = (await save(tab)).raidInFlight;
  await reloadAndContinue(tab);
  await tab.waitFor(sceneIs('world'), { what: 'the raid taken up', timeoutMs: 60_000 });
  const back = await where(tab);
  if (shots) {
    await sleep(2500);
    await tab.screenshot(`${shots}/resume-walk.png`);
  }
  const box = await readWorldBox(tab);
  console.log(`  left at ${JSON.stringify(left.tile)} ${left.remainingMs}ms, back at ${JSON.stringify(back.tile)} ${back.remainingMs}ms; it says: ${box.join(' | ')}`);
  check(back.map === left.map && back.tile.x === left.tile.x && back.tile.y === left.tile.y, 'a reload mid-walk puts the player back on the tile they left');
  check(Math.abs(back.remainingMs - left.remainingMs) <= 1500, 'with the clock where it was');
  check(JSON.stringify(back.bag) === JSON.stringify(left.bag), `and the pack as it was (${JSON.stringify(back.bag)})`);
  check(box.some((line) => line.includes('Back where you left off')), 'and says so');
  let after = await save(tab);
  check(Boolean(after.raidInFlight) && after.raidInFlight.id !== raidBefore.id, `the raid is still out, under a new id (${raidBefore.id} -> ${after.raidInFlight?.id})`);
  check(back.raidId === after.raidInFlight?.id, 'which is the id the page plays it under');
  check((after.stash.items['raid-pack'] ?? 0) === (before.stash.items['raid-pack'] ?? 0), 'and nothing was settled: the pack is not lost');

  // 5. Taken up twice in a row.
  await reloadAndContinue(tab);
  await tab.waitFor(sceneIs('world'), { what: 'the raid taken up again', timeoutMs: 60_000 });
  const again = await where(tab);
  await readWorldBox(tab);
  check(again.tile.x === left.tile.x && again.tile.y === left.tile.y, 'a second reload takes it up again on the same tile');

  // 2. Reload mid-fight, after a turn.
  await startWildFight(tab, 'caterpie', 3);
  await tab.waitFor(sceneIs('battle'), { what: 'the fight' });
  check(await untilCommands(tab), 'the fight asks for a command');
  await fightOneTurn(tab);
  const foeAfterTurn = await tab.evaluate(`${battle}.state.enemy.currentHp`);
  const usAfterTurn = await tab.evaluate(`${battle}.state.player.currentHp`);
  const ppAfterTurn = await tab.evaluate(`${battle}.party.pokemon[0].moves[0].pp`);
  await reloadAndContinue(tab);
  await tab.waitFor(sceneIs('battle'), { what: 'the fight taken up', timeoutMs: 60_000 });
  const foeBack = await tab.evaluate(`${battle}.state.enemy.currentHp`);
  const usBack = await tab.evaluate(`${battle}.state.player.currentHp`);
  const ppBack = await tab.evaluate(`${battle}.party.pokemon[0].moves[0].pp`);
  await sleep(1500);
  const firstLine = await said(tab);
  console.log(`  after the turn: foe ${foeAfterTurn}, us ${usAfterTurn}, pp ${ppAfterTurn}; taken up: foe ${foeBack}, us ${usBack}, pp ${ppBack}; first line: ${firstLine}`);
  if (shots) await tab.screenshot(`${shots}/resume-fight.png`);
  check(foeBack === foeAfterTurn && usBack === usAfterTurn && ppBack === ppAfterTurn, 'a reload mid-fight is the same fight, as the last turn left it');
  check(await untilCommands(tab), 'and it can be fought on');
  // Fight it out, then the world it hands back to.
  for (let turn = 0; turn < 20 && (await tab.evaluate(sceneIs('battle'))); turn += 1) {
    if (await tab.evaluate(`${battle}.mode === 'main'`)) {
      await fightOneTurn(tab);
    }
    await tab.tap('Space', 60);
    await sleep(300);
  }
  await tab.waitFor(sceneIs('world'), { what: 'the world after the fight', timeoutMs: 60_000 });
  await readWorldBox(tab);
  const afterFight = await where(tab);
  check(afterFight.tile.x === left.tile.x && afterFight.tile.y === left.tile.y, 'the fight hands back to the tile it started on');

  // 2b. A trainer's foe knocked out stays knocked out, and its experience is paid once.
  await tab.evaluate(`(() => { const p = ${world}.party.pokemon[0]; p.gainExperience(60000, { evolve: false }); p.currentHp = p.maxHp; p.pendingMoves.length = 0; })()`);
  const trainerName = await tab.evaluate(`(() => { const w = ${world}; const t = w.trainerEncounters.find((e) => !w.defeatedTrainerIds.has(e.trainer.id) && e.trainer.party.length > 1 && (e.trainer.unitCount ?? 1) === 1); if (!t) return null; void w.transitionToBattle({ trainer: t.trainer }); return t.trainer.name; })()`);
  if (trainerName) {
    await tab.waitFor(sceneIs('battle'), { what: 'the trainer fight' });
    check(await untilCommands(tab), `${trainerName}'s fight asks for a command`);
    const firstFoe = await tab.evaluate(`${battle}.state.enemy.pokemon.name`);
    for (let turn = 0; turn < 6 && (await tab.evaluate(`${battle}.state.enemy.currentHp > 0 && ${battle}.state.enemy.pokemon.name === ${JSON.stringify(firstFoe)}`)); turn += 1) {
      if (turn > 0) await untilCommands(tab);
      await fightOneTurn(tab);
    }
    check(await untilCommands(tab), 'the next foe is out');
    const expAfterKo = await tab.evaluate(`${battle}.party.pokemon[0].experience`);
    const foesAfterKo = await tab.evaluate(`${battle}.trainer.party.map((p) => p.name + ':' + (p === ${battle}.state.enemy.pokemon ? ${battle}.state.enemy.currentHp : 'off'))`);
    await reloadAndContinue(tab);
    await tab.waitFor(sceneIs('battle'), { what: 'the trainer fight taken up', timeoutMs: 60_000 });
    await sleep(1000);
    const expBack = await tab.evaluate(`${battle}.party.pokemon[0].experience`);
    const facing = await tab.evaluate(`${battle}.state.enemy`).catch(() => null);
    const foesBack = await tab.evaluate(`${battle}.trainer.party.map((p) => p.name + ':' + p.currentHp)`);
    const facingHp = await tab.evaluate(`${battle}.state.enemy.currentHp`);
    console.log(`  after the knock-out: ${foesAfterKo.join(' ')}, exp ${expAfterKo}; taken up: ${foesBack.join(' ')}, facing hp ${facingHp}, exp ${expBack}`);
    void facing;
    check(expBack === expAfterKo, 'the knock-out\'s experience is kept, not paid again');
    check(foesBack.some((each) => each.endsWith(':0')) && facingHp > 0, 'and the foe it knocked out stays down');
    // Fought out, back to the world.
    for (let turn = 0; turn < 30 && (await tab.evaluate(sceneIs('battle'))); turn += 1) {
      if (await tab.evaluate(`${battle}.mode === 'main'`)) await fightOneTurn(tab);
      await tab.tap('Space', 60);
      await sleep(300);
    }
    await tab.waitFor(sceneIs('world'), { what: 'the world after the trainer', timeoutMs: 60_000 });
    await readWorldBox(tab);
  } else {
    console.log('  (no trainer on the map to try)');
  }

  // 2d. A standing Pokemon's fight, promised behind its cry, is that fight after a reload.
  const met = await tab.evaluate(`(() => { const w = ${world}; const e = (w.currentMap.entities ?? []).find((each) => each.pokemon && !(w.runSession.pokemonMet ?? []).includes(each.id)); if (!e) return null; w.meetPokemon(e, e.pokemon, e.wildLevel ?? 5); return e.pokemon; })()`);
  if (met) {
    await sleep(1200);
    await reloadAndContinue(tab);
    await tab.waitFor(`${sceneIs('battle')} || ${sceneIs('world')}`, { what: 'the promised fight taken up', timeoutMs: 60_000 });
    await sleep(1000);
    const species = await tab.evaluate(`${sceneIs('battle')} ? ${battle}.state.enemy.pokemon.base.id : null`);
    check(species === met, `a reload while a standing ${met} cries is its fight (${species})`);
    for (let turn = 0; turn < 30 && (await tab.evaluate(sceneIs('battle'))); turn += 1) {
      if (await tab.evaluate(`${battle}.mode === 'main'`)) await fightOneTurn(tab);
      await tab.tap('Space', 60);
      await sleep(300);
    }
    await tab.waitFor(sceneIs('world'), { what: 'the world after the standing Pokemon', timeoutMs: 60_000 });
    await readWorldBox(tab);
  } else {
    console.log('  (no standing Pokemon on the map to try)');
  }

  // 2e. A getaway reloaded while "Got away safely!" is read is a getaway.
  await startWildFight(tab, 'rattata', 2);
  await tab.waitFor(sceneIs('battle'), { what: 'the rattata' });
  await untilCommands(tab);
  for (let guard = 0; guard < 40 && !(await tab.evaluate(`${battle}.pendingBattleExit`)); guard += 1) {
    const b = await tab.evaluate(`(() => { const b = ${battle}; return { mode: b.mode, selected: b.commandTexts?.[b.selectedCommand]?.text ?? '' }; })()`);
    if (b.mode === 'main' && !b.selected.includes('RUN')) {
      await tab.tap(guard % 2 === 0 ? 'ArrowRight' : 'ArrowDown', 60);
    } else {
      await tab.tap('Space', 60);
    }
    await sleep(250);
  }
  await reloadAndContinue(tab);
  await tab.waitFor(`${sceneIs('battle')} || ${sceneIs('world')}`, { what: 'the getaway taken up', timeoutMs: 60_000 });
  await sleep(800);
  check(await tab.evaluate(sceneIs('world')), 'a reload while getting away is the world it got away to');
  await readWorldBox(tab);

  // 2c. A win reloaded before its lines are read is that win, paid once.
  const expOf = () => tab.evaluate(`${world}.party.pokemon[0].experience`);
  const winOnce = async (reload) => {
    const before = await expOf();
    await startWildFight(tab, 'caterpie', 2);
    await tab.waitFor(sceneIs('battle'), { what: 'the caterpie' });
    await untilCommands(tab);
    await fightOneTurn(tab);
    const won = await tab.evaluate(`${battle}.state.outcome`);
    if (reload) {
      await reloadAndContinue(tab);
      await tab.waitFor(`${sceneIs('battle')} || ${sceneIs('world')}`, { what: 'the win taken up', timeoutMs: 60_000 });
      await sleep(1000);
      if (await tab.evaluate(sceneIs('battle'))) {
        console.log(`  the won fight says: ${await said(tab)}`);
        check((await tab.evaluate(`${battle}.state.enemy.currentHp`)) === 0, 'a win taken up does not stand the foe back up');
      }
    }
    for (let guard = 0; guard < 30 && (await tab.evaluate(sceneIs('battle'))); guard += 1) {
      await tab.tap('Space', 60);
      await sleep(300);
    }
    await tab.waitFor(sceneIs('world'), { what: 'the world after the caterpie', timeoutMs: 60_000 });
    await readWorldBox(tab);
    return { won, gained: (await expOf()) - before };
  };
  const plain = await winOnce(false);
  const reloaded = await winOnce(true);
  console.log(`  a win pays ${plain.gained}; reloaded mid-win it paid ${reloaded.gained} (${plain.won}/${reloaded.won})`);
  check(plain.won === 'victory' && reloaded.won === 'victory' && reloaded.gained === plain.gained, 'a win reloaded before its lines is paid exactly once');

  // 3. The turn that lost the fight.
  await tab.evaluate(`(() => { const w = ${world}; for (const p of w.party.pokemon) p.currentHp = 1; })()`);
  await startWildFight(tab, 'mankey', 90);
  await tab.waitFor(sceneIs('battle'), { what: 'the losing fight' });
  check(await untilCommands(tab), 'the losing fight asks for a command');
  // Fought until a turn loses it - a wild Pokemon's first move need not hurt.
  for (let turn = 0; turn < 12 && !(await tab.evaluate(`${battle}.party.isAllFainted()`)); turn += 1) {
    if (turn > 0) check(await untilCommands(tab), `the losing fight asks again (turn ${turn + 1})`);
    await fightOneTurn(tab);
  }
  const lost = await tab.evaluate(`${battle}.party.isAllFainted()`);
  check(lost, 'the turn lost the fight');
  await reloadAndContinue(tab);
  await tab.waitFor(sceneIs('battle'), { what: 'the lost fight taken up', timeoutMs: 60_000 });
  await sleep(1500);
  const lostLine = await said(tab);
  console.log(`  the lost fight says: ${lostLine}`);
  for (let guard = 0; guard < 20 && !(await tab.evaluate(sceneIs('extraction'))); guard += 1) {
    await tab.tap('Space', 60);
    await sleep(400);
  }
  check(await tab.evaluate(sceneIs('extraction')), 'a reload after the losing turn is the wipe it was');
  after = await save(tab);
  check(!after.raidInFlight, 'and the raid is settled');

  // 4. A second tab while the first is in its raid.
  // A wipe took the team, so a new game for the last part.
  await tab.evaluate(`void ${GAME}.scene.getScene('extraction').scene.start('title')`);
  await newGame(tab);
  await deployFrom(tab);
  const second = await browser.openPage(url.href);
  await second.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await second.tap('Space', 60);
  await second.waitFor(sceneIs('base'), { timeoutMs: 60_000 });
  await sleep(800);
  check(!(await second.evaluate(sceneIs('world'))), 'a second tab does not take up a raid the first is playing');
  after = await save(second);
  check(Boolean(after.raidInFlight), 'and leaves it under way');
  await second.close();
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
