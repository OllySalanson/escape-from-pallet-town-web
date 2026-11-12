// A shiny Pokemon looks like one wherever it walks (`src/game/base/shinyGlint.ts`):
// at the player's heel round THE HARBOUR, out in THE BOLTHOLE's garden, in the
// Day-Care pen, and following on a raid.
//
//   node tools/playtest/shinyAtBase.mjs <test-mode build url> <out dir> [--port=N] [--before] [--no-raid]
//
// A new game, its Charmander made shiny in the save as a caught one is, a shiny
// Pikachu and an ordinary Eevee in the box and a shiny Psyduck left with the
// Day-Care Man. Stepped at exact 60fps frames on a paused loop, so it needs a
// test-mode build (`?testmode=pixels` for a picture worth judging). It fails
// loudly when a shiny one gives off no stars, when an ordinary one gives off
// any, when a star is drawn anywhere but round its own figure, or when two
// figures twinkle in time. `--before` plays the same walk against a build
// from before the stars and only takes the pictures.
import { mkdirSync, writeFileSync } from 'node:fs';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/?testmode=pixels', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const before = args.includes('--before');
const raid = !args.includes('--no-raid');
const FRAME_MS = 1000 / 60;
/** 2x: the 400x256 stage drawn at twice its size. */
const WINDOW = { width: 800, height: 512 };
/** The part of the 2x screen a clip keeps: round the middle, where the camera holds the player. */
const CLIP_CROP = { x: 272, y: 172, width: 256, height: 176 };
mkdirSync(out, { recursive: true });

