import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  planNextGridStep,
  type Direction,
  type GridPosition,
} from '../movement/gridMovement';
import { BULBASAUR, CHARMANDER, CHARMELEON, PIDGEY, Pokemon, SQUIRTLE } from '../pokemon';
import { evolutionFamily } from '../pokemon/evolution';
import { createStartingStash, Stash } from '../stash';
import { SaveManager } from '../save/SaveManager';
import { baseGame, restoreBase } from './baseGames.testkit';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from './baseMap';
import { BASE_DOORS } from './doors';
import { BASE_ROOMS, buildRoom } from './rooms';
import {
  EMOTE_ART,
  EMOTE_INKS,
  PARTNER_FRAME,
  PARTNER_SPECIES,
  arrivalPlace,
  followStep,
  hopLift,
  idleBeat,
  isNeighbour,
  partnerAssetPath,
  partnerFrame,
  partnerOf,
  partnerReaction,
  sameTile,
  turnToPartner,
  TURN_TO_PARTNER_MS,
  type PartnerPlace,
} from './partner';

/** A walker's view of a map: a grid of strings, `#` solid and anything else ground. */
function grid(rows: readonly string[]): { blocked: (tile: GridPosition) => boolean; open: GridPosition[] } {
  const blocked = (tile: GridPosition): boolean => rows[tile.y]?.[tile.x] !== '.';
  const open = rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '.' ? [{ x, y }] : [])));
  return { blocked, open };
}

/**
 * Walks the player along `directions` the way `BaseScene` does - the map's
 * own collision and nothing for the partner - and the partner after them by
 * `followStep`. Returns every place both of them stood.
 */
function walk(
  rows: readonly string[],
  start: GridPosition,
  partner: PartnerPlace,
  directions: readonly Direction[],
): { player: GridPosition[]; partner: PartnerPlace[]; refused: number } {
  const { blocked } = grid(rows);
  const bounds = { width: rows[0].length, height: rows.length };
  let player = start;
  let facing: Direction = 'up';
  let place = partner;
  const trail = { player: [player], partner: [place], refused: 0 };
  for (const direction of directions) {
    const input = { up: false, down: false, left: false, right: false, [direction]: true };
    const decision = planNextGridStep({ position: player, facing, input, bounds, isBlocked: blocked });
    facing = decision.facing;
    if (!decision.target) {
      trail.refused += 1;
      continue;
    }
    const next = followStep(place, player, decision.target);
    if (next.move.kind === 'step') {
      // A step is always between neighbours, never a jump.
      expect(isNeighbour(next.move.from, next.move.to)).toBe(true);
    }
    place = next.place;
    player = decision.target;
    trail.player.push(player);
    trail.partner.push(place);
  }
  return trail;
}

/** A small harbour of its own: a one-tile lane, a dead end, a doorway and water. */
const LANES = [
  '##########',
  '#....#...#',
  '#.##.#.#.#',
  '#.##...#.#',
  '#.######.#',
  '#........#',
  '####.#####',
  '####.#####',
  '##########',
];

describe('the partner walks in the player’s footsteps', () => {
  it('always ends a step on the tile the player has just left', () => {
    const start = { x: 1, y: 5 };
    const path: Direction[] = ['right', 'right', 'right', 'down', 'down', 'up', 'up', 'left', 'left'];
    const trail = walk(LANES, start, { tile: { x: 1, y: 4 }, facing: 'down', out: true }, path);
    for (let index = 1; index < trail.player.length; index += 1) {
      expect(trail.partner[index].tile).toEqual(trail.player[index - 1]);
    }
  });

  it('only ever stands where the player has stood, so never in a wall or the water', () => {
    const { blocked, open } = grid(LANES);
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let seed = 7;
    const roll = (): number => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const path = Array.from({ length: 4000 }, () => directions[Math.floor(roll() * 4)]);
    const trail = walk(LANES, { x: 4, y: 5 }, { tile: { x: 4, y: 5 }, facing: 'up', out: false }, path);
    const stood = new Set(trail.player.map((tile) => `${tile.x},${tile.y}`));
    for (const place of trail.partner) {
      expect(blocked(place.tile)).toBe(false);
      expect(stood.has(`${place.tile.x},${place.tile.y}`)).toBe(true);
    }
    // And a long random walk with a partner at heel still covers the map.
    expect(stood.size).toBe(open.length);
  });

  it('never blocks: walking back into it swaps places, even at the end of a one-tile lane', () => {
    // Down the lane to its dead end and straight back out again.
    const trail = walk(LANES, { x: 4, y: 5 }, { tile: { x: 3, y: 5 }, facing: 'right', out: true }, [
      'down',
      'down',
      'up',
      'up',
    ]);
    expect(trail.refused).toBe(0);
    expect(trail.player.at(-1)).toEqual({ x: 4, y: 5 });
    // At the dead end it was behind the player; turning back passes it.
    expect(trail.partner[2].tile).toEqual({ x: 4, y: 6 });
    expect(trail.player[3]).toEqual({ x: 4, y: 6 });
    expect(trail.partner[3].tile).toEqual({ x: 4, y: 7 });
    expect(trail.partner[3].facing).toBe('down');
  });

  it('turns the way it walks', () => {
    const next = followStep({ tile: { x: 2, y: 3 }, facing: 'up', out: true }, { x: 3, y: 3 }, { x: 3, y: 2 });
    expect(next.move).toEqual({ kind: 'step', from: { x: 2, y: 3 }, to: { x: 3, y: 3 }, facing: 'right' });
  });

  it('comes out onto the first tile the player leaves when it was tucked away', () => {
    const next = followStep({ tile: { x: 5, y: 5 }, facing: 'up', out: false }, { x: 5, y: 5 }, { x: 5, y: 4 });
    expect(next.move).toEqual({ kind: 'appear', at: { x: 5, y: 5 }, facing: 'up' });
    expect(next.place.out).toBe(true);
  });

  it('never crosses ground nobody walked: from anywhere but a neighbour it comes out behind the player', () => {
    const next = followStep({ tile: { x: 0, y: 0 }, facing: 'up', out: true }, { x: 5, y: 5 }, { x: 5, y: 4 });
    expect(next.move.kind).toBe('appear');
    expect(next.place.tile).toEqual({ x: 5, y: 5 });
  });
});

