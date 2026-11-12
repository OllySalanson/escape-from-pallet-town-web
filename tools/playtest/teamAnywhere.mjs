// Plays YOUR TEAM and the one box picker end to end (`scenes/TeamScene.ts`,
// `ui/boxPicker.ts`): a new game is given a Rattata and a Mankey in a second
// box and a Pidgey in the first, then:
//
//   - into THE GAME CORNER, whose mat opens POKéMON JUMP: every row names the
//     box its Pokémon lives in, the jumpers first, and FIND narrows the list;
//   - out into the arcade, P opens YOUR TEAM; FIND "box 2" leaves only box 2;
//     the Mankey from box 2 is taken onto the team, which writes the bench;
//   - P closes it, the player walks to THE RAID ARENA, and the hall's bench
//     holds the Mankey;
//   - the Day-Care Man's list names every row's box, those he takes first.
//
//   node tools/playtest/teamAnywhere.mjs <test-mode build url> <out dir> [--port=CDP port] [--window=WxH]
//
// It steps a paused loop, so it wants a test-mode build (`?testmode=pixels`
// for pictures worth judging; `tools/playtest/README.md`, "Memory").
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const FRAME_MS = 1000 / 60;
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`teamAnywhere: ${why}`);
};

const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    await page.screenshot(`${out}/stuck.png`);
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready`;
  const teamUp = `${sceneIs('team')} && Boolean(document.querySelector('#screens .team-menu'))`;
  const shoot = async (name) => page.screenshot(`${out}/${name}.png`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
  const rows = (menu) =>
    page.evaluate(
      `[...document.querySelectorAll('#screens ${menu} [data-find]')].filter((row) => !row.hidden).map((row) => (row.querySelector('.px-name')?.textContent ?? row.getAttribute('aria-label')?.split(',')[0]) + ' | ' + row.dataset.boxName)`,
    );
  const find = async (menu, text) => {
    await page.evaluate(`(() => {
      const field = document.querySelector('#screens ${menu} [data-picker-find]');
      field.focus(); field.value = ${JSON.stringify(text)}; field.dispatchEvent(new Event('input'));
    })()`);
    await wait(200);
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${BASE}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // A Pidgey in box one, a Rattata and a Mankey in a second box.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0].pokemon;
    const add = (id, speciesId, level, moves) => save.stash.pokemon.push({ id, pokemon: { ...partner, speciesId, level, xp: level ** 3, moves, nickname: null } });
    add('pidgey-50', 'pidgey', 9, ['Tackle']);
    add('rattata-51', 'rattata', 7, ['Tackle', 'Tail Whip']);
    add('mankey-52', 'mankey', 11, ['Scratch', 'Leer']);
    save.stash.boxes = [
      { name: 'Box 1', pokemonIds: [save.stash.pokemon[0].id, 'pidgey-50'] },
      { name: 'Box 2', pokemonIds: ['rattata-51', 'mankey-52'] },
    ];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${BASE}.scene.start('base', {})`);
  await until(baseReady, 'the harbour again');
  await press('Escape');
  await wait(300);

  // THE GAME CORNER: its mat opens POKéMON JUMP, which lists every box.
  await walkIntoBase(page, 'game-corner', { press, until, wait, settleMs: 150 });
  await until(`${sceneIs('game-corner')} && Boolean(document.querySelector('#screens .game-corner-screen [data-find]'))`, 'POKéMON JUMP');
  await wait(300);
  const jumpRows = await rows('.game-corner-screen');
  console.log(`jump: ${jumpRows.join(', ')}`);
  if (!jumpRows.some((row) => row.endsWith('| Box 2'))) fail('the jump list names no box 2');
  if (!(await page.evaluate(`document.querySelector('#screens .game-corner-screen')?.textContent.includes('Box 2')`))) {
    fail('box names are not printed on the jump rows');
  }
  await shoot('01-jump-boxes');
  await find('.game-corner-screen', 'rat');
  const ratRows = await rows('.game-corner-screen');
  if (ratRows.length !== 1 || !/RATTATA/i.test(ratRows[0])) fail(`FIND "rat" left ${ratRows.join(', ')}`);
  await shoot('02-jump-find');
  await page.evaluate(`document.querySelector('#screens .game-corner-screen [data-picker-find]')?.blur()`);
  await press('Escape');
  await until(`${baseReady} && !${sceneIs('game-corner')}`, 'the arcade');
  await wait(300);

  // P in the arcade: YOUR TEAM, from every box.
  await press('KeyP');
  await until(teamUp, 'YOUR TEAM in the Game Corner');
  await wait(300);
  await shoot('03-team');
  await find('.team-menu', 'box 2');
  const boxTwo = await rows('.team-menu');
  console.log(`find box 2: ${boxTwo.join(', ')}`);
  if (boxTwo.length !== 2 || !boxTwo.every((row) => row.endsWith('| Box 2'))) fail(`FIND "box 2" left ${boxTwo.join(', ')}`);
  await shoot('04-team-find');
  await page.evaluate(`document.querySelector('#screens .team-menu [data-member="mankey-52"]').click()`);
  await wait(300);
  const team = await page.evaluate(`${GAME}.scene.getScene('team').teamIds`);
  if (!team.includes('mankey-52')) fail(`the Mankey was not taken (team ${team})`);
  const partnerId = (await saved()).stash.partnerId;
  if (team[0] !== partnerId) fail(`the partner does not lead the team the hall would stand (team ${team})`);
  const bench = (await saved()).raidProgress.lastBench ?? [];
  if (!bench.includes('mankey-52')) fail(`the bench was not written (${bench})`);
  await shoot('05-team-taken');
  await page.evaluate(`document.querySelector('#screens .team-menu [data-picker-find]')?.blur()`);
  await press('KeyP');
  await until(`!${sceneIs('team')} && ${baseReady} && !${GAME}.scene.isPaused('base')`, 'the arcade after YOUR TEAM');
  console.log(`team: ${team.join(', ')}`);

  // THE RAID ARENA: the bench holds who was chosen in the arcade.
  await page.evaluate(`void ${BASE}.scene.start('base', {})`);
  await until(baseReady, 'the yard before the hall');
  await press('Escape');
  await wait(300);
  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  const hallBench = await page.evaluate(`${BASE}.kit?.flow.party.map((stored) => stored.id) ?? []`);
  console.log(`hall bench: ${hallBench.join(', ')}`);
  if (!hallBench.includes('mankey-52')) fail('the hall bench does not hold the Mankey');
  await shoot('06-hall-bench');
  await press('Escape');
  await until(`${baseReady} && !${sceneIs('hub')}`, 'the hall with no panel');
  await wait(300);
  await press('KeyP');
  await until(teamUp, 'YOUR TEAM in the hall');
  await wait(300);
  await shoot('07-team-in-hall');
  await press('KeyP');
  await until(`!${sceneIs('team')} && ${baseReady}`, 'the hall again');

  // The Day-Care Man's list: every box, named on each row.
  await page.evaluate(`void ${BASE}.scene.start('hub', { view: 'daycare' })`);
  await until(`${sceneIs('hub')} && Boolean(document.querySelector('#screens .daycare-layout'))`, 'the Day-Care list');
  await wait(300);
  if (!(await page.evaluate(`document.querySelector('#screens .daycare-layout')?.textContent.includes('Box 2')`))) {
    fail('the Day-Care list names no box');
  }
  await shoot('08-day-care');
  console.log('teamAnywhere: every check passed');
} finally {
  await browser.close();
}
