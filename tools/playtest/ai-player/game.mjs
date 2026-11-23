// The AI playtester's hands: a few high-level actions over the real game in
// test mode, each of which steps the paused loop until the world is still
// again and hands back what is on screen.
//
// Everything is read through test mode's `describe()` (src/game/dev/testDescribe.ts)
// and played through real key presses and real menu clicks, so the AI meets
// the game as a player does. The walking reuses `route.mjs`'s one-search route
// in a raid; the harbour is searched over the scene's own `isBlocked`, as
// `deploy.mjs`'s `walkIntoBase` does.
import { routeTo } from '../route.mjs';

export const GAME = 'window.__escapeFromPalletTownGame__';

/** Frames a tile of walking takes at most, at test mode's 100ms frame. */
const FRAMES_PER_STEP = 4;
/** The most a single settle steps before giving the screen back as it is. */
const SETTLE_LIMIT_FRAMES = 600;
/**
 * Game time a player takes between one decision and the next. The loop is
 * paused while the AI thinks, so without this its next press lands a few
 * stepped frames after the last - inside the guards that keep one held or
 * doubled key from answering the question it just asked (`RELEASE_ARMING_MS`,
 * 500ms), which no person is ever quick enough to hit. The overnight playtest
 * of 20 Nov 2026 reported "the first press on USE POTION ON does nothing"
 * three times for exactly that reason.
 */
export const HUMAN_BEAT_FRAMES = 6;
/** Boxes `talk` and `next` read through before handing back. */
const READ_LIMIT = 40;

const DIRECTION_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