describe('facing the partner', () => {
  const partner = { x: 5, y: 6 };
  const towards = { target: partner, partner, stepFacing: 'down' as const, facing: 'up' as const };

  it('a tap towards it from standing turns the player to face it, and walks nowhere', () => {
    const first = turnToPartner({ ...towards, holdMs: null, fromStanding: true, deltaMs: 16 });
    expect(first).toEqual({ turn: true, holdMs: TURN_TO_PARTNER_MS });
    // Let go: the next frame has no step towards it, and the turn is over.
    expect(turnToPartner({ ...towards, target: null, holdMs: first.holdMs, fromStanding: true, deltaMs: 16 })).toEqual({
      turn: false,
      holdMs: null,
    });
  });

  it('a hold walks on through it once the turn is over - it never blocks', () => {
    let state = turnToPartner({ ...towards, holdMs: null, fromStanding: true, deltaMs: 16 });
    let frames = 0;
    while (state.turn) {
      state = turnToPartner({ ...towards, holdMs: state.holdMs, fromStanding: true, deltaMs: 1000 / 60 });
      frames += 1;
    }
    expect(frames).toBeLessThanOrEqual(Math.ceil(TURN_TO_PARTNER_MS / (1000 / 60)));
  });

  it('never holds up a walk already under way, or a player already facing it', () => {
    expect(turnToPartner({ ...towards, holdMs: null, fromStanding: false, deltaMs: 16 }).turn).toBe(false);
    expect(turnToPartner({ ...towards, facing: 'down', holdMs: null, fromStanding: true, deltaMs: 16 }).turn).toBe(
      false,
    );
  });

  it('is nothing at all for a step anywhere else', () => {
    expect(turnToPartner({ ...towards, target: { x: 4, y: 5 }, holdMs: null, fromStanding: true, deltaMs: 16 })).toEqual({
      turn: false,
      holdMs: null,
    });
  });
});

