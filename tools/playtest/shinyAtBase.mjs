// A shiny Pokemon looks like one wherever it walks (`src/game/base/shinyGlint.ts`):
// out in THE BOLTHOLE's garden, in the Day-Care pen, and at the player's heel
// on a raid it leads.
//
//   node tools/playtest/shinyAtBase.mjs <test-mode build url> <out dir> [--port=N] [--before] [--no-raid]
//
// A new game with what a few raids could have brought home: a shiny Pikachu,
// a shiny Squirtle and an ordinary Eevee in the box and a shiny Psyduck left
// with the Day-Care Man. The Charmander off Oak's table is ordinary, as every
// starter is, so the one at heel round the harbour gives off nothing; the
// Pikachu then leads a raid, and is the one walking there in its shiny colours
// - the lead walks whatever its kind (`world/raidFollower.ts`). The garden is
// photographed from open ground the yard is asked for, and the driver fails if
// it stands anywhere else. Stepped at exact 60fps frames on a paused loop, so it needs a
// test-mode build (`?testmode=pixels` for a picture worth judging). It fails
// loudly when a shiny one gives off no stars, when an ordinary one gives off
// any, when a star is drawn anywhere but round its own figure, or when two
// figures begin to twinkle together. `--before` plays the same walk against a build
// from before the stars and only takes the pictures.
import { mkdirSync, writeFileSync } from 'node:fs';
import { animatedPng, decodePng } from './apng.mjs';
import { attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

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
  const starsOf = (scene) => `(() => { const s = ${scene}; const lit = (g) => (g ? g.lit.map((star) => ({ ...star })) : null);
    const figure = (sprite) => ({ x: sprite.x, y: sprite.y, w: sprite.width, h: sprite.height, ox: sprite.originX, oy: sprite.originY });
    const p = s.partner;
    return {
      partner: p ? { stars: lit(p.glints), visible: p.sprite.visible, figure: figure(p.sprite) } : null,
      garden: (s.garden ? s.garden.figures : []).map((f) => ({ id: f.stored.id, stars: lit(f.glints), figure: figure(f.sprite) })),
      pen: s.penPokemon ? { stars: lit(s.penPokemon.glints), figure: figure(s.penPokemon.sprite) } : null,
    }; })()`;
  /**
   * A star belongs to its own figure: its middle never outside the frame the
   * figure is drawn from, but for the one over its head, which may stand as
   * much as a tile above a figure that fills its frame to the top.
   */
  const expectOn = (who, { stars, figure }) => {
    const left = figure.x - figure.w * figure.ox;
    const top = figure.y - figure.h * figure.oy;
    for (const star of stars) {
      if (star.x < left || star.x > left + figure.w || star.y < top - 16 || star.y > top + figure.h) {
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
    const litFrames = { partner: 0, pen: 0, garden: {}, began: {} };
    const taken = new Set();
    let was = [];
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
      for (const owner of owners) {
        if (!was.includes(owner)) (litFrames.began[owner] ??= []).push(frame);
      }
      was = owners;
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

  // A shiny Pikachu and a shiny Squirtle, saved as ones caught on a raid are
  // (`SavedPokemon.shiny`), and an ordinary Eevee in the box, so all three are
  // out in the garden; a shiny Psyduck with the Day-Care Man.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon[0].pokemon;
    const one = (speciesId, level, shiny) => ({ ...partner, speciesId, level, currentHp: 999, xp: level * level * level, moves: ['Tackle'],
      nickname: null, heldItemId: null, primaryStatus: null, ...(shiny ? { shiny: true } : { shiny: undefined }) });
    [['pikachu', 14, true], ['eevee', 12, false], ['squirtle', 16, true]].forEach(([speciesId, level, shiny], index) => {
      const id = speciesId + '-' + (90 + index);
      save.stash.pokemon.push({ id, pokemon: one(speciesId, level, shiny) });
      if (save.stash.boxes?.[0]) save.stash.boxes[0].pokemonIds.push(id);
    });
    save.stash.dayCare = { id: 'psyduck-95', pokemon: one('psyduck', 13, true), leftAfterRaids: 0 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);

  // Beside the garden, on ground the yard as it is now drawn can be stood on.
  // The yard is restarted for the box's three to come out, and then asked
  // where they are: the open tile nearest the middle of them, which puts the
  // garden and the pen in the picture. A tile written down here once went
  // solid when the harbour was redrawn, and the scene stands a player who
  // asks for a solid tile at its usual arrival instead - so this stood on
  // the arrival square and photographed it as the garden, and passed.
  await page.evaluate(`void ${base}.scene.start('base', {})`);
  await until(`${baseReady} && ${base}.garden?.figures.length === 3`, 'the yard with the garden out');
  const stand = await page.evaluate(`(() => {
    const s = ${base};
    const tiles = s.garden.figures.map((f) => f.tile);
    const middle = { x: tiles.reduce((sum, t) => sum + t.x, 0) / tiles.length, y: tiles.reduce((sum, t) => sum + t.y, 0) / tiles.length };
    const taken = (x, y) => tiles.some((t) => t.x === x && t.y === y);
    let best = null;
    s.collision.forEach((row, y) => row.forEach((blocked, x) => {
      if (blocked || taken(x, y)) return;
      const far = Math.hypot(x - middle.x, y - middle.y);
      if (far >= 1.5 && (!best || far < best.far)) best = { x, y, far };
    }));
    return best && { x: best.x, y: best.y };
  })()`);
  if (!stand) fail('no open ground anywhere near the garden');
  await page.evaluate(`void ${base}.scene.start('base', { at: ${JSON.stringify(stand)}, facing: 'down' })`);
  await until(baseReady, 'the yard by the garden');
  await press('Escape');
  await until(`${base}.targetTile === null`, 'standing still');
  const at = await page.evaluate(`${base}.currentTile`);
  if (at.x !== stand.x || at.y !== stand.y) fail(`asked to stand at ${stand.x},${stand.y} by the garden, and stood at ${at.x},${at.y}`);

  const seen = await page.evaluate(starsOf(base));
  if (!seen.partner) fail('no partner at heel');
  if (!seen.pen) fail('nobody in the Day-Care pen');
  if (seen.garden.length !== 3) fail(`${seen.garden.length} Pokémon in the garden, not 3`);
  if (!before) {
    if (seen.partner.stars !== null) fail('the ordinary partner gives off stars');
    if (seen.pen.stars === null) fail('the shiny Psyduck in the pen has no stars to give off');
    const byId = Object.fromEntries(seen.garden.map((one) => [one.id, one.stars]));
    if (byId['pikachu-90'] === null) fail('the shiny Pikachu in the garden has no stars to give off');
    if (byId['squirtle-92'] === null) fail('the shiny Squirtle in the garden has no stars to give off');
    if (byId['eevee-91'] !== null) fail('the ordinary Eevee in the garden gives off stars');
  }

  // Two whole rounds, standing still: each shiny one twinkles, none in time with another.
  const allOut = (stars) => (stars?.length ?? 0) === 3;
  const standing = await watch(base, 8 * 60, {
    'yard-garden': (now) => allOut(now.garden.find((one) => one.id === 'pikachu-90')?.stars),
    'yard-pen': (now) => allOut(now.pen.stars),
  });
  if (before) {
    // The same yard, as a build with no stars has it.
    await shoot('yard');
  } else {
    console.log(`standing 8s: partner lit ${standing.partner} frames, pen ${standing.pen}, garden ${JSON.stringify(standing.garden)}`);
    if (standing.partner > 0) fail(`the ordinary partner was lit ${standing.partner} frames`);
    if (standing.pen < 40 || standing.pen > 140) fail(`the pen was lit ${standing.pen} frames of 480`);
    if (!(standing.garden['pikachu-90'] >= 40)) fail('the garden’s Pikachu never twinkled');
    if (!(standing.garden['squirtle-92'] >= 40)) fail('the garden’s Squirtle never twinkled');
    if (standing.garden['eevee-91']) fail('the garden’s Eevee twinkled');
    // Nobody begins with anybody else: a quarter of a second apart, at least.
    const began = Object.entries(standing.began);
    console.log(`began (frame): ${began.map(([who, frames]) => `${who} ${frames.join(',')}`).join('; ')}`);
    began.forEach(([a, framesA], index) =>
      began.slice(index + 1).forEach(([b, framesB]) =>
        framesA.forEach((frameA) =>
          framesB.forEach((frameB) => {
            if (Math.abs(frameA - frameB) < 15) fail(`${a} and ${b} began to twinkle together, on frames ${frameA} and ${frameB}`);
          }),
        ),
      ),
    );
  }

  if (raid) {
    // Over the fence with the shiny Pikachu leading - no starter, so this is
    // the lead walking whatever its kind, in its shiny colours: whoever is on
    // the bench steps off, it is taken first and the Charmander after it, as a
    // player changing who leads has them do.
    await walkIntoBase(page, 'raid-arena', { press, until, wait });
    await until(`document.querySelector('button[data-pokemon]') !== null`, 'the bench to list the vault');
    for (let guard = 0; guard < 6; guard += 1) {
      const stoodDown = await page.evaluate(
        `(() => { const b = document.querySelector('button[data-pokemon].px-party-slot'); if (!b) return false; b.click(); return true; })()`,
      );
      if (!stoodDown) break;
      await wait(150);
    }
    await until(takePokemon('pikachu'), 'Pikachu leading the raid party');
    await until(takePokemon('charmander'), 'Charmander in the raid party');
    await jumpIn(page, { press, until, wait });
    await until(`${world}.partner && ${world}.partner.place.out`, 'the follower out on the raid');
    const walking = await page.evaluate(`({ species: ${world}.partner.species, texture: ${world}.partner.sprite.texture.key })`);
    if (walking.species !== 'pikachu') fail(`${walking.species} is walking on the raid, not the Pikachu that leads`);
    if (!before && walking.texture !== 'partner-shiny-pikachu') fail(`the shiny Pikachu walks as ${walking.texture}, not in its shiny colours`);
    if (before) {
      await wait(1500);
      await shoot('raid-heel');
    } else {
      const there = await page.evaluate(starsOf(world));
      if (there.partner.stars === null) fail('the shiny lead has no stars to give off on a raid');
      const onRaid = await watch(world, 5 * 60, { 'raid-heel': (now) => allOut(now.partner?.stars) });
      console.log(`raid 5s: the lead lit ${onRaid.partner} frames`);
      if (onRaid.partner < 25) fail(`on a raid the lead was lit ${onRaid.partner} frames of 300`);
    }

    // Walking: the stars go with it, step for step, and the walk is a clip.
    const frames = [];
    let lit = 0;
    await page.keyDown('ArrowLeft');
    for (let frame = 0; frame < 240; frame += 1) {
      await step(1);
      if (frame === 110) {
        await page.keyUp('ArrowLeft');
        await page.keyDown('ArrowRight');
      }
      if (!before) {
        const now = await page.evaluate(starsOf(world));
        if (now.partner?.stars?.length && now.partner.visible) {
          lit += 1;
          expectOn('the lead, walking', now.partner);
        }
      }
      if (frame % 2 === 0) {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...CLIP_CROP, scale: 1 } });
        frames.push(Buffer.from(data, 'base64'));
      }
    }
    await page.keyUp('ArrowRight');
    await wait(400);
    writeFileSync(`${out}/clip-raid-walk.png`, animatedPng(frames.map(decodePng)));
    if (!before && lit < 25) fail(`walking on a raid the lead was lit ${lit} frames of 240`);
  }
  console.log(before ? 'pictures taken, nothing asked (--before)' : 'a shiny one twinkles in the garden, in the pen and at heel on the raid it leads; an ordinary one never');
} finally {
  await browser.close();
}
