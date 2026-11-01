// A brand new save from the title screen to the moment the first raid is the
// player's, played the way somebody who does not read plays it: SPACE on anything
// that asks, the key that goes where they can see they want to go, and nothing else.
//
//   node tools/playtest/firstRaid.mjs <url> <out-dir> [--port=N] [--window=1200x768] [--shots]
//
// It presses real keys into the real scene on stepped 60fps frames, so the seconds
// it reports are game seconds, with a quarter of a second of a person's reaction
// charged before each press. Every line is what happened: the time, the presses so
// far, and what changed on the screen. At the end it prints the barriers in order and
// the totals, and writes them to `<out>/first-raid.json`. Run it on a test-mode build
// (`tools/playtest/README.md`). Exit code 1 is a raid never reached.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'first-raid-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const [windowWidth, windowHeight] = (option('window') ?? `${PIXEL_WINDOW.width}x${PIXEL_WINDOW.height}`).split('x').map(Number);
const window = { width: windowWidth, height: windowHeight };
const shots = args.includes('--shots');
const address = url;
const FRAME_MS = 1000 / 60;
const REACTION_MS = 250;
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const browser = option('port') ? attachBrowser(Number(option('port')), { window }) : await launchBrowser({ window });
let failed = false;
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`localStorage.clear()`);
  await page.send('Page.navigate', { url: address });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`${GAME}.pauseLoop()`);

  let clockMs = 0;
  let presses = 0;
  let shotNumber = 0;
  const log = [];
  let stageStart = { clockMs: 0, presses: 0 };
  const stages = [];
  const frames = async (count) => {
    clockMs += count * FRAME_MS;
    await page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  };
  const wait = (ms) => frames(Math.max(1, Math.round(ms / FRAME_MS)));
  const stamp = () => `${(clockMs / 1000).toFixed(1).padStart(6)}s ${String(presses).padStart(3)} presses`;
  const say = (what) => {
    log.push({ seconds: Number((clockMs / 1000).toFixed(1)), presses, what });
    console.log(`${stamp()}  ${what}`);
  };
  const shot = async (name) => {
    if (shots) {
      shotNumber += 1;
      await page.screenshot(`${out}/${String(shotNumber).padStart(2, '0')}-${name}.png`);
    }
  };
  /** A named stretch of the way in, with what it cost. */
  const stage = (name) => {
    stages.push({
      name,
      seconds: Number(((clockMs - stageStart.clockMs) / 1000).toFixed(1)),
      presses: presses - stageStart.presses,
    });
    stageStart = { clockMs, presses };
    say(`-- ${name}`);
  };
  const tap = async (code) => {
    await wait(REACTION_MS);
    presses += 1;
    await page.keyDown(code);
    await frames(2);
    await page.keyUp(code);
    await frames(2);
  };
  const base = (expression) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${expression}; })()`);
  const active = (key) => page.evaluate(sceneIs(key));
  const boxUp = () => base(`b.sys.isActive() && b.dialogBox?.visible === true`);
  const boxLine = () => base(`b.dialogBox?.textObject?.text ?? ''`);

  /** Presses through whatever the room's box is saying, as somebody who is not reading it does. */
  const mash = async (why) => {
    let boxes = 0;
    let lastLine = null;
    for (let guard = 0; guard < 80 && (await boxUp()); guard += 1) {
      if (await base(`Boolean(b.boxQuestion)`)) {
        return boxes;
      }
      const line = await boxLine();
      if (line.slice(0, 12) !== lastLine?.slice(0, 12)) {
        boxes += 1;
        lastLine = line;
        say(`${why} says: ${line.replaceAll('\n', ' ')}`);
      }
      await tap('Space');
    }
    return boxes;
  };

  /** A walk from where the player stands to the first of some tiles, a held key to a straight run. */
  const walk = async (goalsExpression, what) => {
    const route = await base(`(() => { const goals = ${goalsExpression};
      const c = b.collision, H = c.length, W = c[0].length, s = b.currentTile, id = (x, y) => y * W + x;
      const at = (x, y) => goals.some((g) => g.x === x && g.y === y);
      const prev = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]]; let found = null;
      while (queue.length) { const [x, y] = queue.shift(); if (at(x, y)) { found = [x, y]; break; }
        for (const [dx, dy, k] of (Math.abs(goals[0].x - s.x) > Math.abs(goals[0].y - s.y) ? [[-1,0,'left'],[1,0,'right'],[0,-1,'up'],[0,1,'down']] : [[0,-1,'up'],[0,1,'down'],[-1,0,'left'],[1,0,'right']])) { const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(id(nx, ny))) continue;
          if (!at(nx, ny) && b.isBlocked({ x: nx, y: ny })) continue;
          prev.set(id(nx, ny), [x, y, k]); queue.push([nx, ny]); } }
      if (!found) return null; const steps = []; let cur = found;
      for (;;) { const p = prev.get(id(cur[0], cur[1])); if (!p) break; steps.unshift(p[2]); cur = [p[0], p[1]]; }
      return steps; })()`);
    if (!route) {
      throw new Error(`nothing walks to ${what}`);
    }
    const runs = [];
    for (const step of route) {
      if (runs.at(-1)?.direction === step) {
        runs.at(-1).tiles += 1;
      } else {
        runs.push({ direction: step, tiles: 1 });
      }
    }
    say(`walks to ${what}: ${route.length} tiles, ${runs.length} key${runs.length === 1 ? '' : 's'}`);
    for (const run of runs) {
      await wait(REACTION_MS);
      presses += 1;
      const from = await base(`({ ...b.currentTile })`);
      await page.keyDown(KEY[run.direction]);
      for (let guard = 0; guard < 2000; guard += 1) {
        await frames(1);
        const at = await base(`({ ...b.currentTile, moving: Boolean(b.targetTile), gone: !b.sys.isActive() || b.leaving === true })`);
        const walked = Math.abs(at.x - from.x) + Math.abs(at.y - from.y);
        if (at.gone || walked >= run.tiles || (walked === run.tiles - 1 && at.moving)) {
          break;
        }
      }
      await page.keyUp(KEY[run.direction]);
      for (let guard = 0; guard < 40 && (await base(`Boolean(b.targetTile) && b.sys.isActive()`)); guard += 1) {
        await frames(1);
      }
    }
  };

  const settleInto = async (key, what) => {
    for (let guard = 0; guard < 900 && !(await active(key)); guard += 1) {
      await wait(100);
    }
    if (!(await active(key))) {
      throw new Error(`never reached ${what}`);
    }
  };

  await shot('title');
  say('the title');
  await tap('Space');
  await settleInto('base', 'the lab');
  await wait(600);
  stage('Title to the lab');
  await shot('lab');
  await mash('Oak');
  const hereTile = await base(`({ ...b.currentTile, choosing: b.choosing })`);
  say(`stands at ${hereTile.x},${hereTile.y}`);
  // The ball in front of them, as anybody walks up to the middle of a table.
  await tap('ArrowUp');
  await wait(300);
  for (let guard = 0; guard < 8 && (await base(`b.currentTile.y > 6`)); guard += 1) {
    await tap('ArrowUp');
    await wait(300);
  }
  await shot('at-the-ball');
  await tap('Space');
  await wait(400);
  await shot('asked');
  say(`asked: ${await boxLine()}`);
  for (let guard = 0; guard < 12 && !(await base(`Boolean(b.boxQuestion)`)); guard += 1) {
    await tap('Space');
    await wait(300);
  }
  // Somebody who does not read presses on. If that was NOT NOW they are back where
  // they started, and try again, this time across to the other answer.
  await tap('Space');
  await wait(300);
  if (await base(`b.choosing === true && !b.leaving`)) {
    say('that press said NOT NOW, so back round, and across to YES');
    await tap('Space');
    await wait(300);
    await tap('ArrowLeft');
    await tap('Space');
  }
  await wait(500);
  for (let guard = 0; guard < 300 && !(await base(`b.sys.isActive() && b.ready`)); guard += 1) {
    await wait(100);
  }
  await wait(400);
  stage('Choosing a partner');
  await shot('chosen');
  await mash('Oak');
  await wait(200);
  stage('Oak after the choice');
  await shot('oak-done');

  // Out of the lab, across the yard, in at the Arena's door.
  for (let guard = 0; guard < 40 && !(await base(`b.sys.isActive() && b.ready && !b.leaving`)); guard += 1) {
    await wait(100);
  }
  const inRoom = await base(`b.room?.id ?? null`);
  if (inRoom) {
    await walk(`[b.room.mat]`, 'the lab door');
    await tap('ArrowDown');
    await settleInto('base', 'the yard');
    for (let guard = 0; guard < 200 && (await base(`b.room !== null && b.room !== undefined || !b.ready`)); guard += 1) {
      await wait(100);
    }
    await wait(300);
  }
  await shot('yard');
  await mash('The yard');
  await walk(`b.doors.find((door) => door.id === 'raid-arena').tiles`, 'the Raid Arena door');
  for (let guard = 0; guard < 100 && !(await active('arenaIntro')) && !(await base(`b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'`)); guard += 1) {
    await wait(100);
  }
  stage('The yard, to the Arena door');

  if (await active('arenaIntro')) {
    await wait(1500);
    await shot('trailer');
    say('the trailer is playing');
    for (let guard = 0; guard < 400 && (await active('arenaIntro')); guard += 1) {
      await tap('Space');
      await wait(400);
    }
  }
  for (let guard = 0; guard < 200 && !(await base(`b.sys.isActive() && b.ready && b.room?.id === 'raid-arena'`)); guard += 1) {
    await wait(100);
  }
  await wait(500);
  stage('The door and the trailer');
  await shot('hall-from-the-door');
  await mash('The hall');

  // Up the runner, and press at whatever stops them at the fence.
  await walk(`b.arenaRim.filter((tile) => tile.x === b.currentTile.x)`, 'the fence, straight ahead');
  await wait(200);
  stage('The door to the rail');
  await shot('at-the-rail');
  await tap('Space');
  const jumping = `Boolean(${GAME}.scene.getScene('base')?.jump)`;
  if (!(await page.evaluate(jumping))) {
    await wait(300);
    await shot('looking-down');
    await mash('The rail');
    for (let guard = 0; guard < 60 && !(await active('hub')); guard += 1) {
      await wait(100);
    }
    await wait(400);
    await shot('the-card');
    const card = await page.evaluate(`document.querySelector('#screens .pixel-ui')?.innerText ?? ''`);
    say(`the card: ${card.replace(/\s+/g, ' ').trim().slice(0, 300)}`);
    await tap('Space');
  }
  stage('Looking down, the words and the card');
  // Everything from here is the game's own, and nobody has to do anything.
  const jumpShots = new Set();
  const seen = new Set();
  for (let guard = 0; guard < 900 && !(await active('world')); guard += 1) {
    await wait(50);
    const moment = await base(`b.jump ? (b.jump.breath && b.jump.breath.elapsedMs < b.jump.breath.ms ? 'breath' : b.jump.dive?.diving ? 'dive' : b.jump.elapsedMs < 640 ? 'hop' : 'fall') : 'none'`);
    if (!seen.has(moment)) {
      seen.add(moment);
      say(`the jump: ${moment}`);
    }
    const key = `${moment}-${Math.floor(clockMs / 400)}`;
    if (shots && !jumpShots.has(key) && jumpShots.size < 14) {
      jumpShots.add(key);
      await shot(`jump-${moment}`);
    }
  }
  stage('The jump');
  for (let guard = 0; guard < 300 && (await page.evaluate(`Boolean(${GAME}.scene.getScene('world')?.arrival)`)); guard += 1) {
    await wait(50);
    if (shots && guard % 8 === 0) {
      await shot('landing');
    }
  }
  stage('The landing');
  await shot('landed');
  const world = (expression) => page.evaluate(`(() => { const w = ${GAME}.scene.getScene('world'); return ${expression}; })()`);
  for (let guard = 0; guard < 60 && (await world(`w.dialogBox?.visible === true`)); guard += 1) {
    say(`the raid says: ${String(await world(`w.dialogBox?.textObject?.text ?? ''`)).replaceAll('\n', ' ')}`);
    await tap('Space');
  }
  await wait(300);
  await shot('the-raid-is-yours');
  stage('The raid opens');
  const total = { seconds: Number((clockMs / 1000).toFixed(1)), presses };
  console.log('\nBarriers, in order:');
  for (const each of stages) {
    console.log(`  ${each.name.padEnd(38)} ${String(each.seconds).padStart(6)}s  ${String(each.presses).padStart(3)} presses`);
  }
  console.log(`  ${'Title to walking in the raid'.padEnd(38)} ${String(total.seconds).padStart(6)}s  ${String(total.presses).padStart(3)} presses`);
  const fromArenaDoor = stages.filter((each) => !['Title to the lab', 'Choosing a partner', 'Oak after the choice', 'The yard, to the Arena door'].includes(each.name));
  console.log(`  ${'Arena door to walking in the raid'.padEnd(38)} ${fromArenaDoor.reduce((sum, each) => sum + each.seconds, 0).toFixed(1).padStart(6)}s  ${String(fromArenaDoor.reduce((sum, each) => sum + each.presses, 0)).padStart(3)} presses`);
  writeFileSync(`${out}/first-raid.json`, JSON.stringify({ total, stages, log }, null, 2));
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