describe('where the partner arrives', () => {
  const open = (blocked: readonly GridPosition[]) => (tile: GridPosition) =>
    !blocked.some((solid) => sameTile(solid, tile));

  it('stands behind the player, facing the way they face', () => {
    expect(arrivalPlace({ x: 5, y: 5 }, 'up', open([]))).toEqual({ tile: { x: 5, y: 6 }, facing: 'up', out: true });
  });

  it('stands beside them when behind is solid, and in front - turned to face them - when both sides are', () => {
    expect(arrivalPlace({ x: 5, y: 5 }, 'up', open([{ x: 5, y: 6 }])).tile).toEqual({ x: 4, y: 5 });
    const front = arrivalPlace({ x: 5, y: 5 }, 'up', open([{ x: 5, y: 6 }, { x: 4, y: 5 }, { x: 6, y: 5 }]));
    expect(front).toEqual({ tile: { x: 5, y: 4 }, facing: 'down', out: true });
  });

  it('is tucked away on the player’s own tile when there is nowhere at all to stand', () => {
    expect(arrivalPlace({ x: 5, y: 5 }, 'left', () => false)).toEqual({
      tile: { x: 5, y: 5 },
      facing: 'left',
      out: false,
    });
  });

  const game = baseGame({ built: [] });
  const yard = getBaseMap([]);
  const yardGround = (tile: GridPosition): boolean => yard.collision[tile.y]?.[tile.x] === false;

  /** The yard as the scene asks it: open ground, not a doorway, nothing drawn over it. */
  const yardStand = (tile: GridPosition): boolean =>
    yardGround(tile) &&
    !BASE_DOORS.some((door) => door.tiles.some((doorway) => sameTile(doorway, tile))) &&
    (yard.layers.canopy.tiles[tile.y]?.[tile.x] ?? -1) < 0;

  it.each(BASE_DOORS.map((door) => [door.id, door] as const))(
    'out of %s, it is at the player’s side - never in the doorway, where the building hides it',
    (_id, door) => {
      const place = arrivalPlace(door.returnTo, 'down', yardStand);
      expect(place.out).toBe(true);
      expect(isNeighbour(place.tile, door.returnTo)).toBe(true);
      expect(door.tiles.some((tile) => sameTile(tile, place.tile))).toBe(false);
    },
  );

  it.each([
    ['opening the game', BASE_SPAWN],
    ['home from a raid', BASE_LANDING],
  ] as const)('%s, it is on open ground next to the player', (_why, spawn) => {
    const place = arrivalPlace(spawn, 'up', yardStand);
    expect(place.out).toBe(true);
    expect(isNeighbour(place.tile, spawn)).toBe(true);
    expect(BASE_DOORS.some((door) => door.tiles.some((tile) => sameTile(tile, place.tile)))).toBe(false);
  });

  it.each(BASE_ROOMS.map((room) => [room.id, room] as const))(
    'in %s, it is beside the mat, on the floor, and never on the keeper',
    (_id, room) => {
      const built = buildRoom(room, game);
      const floor = (tile: GridPosition): boolean =>
        built.collision[tile.y]?.[tile.x] === false && !sameTile(tile, room.keeper.position);
      const place = arrivalPlace(room.mat, 'up', floor);
      expect(place.out).toBe(true);
      expect(floor(place.tile)).toBe(true);
      expect(isNeighbour(place.tile, room.mat)).toBe(true);
      // The way out is down off the mat, and the partner is never standing in it.
      expect(sameTile(place.tile, { x: room.mat.x, y: room.mat.y + 1 })).toBe(false);
    },
  );
});

describe('who the partner is', () => {
  it('is the starter a new game picks', () => {
    const stash = createStartingStash(SQUIRTLE);
    expect(partnerOf(stash)?.species).toBe('squirtle');
  });

  it('is the same Pokemon once it has evolved', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.partner()?.pokemon.evolveInto(CHARMELEON);
    expect(partnerOf(stash)?.species).toBe('charmeleon');
  });

  it('is never chosen: a stronger Pokemon of the same line does not take its place', () => {
    const stash = createStartingStash(CHARMANDER);
    const original = stash.partner()?.id;
    stash.addPokemon(new Pokemon(CHARMELEON, 30));
    stash.addPokemon(new Pokemon(PIDGEY, 40));
    expect(partnerOf(stash)?.id).toBe(original);
  });

  it('is gone once the partner is lost, and the starter a wipe re-issues is not it', () => {
    const stash = createStartingStash(CHARMANDER);
    const id = stash.partner()?.id ?? '';
    stash.applyWipeLoss([id], []);
    stash.ensurePlayable(CHARMANDER);
    // Same species, and the very same stash id, and still not the partner.
    expect(stash.listPokemon().map((entry) => entry.id)).toEqual([id]);
    expect(partnerOf(stash)).toBeNull();
  });

  it('survives a wipe it was secured through', () => {
    const stash = createStartingStash(BULBASAUR);
    const id = stash.partner()?.id ?? '';
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'pidgey-1');
    stash.applyWipeLoss([id, 'pidgey-1'], [], { pokemonIds: [id] });
    expect(partnerOf(stash)?.id).toBe(id);
  });

  it('is the newcomer a swap hands over - the swap changes the species and nothing else', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.swapStarter(SQUIRTLE);
    expect(partnerOf(stash)?.species).toBe('squirtle');

    const replacement = new Stash();
    replacement.addPokemon(new Pokemon(CHARMANDER, 5));
    replacement.swapStarter(BULBASAUR);
    expect(partnerOf(replacement)).toBeNull();
  });

  it('is saved, and a lost one stays lost through a save and load', () => {
    const kept = restoreBase(createStartingStash(CHARMANDER));
    expect(partnerOf(kept.stash)?.species).toBe('charmander');

    const stash = createStartingStash(CHARMANDER);
    stash.applyWipeLoss([stash.partner()?.id ?? ''], []);
    stash.ensurePlayable(CHARMANDER);
    expect(partnerOf(restoreBase(stash).stash)).toBeNull();
  });

  it('on a save from before the partner was recorded, is the strongest of the starter’s line', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(PIDGEY, 50), 'pidgey-1');
    stash.addPokemon(new Pokemon(CHARMANDER, 6), 'charmander-2');
    stash.addPokemon(new Pokemon(CHARMELEON, 20), 'charmeleon-1');
    // Written as a save from before the partner was recorded: no field at all.
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    };
    const manager = new SaveManager(storage);
    manager.save({ ...restoreBase(stash), stash });
    for (const [key, value] of stored) {
      const save = JSON.parse(value) as { stash: { partnerId?: unknown } };
      delete save.stash.partnerId;
      stored.set(key, JSON.stringify(save));
    }
    expect(partnerOf(manager.load()?.stash ?? new Stash())?.id).toBe('charmeleon-1');
  });
});