export function createHands(page) {
  const evaluate = (expression) => page.evaluate(expression);
  const step = (frames = 1) => evaluate(`${GAME}.stepFrames(${Math.max(0, Math.round(frames))})`);
  const look = () => evaluate(`${GAME}.describe()`);
  /** The player's pause before acting: game time for the decision just taken. */
  const beat = () => step(HUMAN_BEAT_FRAMES);
  const eventsSince = (since) => evaluate(`${GAME}.eventLog(${Number(since) || 0})`);
  /** One press: down, a frame for the game to take it, up, and a frame or two after. */
  const press = async (code, after = 2) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(after);
  };

  const top = (screen) => screen.scenes[screen.scenes.length - 1];
  const fieldOf = (screen) => {
    if (screen.scenes.includes('battle')) return null;
    if (top(screen) === 'world' && screen.scene.world) return { key: 'world', ...screen.scene.world };
    if (top(screen) === 'base' && screen.scene.base) return { key: 'base', ...screen.scene.base };
    return null;
  };
  /** Something on screen that wants the player before they can walk on. */
  const interruption = (screen) => {
    if (screen.scenes.includes('battle')) return 'a fight started';
    if (screen.menu) return `a menu opened: ${screen.menu.heading ?? screen.menu.text.slice(0, 60)}`;
    const field = fieldOf(screen);
    if (!field) return `the screen is ${top(screen)}`;
    if (field.choice) return `a question: ${field.choice.options.join(' / ')}`;
    if (field.dialogue) return `somebody is talking: ${field.dialogue.text}`;
    return null;
  };

  /** Steps until nothing is busy and nobody is mid-step, or the limit. */
  const settle = async (limit = SETTLE_LIMIT_FRAMES) => {
    let screen = await look();
    for (let frames = 0; frames < limit; frames += 3) {
      const field = fieldOf(screen);
      const typing =
        (field?.dialogue && !field.dialogue.complete) ||
        (screen.scene.battle?.message && !screen.scene.battle.message.complete && screen.scene.battle.commands.length === 0);
      // The game loads its pictures in real time, not in stepped frames: while it
      // boots, wall time has to pass as well for the loader to get anywhere.
      const booting = screen.scenes.length === 0 || screen.scenes.includes('boot');
      if (!screen.busy && !field?.walking && !typing && !booting) {
        return screen;
      }
      if (booting) await new Promise((done) => setTimeout(done, 100));
      await step(3);
      screen = await look();
    }
    return screen;
  };

  // --- Walking -------------------------------------------------------------

  /** The next keys from here to `goal` in the harbour, over the scene's own `isBlocked`. */
  const baseRoute = (goal) =>
    evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const s = b.currentTile; const goal = ${JSON.stringify(goal)};
      if (s.x === goal.x && s.y === goal.y) return [];
      const c = b.collision, H = c.length, W = c[0].length, id = (x, y) => y * W + x;
      const from = new Map([[id(s.x, s.y), null]]); const queue = [[s.x, s.y]];
      while (queue.length) { const [x, y] = queue.shift();
        for (const [dx, dy, k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || from.has(id(nx, ny))) continue;
          const isGoal = nx === goal.x && ny === goal.y;
          if (!isGoal && b.isBlocked({ x: nx, y: ny })) continue;
          from.set(id(nx, ny), [x, y, k]);
          if (isGoal) { const keys = []; let at = id(nx, ny);
            while (from.get(at)) { const [px, py, key] = from.get(at); keys.push(key); at = id(px, py); }
            return keys.reverse(); }
          queue.push([nx, ny]); } }
      return null; })()`);

  const worldRoute = (goal) => evaluate(routeTo(`${GAME}.scene.getScene('world')`, goal));

  /** Finds a tile for a label among the things the screen names. */
  const resolveLabel = (screen, label) => {
    const wanted = label.toLowerCase();
    const field = fieldOf(screen);
    if (!field) return null;
    if (['way', 'arrow', 'objective'].includes(wanted) && field.raid?.way?.toward) {
      return { tile: field.raid.way.toward, near: field.raid.way.next, what: `the arrow (${field.raid.way.cue ?? 'way'})` };
    }
    const named = [
      ...(field.raid?.exits ?? []).map((each) => ({ name: each.label, tile: each.tile, what: 'exit' })),
      ...(field.raid?.stopsLeft ?? []).filter((each) => each.tile).map((each) => ({ name: each.label, tile: each.tile, what: 'stop' })),
      ...(field.near?.trainers ?? []).map((each) => ({ name: each.name, tile: each.tile, what: 'trainer' })),
      ...(field.near?.landmarks ?? []).map((each) => ({ name: each.label, tile: each.tile, what: 'landmark' })),
      ...(field.near?.loot ?? []).map((each) => ({ name: each.item, tile: each.tile, what: 'item' })),
      ...(field.near?.doors ?? []).flatMap((each) => [
        { name: each.name, tile: each.tile, what: 'door' },
        { name: each.id, tile: each.tile, what: 'door' },
      ]),
      // A thing in a room is walked to where it is used from, and faced.
      ...(field.near?.things ?? []).map((each) => ({ name: each.name, tile: each.use?.stand ?? each.tile, face: each.use?.face, what: 'thing' })),
      ...(field.near?.rim ? [{ name: 'rim', tile: field.near.rim, what: 'the' }] : []),
      // A room is left by stepping down off its door mat.
      ...(field.near?.exit ? [{ name: 'way out', tile: field.near.exit, leave: 'ArrowDown', what: 'the' }, { name: 'out', tile: field.near.exit, leave: 'ArrowDown', what: 'the way' }] : []),
      ...(field.near?.captions ?? []).filter((each) => each.tile).map((each) => ({ name: each.text, tile: each.tile, what: 'caption' })),
      ...(field.near?.people ?? []).map((each) => ({ name: each.name ?? each.pokemon ?? each.kind, tile: each.tile, what: each.kind })),
    ];
    const match =
      named.find((each) => each.name?.toLowerCase() === wanted) ??
      named.find((each) => each.name?.toLowerCase().startsWith(wanted)) ??
      named.find((each) => each.name?.toLowerCase().includes(wanted));
    return match ? { tile: match.tile, face: match.face, leave: match.leave, what: `${match.what} ${match.name}` } : null;
  };

  /**
   * Walks to a tile, or to a thing on screen by its name, a tile a press. It
   * stops the moment anything wants the player - a line, a question, a fight,
   * a menu - and says so. A goal that is a wall or a person is walked up to
   * and faced.
   */
  const walkTo = async (target, { maxSteps = 500 } = {}) => {
    let screen = await settle();
    const field = fieldOf(screen);
    if (!field) return { ok: false, note: `cannot walk here: ${interruption(screen) ?? top(screen)}` };
    const blocker = interruption(screen);
    if (blocker) return { ok: false, note: `cannot walk yet: ${blocker}` };
    let goal = target.tile;
    let what = target.label ?? `${goal?.x},${goal?.y}`;
    let face = null;
    let leave = null;
    if (!goal) {
      const found = resolveLabel(screen, target.label);
      if (!found) return { ok: false, note: `nothing on screen is called "${target.label}"` };
      goal = found.tile;
      what = found.what;
      face = found.face ?? null;
      leave = found.leave ?? null;
    }
    const arrive = async (result) => {
      if (result.ok && leave) {
        await press(leave, FRAMES_PER_STEP - 1);
        const after = await settle(100);
        const field = fieldOf(after);
        return { ...result, note: `went out to ${field?.place ?? top(after)}`, screen: after };
      }
      if (!result.ok || !face) return result;
      const now = fieldOf(await look());
      if (now && now.tile.x === goal.x && now.tile.y === goal.y && now.facing !== face) {
        // A press made while the figure is still turning is dropped, so the turn is let finish.
        await press(DIRECTION_KEYS[face], 4);
        await settle(30);
      }
      return { ...result, note: `${result.note}, facing it` };
    };
    let steps = 0;
    let replans = 0;
    while (steps < maxSteps) {
      const here = fieldOf(screen);
      if (!here) return { ok: false, steps, note: `stopped: ${interruption(screen) ?? 'the scene changed'}` };
      let route = here.key === 'world' ? await worldRoute(goal) : await baseRoute(goal);
      if (route === null && target.label && ['way', 'arrow', 'objective'].includes(target.label.toLowerCase())) {
        // The arrow's target is through a door: walk to where the arrow aims now, and on from there.
        const aim = fieldOf(screen)?.raid?.way?.next;
        if (aim && !(aim.x === here.tile.x && aim.y === here.tile.y)) route = await worldRoute(aim);
        if (route && route.length === 0) return { ok: true, steps, note: `as far as the arrow goes on foot: look for a door` };
      }
      if (route === null) return { ok: false, steps, note: `no way to ${what} from ${here.tile.x},${here.tile.y}` };
      if (route.length === 0) return arrive({ ok: true, steps, note: `at ${what}` });
      for (const key of route) {
        const before = here.tile;
        await press(key, FRAMES_PER_STEP - 1);
        screen = await settle(60);
        steps += 1;
        const stop = interruption(screen);
        if (stop) return { ok: false, steps, note: `stopped after ${steps} steps: ${stop}` };
        const now = fieldOf(screen);
        if (!now || now.key !== here.key || now.map !== here.map || now.room !== here.room) {
          return { ok: true, steps, note: `went through to ${now?.place ?? now?.mapName ?? top(screen)}` };
        }
        if (now.tile.x === goal.x && now.tile.y === goal.y) return arrive({ ok: true, steps, note: `at ${what}` });
        if (now.tile.x === before.x && now.tile.y === before.y) {
          // Walked into the goal itself (a person, a door, a sign): that is arriving.
          const ahead = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
          // Unless the goal is a spot to stand on, and somebody (the partner at heel, say) is on it.
          if (!face && before.x + ahead[0] === goal.x && before.y + ahead[1] === goal.y) {
            return { ok: true, steps, note: `next to ${what}, facing it` };
          }
          await step(5);
          screen = await settle(30);
          replans += 1;
          if (replans > 6) return { ok: false, steps, note: `blocked on the way to ${what} at ${before.x},${before.y}` };
          break;
        }
        here.tile = now.tile;
      }
    }
    return { ok: false, steps, note: `gave up after ${steps} steps` };
  };

  /** Walks one way for up to `count` tiles, stopping at a wall or anything that wants the player. */
  const stroll = async (direction, count = 5) => {
    const key = DIRECTION_KEYS[{ north: 'up', south: 'down', west: 'left', east: 'right' }[direction] ?? direction];
    if (!key) return { ok: false, note: 'walk up|down|left|right (or north|south|east|west) [tiles]' };
    let screen = await settle();
    let steps = 0;
    for (; steps < Math.min(count, 60); steps += 1) {
      const before = fieldOf(screen);
      if (!before) break;
      const stop = interruption(screen);
      if (stop) return { ok: false, steps, note: `stopped after ${steps} steps: ${stop}` };
      await press(key, FRAMES_PER_STEP - 1);
      screen = await settle(60);
      const after = fieldOf(screen);
      if (!after || after.map !== before.map || after.room !== before.room) {
        return { ok: true, steps: steps + 1, note: `went through to ${after?.place ?? after?.mapName ?? top(screen)}`, screen };
      }
      if (after.tile.x === before.tile.x && after.tile.y === before.tile.y) {
        return { ok: steps > 0, steps, note: `blocked after ${steps} steps`, screen };
      }
    }
    return { ok: true, steps, note: `walked ${steps} steps ${direction}`, screen };
  };

  // --- Talking and choosing -------------------------------------------------

  /** Presses through dialogue until it ends, asks a question, or something else takes over. */
  const readThrough = async () => {
    for (let box = 0; box < READ_LIMIT; box += 1) {
      const screen = await settle(120);
      const field = fieldOf(screen);
      if (!field || field.choice || !field.dialogue) return screen;
      await press('Space', 2);
    }
    return look();
  };

  const talk = async (direction) => {
    let screen = await settle();
    if (direction) {
      const key = DIRECTION_KEYS[direction];
      if (!key) return { ok: false, note: 'talk takes up, down, left or right' };
      const field = fieldOf(screen);
      if (field && field.facing !== direction) {
        await press(key, 2);
        screen = await settle(60);
        // A direction key only turns the player in place against something in
        // the way: where the way is open it walks a step, and there was nothing
        // there to talk to. Said as that, because pressing SPACE on regardless
        // and reporting "the talking is over" had the overnight playtest of 20
        // Nov 2026 sure it had faced the Service Gate when it never had.
        const moved = fieldOf(screen)?.tile;
        if (moved && field.tile && (moved.x !== field.tile.x || moved.y !== field.tile.y)) {
          return { ok: false, note: `nothing to face ${direction} of ${field.tile.x},${field.tile.y}: the way was open, so you stepped onto ${moved.x},${moved.y}`, screen };
        }
      }
    }
    const before = await look();
    await press('Space', 3);
    screen = await readThrough();
    // A press the game was not ready for (mid-turn, mid-step) is dropped: one more try.
    // Only when nothing at all came of it: talking to somebody changes no scene,
    // so asking the scene list alone started every conversation a second time,
    // and the veteran run reported every briefing and sign as said twice.
    const answered = (await eventsSince(before.lastEvent)).some((event) => event.kind !== 'moved');
    if (!answered && !interruption(screen) && screen.scenes.join() === before.scenes.join()) {
      await step(4);
      await press('Space', 3);
      screen = await readThrough();
    }
    const said = (await eventsSince(before.lastEvent)).some((event) => event.kind !== 'moved');
    if (!said && !interruption(screen)) {
      const field = fieldOf(screen);
      return { ok: false, note: `nothing answered${field?.tile ? ` at ${field.tile.x},${field.tile.y} facing ${field.facing}` : ''}`, screen };
    }
    return { ok: true, note: interruption(screen) ?? 'the talking is over (every line is under SINCE LAST ACTION)', screen };
  };

  const pickIndex = (options, label) => {
    const wanted = label.toLowerCase().trim();
    const lower = options.map((option) => option.toLowerCase().replace(/^[▶\s]+/, '').trim());
    let index = lower.findIndex((option) => option === wanted);
    if (index < 0) index = lower.findIndex((option) => option.startsWith(wanted));
    if (index < 0) index = lower.findIndex((option) => option.includes(wanted));
    return index;
  };

  /**
   * Moves a cursor until `selected()` is the wanted index. A list moves one
   * way and a battle menu is a grid, so each press tries the arrows in turn
   * and keeps the first that brings the cursor closer, undoing one that does
   * not.
   */
  const OPPOSITE = { ArrowRight: 'ArrowLeft', ArrowLeft: 'ArrowRight', ArrowDown: 'ArrowUp', ArrowUp: 'ArrowDown' };
  const moveCursor = async (wanted, selected) => {
    for (let guard = 0; guard < 16; guard += 1) {
      const now = await selected();
      if (now === wanted) return true;
      if (now === null || now < 0) return false;
      const keys = now < wanted ? ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] : ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
      const nearer = (after) => after === wanted || (after !== null && Math.abs(after - wanted) < Math.abs(now - wanted));
      let closer = false;
      for (const key of keys) {
        await press(key, 1);
        const after = await selected();
        if (nearer(after)) {
          closer = true;
          break;
        }
        if (after !== now) await press(OPPOSITE[key], 1);
      }
      // A grid that wraps along its rows can need two keys before the index
      // gets any nearer - Down then Left, from the end of one row to the middle
      // of the next - and a list with nothing nearer one key away is not a
      // list the player cannot use. Gave up, the AI pressed on by hand and put
      // its Poke Balls down instead of the rope it chose (22 Nov 2026).
      for (const first of closer ? [] : keys) {
        for (const second of keys) {
          if (closer || second === OPPOSITE[first]) continue;
          await press(first, 1);
          await press(second, 1);
          if (nearer(await selected())) {
            closer = true;
            continue;
          }
          await press(OPPOSITE[second], 1);
          await press(OPPOSITE[first], 1);
        }
      }
      if (!closer) return false;
    }
    return (await selected()) === wanted;
  };

  /** Answers the question on screen, picks a battle command, or presses a menu control, by its label. */
  const choose = async (label) => {
    const screen = await settle();
    const field = fieldOf(screen);
    if (field?.choice) {
      const index = pickIndex(field.choice.options, label);
      if (index < 0) return { ok: false, note: `no answer "${label}" in ${field.choice.options.join(' / ')}` };
      const moved = await moveCursor(index, async () => fieldOf(await look())?.choice?.selected ?? null);
      if (!moved) return { ok: false, note: `could not move the cursor to ${field.choice.options[index]}` };
      await press('Space', 3);
      const after = await readThrough();
      return { ok: true, note: `answered ${field.choice.options[index]}; ${interruption(after) ?? 'done'}`, screen: after };
    }
    const listed = Object.entries(screen.scene).find(([, part]) => Array.isArray(part?.choices));
    if (listed && !screen.menu) {
      const [key, part] = listed;
      const labels = part.choices.map((choice) => choice.label);
      const index = pickIndex(labels, label);
      if (index < 0) return { ok: false, note: `no choice "${label}" in ${labels.join(' / ')}` };
      const cursorAt = async () => {
        const now = (await look()).scene[key]?.choices;
        return now ? now.findIndex((choice) => choice.cursor) : null;
      };
      // A title-style list moves up and down, and passes over a dim choice.
      for (let guard = 0; guard < 12 && (await cursorAt()) !== index; guard += 1) {
        const at = await cursorAt();
        if (at === null || at < 0) break;
        await press(at < index ? 'ArrowDown' : 'ArrowUp', 1);
        if ((await cursorAt()) === at) await press(at < index ? 'ArrowRight' : 'ArrowLeft', 1);
      }
      if ((await cursorAt()) !== index) return { ok: false, note: `could not move the cursor to ${labels[index]}` };
      await press('Space', 3);
      return { ok: true, note: `chose ${labels[index]}`, screen: await settle(100) };
    }
    const battle = screen.scene.battle;
    if (battle && battle.commands.length > 0 && !screen.menu) {
      const index = pickIndex(battle.commands, label);
      if (index < 0) return { ok: false, note: `no command "${label}" in ${battle.commands.join(' / ')}` };
      const moved = await moveCursor(index, async () => (await look()).scene.battle?.cursor ?? null);
      if (!moved) return { ok: false, note: `could not move the cursor to ${battle.commands[index]}` };
      await press('Space', 3);
      return { ok: true, note: `chose ${battle.commands[index]}`, screen: await settle(30) };
    }
    if (screen.menu) {
      const pressed = await evaluate(`${GAME}.pressMenu(${JSON.stringify(label)})`);
      if (!pressed) {
        return { ok: false, note: `no control "${label}" on ${screen.menu.heading ?? 'the menu'}: ${screen.menu.controls.map((c) => c.label).slice(0, 30).join(' | ')}` };
      }
      await step(4);
      return { ok: true, note: `pressed ${pressed}`, screen: await settle(60) };
    }
    return { ok: false, note: 'nothing on screen to choose from' };
  };

  // --- Fighting ---------------------------------------------------------------

  const EFFECT_ORDER = { 'SUPER EFFECTIVE': 2, 'NORMAL DAMAGE': 1, RESISTED: 0.5, 'NO EFFECT': 0 };

  /** Which move a policy picks: the strongest hit for the veteran, the first one for the newcomer. */
  const pickMove = (battle, policy) => {
    const usable = battle.moves.map((move, index) => ({ ...move, index })).filter((move) => move.pp > 0);
    if (usable.length === 0) return 0;
    if (policy === 'first') return usable[0].index;
    const score = (move) => (move.power || 1) * (EFFECT_ORDER[move.against] ?? 1);
    return usable.sort((a, b) => score(b) - score(a))[0].index;
  };

  /**
   * Plays a fight until it ends or asks something only the player should
   * answer (a nickname, a move to forget, a legend to let go). `strongest`
   * hits with the best move it has; `first` uses the first move, as somebody
   * who has never seen a type chart would; `run` tries to get away.
   */
  const fight = async (policy = 'strongest') => {
    // What the fight said is read off the event log, which the game writes every
    // frame: lines shown while the battle was busy - 'Foe KRABBY used LEER!',
    // 'It's super effective!', a faint - came and went inside one settle, and a
    // log built from the settled screens alone dropped them, so every playtest
    // reported the attacker's line missing (22 Nov 2026).
    const start = (await look()).lastEvent ?? 0;
    const said = [];
    const heard = async () => {
      said.length = 0;
      for (const event of await eventsSince(start)) {
        if (event.kind === 'talked' && event.scene === 'battle' && typeof event.text === 'string') said.push(event.text);
      }
    };
    const done = async (result) => {
      await heard();
      return result;
    };
    for (let guard = 0; guard < 300; guard += 1) {
      const screen = await settle(60);
      const battle = screen.scene.battle;
      if (!screen.scenes.includes('battle')) {
        return done({ ok: true, note: `the fight is over; ${interruption(screen) ?? 'back on the map'}`, said, screen });
      }
      if (!battle || battle.busy) {
        await step(3);
        continue;
      }
      if (screen.menu) return done({ ok: false, note: `the fight asks: ${screen.menu.heading ?? screen.menu.text.slice(0, 80)}`, said, screen });
      if (battle.commands.length === 0 || ['events', 'evolving', 'finished'].includes(battle.mode)) {
        await press('Space', 3);
        continue;
      }
      const wantCommand = async (label) => {
        const index = pickIndex(battle.commands, label);
        if (index < 0) return false;
        if (!(await moveCursor(index, async () => (await look()).scene.battle?.cursor ?? null))) return false;
        await press('Space', 3);
        return true;
      };
      if (battle.mode === 'main') {
        // RUN from a wild Pokemon, FLEE from a hunter; a trainer cannot be left.
        if (policy === 'run' && ((await wantCommand('RUN')) || (await wantCommand('FLEE')))) continue;
        if (await wantCommand('FIGHT')) continue;
        await press('Space', 3);
        continue;
      }
      if (battle.mode === 'moves') {
        const index = pickMove(battle, policy);
        if (!(await moveCursor(index, async () => (await look()).scene.battle?.cursor ?? null))) {
          return done({ ok: false, note: `could not move the cursor to ${battle.moves[index]?.name}: choose a move yourself`, said, screen });
        }
        await press('Space', 3);
        continue;
      }
      if (battle.mode === 'target' || battle.mode === 'party') {
        await press('Space', 3);
        continue;
      }
      return done({ ok: false, note: `the fight asks (${battle.mode}): ${battle.commands.join(' / ')}`, said, screen });
    }
    return done({ ok: false, note: 'the fight did not end in 300 turns of pressing', said, screen: await look() });
  };

  return { look, eventsSince, step, beat, press, settle, walkTo, stroll, talk, readThrough, choose, fight, interruption };
}