const fail = (why) => {
  throw new Error(`shinyAtBase: ${why}`);
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
    fail(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const base = `${GAME}.scene.getScene('base')`;
  const world = `${GAME}.scene.getScene('world')`;
  const baseReady = `${sceneIs('base')} && ${base}.ready`;
  const shoot = (name) => page.screenshot(`${out}/${name}.png`);

  /**
   * Every star lit this frame in a scene, by whose it is, with where the
   * figure it belongs to is drawn. `glints` is absent on a build from before.
   */
  const starsOf = (scene) => `(() => { const s = ${scene}; const lit = (g) => (g ? g.images.filter((i) => i && i.visible).map((i) => ({ x: i.x, y: i.y, frame: i.frame.name })) : null);
    const figure = (sprite) => ({ x: sprite.x, y: sprite.y, w: sprite.width, h: sprite.height, ox: sprite.originX, oy: sprite.originY });
    const p = s.partner;
    return {
      partner: p ? { stars: lit(p.glints), visible: p.sprite.visible, figure: figure(p.sprite) } : null,
      garden: (s.garden ? s.garden.figures : []).map((f) => ({ id: f.stored.id, stars: lit(f.glints), figure: figure(f.sprite) })),
      pen: s.penPokemon ? { stars: lit(s.penPokemon.glints), figure: figure(s.penPokemon.sprite) } : null,
    }; })()`;
  /** A star belongs on its own figure's picture: never outside the frame it is drawn from. */
  const expectOn = (who, { stars, figure }) => {
    const left = figure.x - figure.w * figure.ox;
    const top = figure.y - figure.h * figure.oy;
    for (const star of stars) {
      if (star.x < left || star.x > left + figure.w || star.y < top - 4 || star.y > top + figure.h) {
        fail(`${who}: a star at ${star.x},${star.y} is off its figure at ${left},${top} (${figure.w}x${figure.h})`);
      }
    }
  };

  /**
   * Steps `frames` frames, a frame at a time, counting for each figure the
   * frames on which it had stars out, and photographing the first frame on
   * which `shootWhen` says there is something to see.
   */
  const watch = async (scene, frames, shots = {}) => {
    const litFrames = { partner: 0, pen: 0, garden: {}, together: 0 };
    const taken = new Set();
    for (let frame = 0; frame < frames; frame += 1) {
      await step(1);
      if (before) {
        continue;
      }
      const now = await page.evaluate(starsOf(scene));
      const owners = [];
      if (now.partner?.stars?.length) {
        litFrames.partner += 1;
        owners.push('partner');
        expectOn('the partner', now.partner);
      }
      if (now.pen?.stars?.length) {
        litFrames.pen += 1;
        owners.push('pen');
        expectOn('the pen', now.pen);
      }
      for (const one of now.garden) {
        if (one.stars?.length) {
          litFrames.garden[one.id] = (litFrames.garden[one.id] ?? 0) + 1;
          owners.push(one.id);
          expectOn(`the garden's ${one.id}`, one);
        }
      }
      if (owners.length > 1) litFrames.together += 1;
      for (const [name, when] of Object.entries(shots)) {
        if (!taken.has(name) && when(now)) {
          taken.add(name);
          await shoot(name);
        }
      }
    }
    for (const name of Object.keys(shots)) {
      if (!before && !taken.has(name)) fail(`never saw the moment for ${name}.png`);
    }
    return litFrames;
  };

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${base}?.takeStarterForDriver?.("charmander") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');

  // The partner in its other colours, as a shiny caught on a raid is saved
  // (`SavedPokemon.shiny`); a shiny Pikachu and an ordinary Eevee in the box,
  // so both are out in the garden; a shiny Psyduck with the Day-Care Man.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0].pokemon;
    partner.shiny = true;
    const one = (speciesId, level, shiny) => ({ ...partner, speciesId, level, currentHp: 999, xp: level * level * level, moves: ['Tackle'],
      nickname: null, heldItemId: null, primaryStatus: null, ...(shiny ? { shiny: true } : { shiny: undefined }) });
    [['pikachu', 14, true], ['eevee', 12, false]].forEach(([speciesId, level, shiny], index) => {
      const id = speciesId + '-' + (90 + index);
      save.stash.pokemon.push({ id, pokemon: one(speciesId, level, shiny) });
      if (save.stash.boxes?.[0]) save.stash.boxes[0].pokemonIds.push(id);
    });
    save.stash.dayCare = { id: 'psyduck-95', pokemon: one('psyduck', 13, true), leftAfterRaids: 0 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);

  // The yard between the house and the pen: the garden on one side, the fence on the other.
  await page.evaluate(`void ${base}.scene.start('base', { at: { x: 45, y: 13 }, facing: 'down' })`);
  await until(baseReady, 'the yard by the house');
  await press('Escape');

  const seen = await page.evaluate(starsOf(base));
  if (!seen.partner) fail('no partner at heel');
  if (!seen.pen) fail('nobody in the Day-Care pen');
  if (seen.garden.length !== 2) fail(`${seen.garden.length} Pokémon in the garden, not 2`);
  if (!before) {
    if (seen.partner.stars === null) fail('the shiny partner has no stars to give off');
    if (seen.pen.stars === null) fail('the shiny Psyduck in the pen has no stars to give off');
    const byId = Object.fromEntries(seen.garden.map((one) => [one.id, one.stars]));
    if (byId['pikachu-90'] === null) fail('the shiny Pikachu in the garden has no stars to give off');
    if (byId['eevee-91'] !== null) fail('the ordinary Eevee in the garden gives off stars');
  }

  // Two whole rounds, standing still: each shiny one twinkles, none in time with another.
  const allOut = (stars) => (stars?.length ?? 0) === 3;
  const standing = await watch(base, 8 * 60, {
    'yard-partner': (now) => allOut(now.partner.stars),
    'yard-garden': (now) => now.garden.some((one) => allOut(one.stars)),
    'yard-pen': (now) => allOut(now.pen.stars),
  });
  if (before) {
    // The same three moments, as near as a build with no stars has them.
    await shoot('yard-partner');
  } else {
    console.log(`standing 8s: partner lit ${standing.partner} frames, pen ${standing.pen}, garden ${JSON.stringify(standing.garden)}`);
    if (standing.partner < 40 || standing.partner > 140) fail(`the partner was lit ${standing.partner} frames of 480`);
    if (standing.pen < 40 || standing.pen > 140) fail(`the pen was lit ${standing.pen} frames of 480`);
    if (!(standing.garden['pikachu-90'] >= 40)) fail('the garden’s Pikachu never twinkled');
    if (standing.garden['eevee-91']) fail('the garden’s Eevee twinkled');
    if (standing.together > 0) fail(`two figures twinkled in time on ${standing.together} frames`);
  }

  // Walking: the stars go with the partner, step for step, and the walk is a clip.
  const frames = [];
  await page.keyDown('ArrowLeft');
  for (let frame = 0; frame < 150; frame += 1) {
    await step(1);
    if (frame === 90) {
      await page.keyUp('ArrowLeft');
      await page.keyDown('ArrowRight');
    }
    if (!before) {
      const now = await page.evaluate(starsOf(base));
      if (now.partner?.stars?.length && now.partner.visible) expectOn('the partner, walking', now.partner);
    }
    if (frame % 2 === 0) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...CLIP_CROP, scale: 1 } });
      frames.push(Buffer.from(data, 'base64'));
    }
  }
  await page.keyUp('ArrowRight');
  await wait(400);
  writeFileSync(`${out}/clip-walk.png`, animatedPng(frames.map(decodePng)));

  if (raid) {
    // And over the fence: the partner follows on a raid, and is shiny there too.
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await jumpIn(page, { press, until, wait });
    await until(`${world}.partner && ${world}.partner.place.out`, 'the partner out on the raid');
    if (before) {
      await wait(1500);
      await shoot('raid-partner');
    } else {
      const there = await page.evaluate(starsOf(world));
      if (there.partner.stars === null) fail('the shiny partner has no stars to give off on a raid');
      const onRaid = await watch(world, 5 * 60, { 'raid-partner': (now) => allOut(now.partner?.stars) });
      console.log(`raid 5s: partner lit ${onRaid.partner} frames`);
      if (onRaid.partner < 25) fail(`on a raid the partner was lit ${onRaid.partner} frames of 300`);
    }
  }
  console.log(before ? 'pictures taken, nothing asked (--before)' : 'a shiny one twinkles at heel, in the garden, in the pen and on a raid');
} finally {
  await browser.close();
}