describe('what the partner says', () => {
  const healthy = new Pokemon(CHARMANDER, 10);

  it('names itself in capitals, as the games do', () => {
    for (let roll = 0; roll < 1; roll += 0.05) {
      expect(partnerReaction(healthy, 'yard', roll).line).toContain('CHARMANDER');
    }
  });

  it('tells the truth about how it is before anything else', () => {
    const fainted = new Pokemon(CHARMANDER, 10);
    fainted.takeDamage(fainted.maxHp);
    expect(partnerReaction(fainted, 'yard', 0)).toMatchObject({ emote: 'sleepy', hops: false });

    const poisoned = new Pokemon(CHARMANDER, 10);
    poisoned.primaryStatus = 'poison';
    expect(partnerReaction(poisoned, 'yard', 0).line).toContain('poison');

    const worn = new Pokemon(CHARMANDER, 10);
    worn.takeDamage(worn.maxHp - 1);
    expect(partnerReaction(worn, 'yard', 0.5)).toMatchObject({ emote: 'ellipsis', hops: false });
  });

  it('knows where it is', () => {
    const lines = new Set(
      Array.from({ length: 40 }, (_, index) => partnerReaction(healthy, 'pokemon-centre', index / 40).line),
    );
    expect([...lines].some((line) => line.includes('relaxed'))).toBe(true);
  });

  it('does not bounce about when worn out, and only looks up at you when fainted', () => {
    const worn = new Pokemon(CHARMANDER, 10);
    worn.takeDamage(worn.maxHp - 1);
    expect(idleBeat(0.9, worn)).toBeNull();
    const fainted = new Pokemon(CHARMANDER, 10);
    fainted.takeDamage(fainted.maxHp);
    expect(idleBeat(0.1, fainted)).toBeNull();
    expect(idleBeat(0.9, healthy)).toBe('hop-and-chirp');
  });

  it('hops two small bounces and lands', () => {
    expect(hopLift(0)).toBeGreaterThan(0);
    expect(hopLift(10_000)).toBe(0);
  });
});

describe('the partner’s art', () => {
  it('covers every Pokemon a partner can be: all three starters and both their evolutions', () => {
    const lines = [BULBASAUR, CHARMANDER, SQUIRTLE].flatMap((starter) =>
      evolutionFamily(starter.id).map((species) => species.id),
    );
    expect([...PARTNER_SPECIES].sort()).toEqual([...lines].sort());
  });

  it.each(PARTNER_SPECIES.map((species) => [species]))(
    '%s is a 64x128 sheet: two 32-pixel frames for each of four facings',
    (species) => {
      const path = join(__dirname, '../../../public', partnerAssetPath(species));
      expect(existsSync(path)).toBe(true);
      const png = readFileSync(path);
      expect(png.readUInt32BE(16)).toBe(PARTNER_FRAME * 2);
      expect(png.readUInt32BE(20)).toBe(PARTNER_FRAME * 4);
    },
  );

  it('lays the facings out down, up, left, right, two poses each', () => {
    expect(partnerFrame('down', 0)).toBe(0);
    expect(partnerFrame('up', 1)).toBe(3);
    expect(partnerFrame('right', 1)).toBe(7);
  });

  it('draws every bubble on its nine-by-eleven inside, in inks it has', () => {
    for (const art of Object.values(EMOTE_ART)) {
      expect(art).toHaveLength(11);
      for (const row of art) {
        expect(row).toHaveLength(9);
        for (const ink of row) {
          expect(ink === '.' || ink in EMOTE_INKS).toBe(true);
        }
      }
    }
  });

  it('is recorded in the provenance file', () => {
    const provenance = readFileSync(join(__dirname, '../../../public/assets/ASSET_PROVENANCE.md'), 'utf8');
    expect(provenance).toContain('followers/');
    expect(provenance).toContain('pret/pokeheartgold');
  });
});
