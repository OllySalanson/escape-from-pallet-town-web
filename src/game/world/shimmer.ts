import {
  FLOODPLAIN_REED_WILDLIFE,
  FOREST_EDGE_WILDLIFE,
  MARSH_WILDLIFE,
  PALLET_FIELD_WILDLIFE,
  ROUTE_MEADOW_WILDLIFE,
  type WildEncounterTable,
} from '../pokemon/encounters';
import type { GridPosition } from '../movement/gridMovement';
import type { SeededRng } from '../run/rng';
import type { WorldMapDefinition, WorldMapId } from '../worldMap';

/**
 * **Shimmering grass: one patch a raid where the rare one is.**
 *
 * Every place on the vale has a table, and most tables have a slot that hardly
 * ever comes up - the Squirtle in the reeds, the Scyther in the reserve. A
 * player could walk a place for a week and never meet it, and nothing on the
 * map said it was there to be met. So one tile of tall grass a raid glitters
 * (`WorldScene.createShimmer`), and stepping into it is that place's rarest
 * Pokemon (`rarestOf`), a level over the best the table rolls, with no dice
 * about whether:
 * a thing seen from the path and gone for, which is what the raid is short of
 * between the landing and the stake.
 *
 * It is laid a short way off the walk to the stake (`raidStake.ts`), so a
 * player following the gold arrow passes it in sight and chooses; where a raid
 * has no trail it is laid by its walk from the landing alone. The walk to it
 * is the stake's own - outdoors, every figure and every trainer's watch a
 * wall - so it is reached with no fight but its own.
 *
 * **And it is where a shiny is likeliest**, one in `SHIMMER_SHINY_ODDS`
 * against the wild's one in 500 (`pokemon/shiny.ts`). That is one roll a raid
 * at ten times the odds, which leaves a shiny what the captain asked for on
 * 11 Oct 2026 - a story somebody tells, never a thing anybody farms - and
 * gives the story somewhere to start: the glitter is honest about being the
 * place to look, and still says no forty-nine times in fifty.
 *
 * A patch is met once. Run from what is in it, or lose to it, and it is gone
 * for the raid (`ActiveRunSession.shimmerMet`): the grass stops glittering
 * when something has been through it.
 *
 * Laid on a stream of its own (`SHIMMER_STREAM` in `runGeneration.ts`), so no
 * other roll of any raid moves; never on a new save's first raid, whose first
 * five minutes are spoken for (`hub/firstRaid.ts`).
 */

/** The maps a raid shimmers on. A retired map coming back is a row here; a player's map has no stake to lay it by. */
const MAPS_WITH_SHIMMER: readonly WorldMapId[] = ['greystone-vale'];

export const hasShimmer = (mapId: WorldMapId): boolean => MAPS_WITH_SHIMMER.includes(mapId);

/** One in this many shimmering patches holds a shiny: ten times the wild's odds, once a raid. */
export const SHIMMER_SHINY_ODDS = 50;

/** How far the patch lies from the landing, in steps: never underfoot, never a raid's whole clock away. */
export const SHIMMER_LEAST_WALK = 25;
export const SHIMMER_MOST_WALK = 170;

/**
 * How far off the walk to the stake it lies, in tiles: on the smallest screen
 * (320x240) from the trail, and at least a couple of tiles off it, so it is
 * gone for rather than trodden on.
 */
export const SHIMMER_OFF_TRAIL = { least: 2, across: 8, down: 5 } as const;
/**
 * How far from anybody the patch keeps, in tiles: a person calling out, a
 * Pokemon on its beat or a sign beside it stands in front of the glitter or
 * talks over it (the first one laid was under a mason's "Up she goes!").
 */
export const SHIMMER_CLEAR_OF_FIGURES = 2;
/** The trail's first stretch is the landing's own screen, which the first money already has. */
const TRAIL_FROM_SHARE = 0.2;

/** How many levels over the best its table rolls the one in the patch is. */
export const SHIMMER_LEVELS_OVER = 1;

/** This raid's patch: where, and what is in it. */
export interface Shimmer {
  readonly position: GridPosition;
  readonly speciesId: string;
  readonly level: number;
}

/** What glitters is under this share of its table, or not in it: the Squirtle in the reeds is a tenth of them. */
export const RARE_SHARE = 1 / 6;

/**
 * The rare company of a kind of ground, where it is written down: the kinds
 * that glitter there. Three of the vale's habitats are a route's plain
 * company (the wood's bugs and birds in near-equal shares, the meadow's
 * Jigglypuff at nearly a fifth of it, the fields' Spearow), and "the rarest
 * of the place" there would be a Pidgey under a light; two more have a rare
 * slot of their own and somebody who belongs beside it. A habitat not written
 * here glitters with its table's own rarest (`rarestOf`).
 *
 * - The woods: the Pikachu of Viridian Forest, and a Bulbasaur.
 * - The meadows of the moor: a moor pony (the vale's inn is The Coach and
 *   Ponyta, and the only wild ones were on Ember Isle) and FireRed's own
 *   moorland bird, Doduo.
 * - The fields: the Mankey of the routes out of Viridian, which the vale
 *   otherwise keeps for Stormcrown, and Growlithe, FireRed's own on Routes 7
 *   and 8, which the vale had nowhere at all.
 * - The reeds: their own Squirtle, and the wild duck, Farfetch'd.
 * - Koga's marsh: the reserve's four, and Ekans, FireRed's own, which the
 *   vale had nowhere at all.
 *
 * Keyed by the habitat's own table, which is what a district of a map file
 * holds (`MAP_FILE_HABITATS`), so nothing about any table's rolls changes.
 * `shimmer.test.ts` holds every habitat with grass on the vale to it: what
 * glitters is under a sixth of its table or not in it at all, and can fight.
 */
const SHIMMER_COMPANY: ReadonlyMap<WildEncounterTable, readonly string[]> = new Map([
  [FOREST_EDGE_WILDLIFE, ['pikachu', 'bulbasaur']],
  [ROUTE_MEADOW_WILDLIFE, ['ponyta', 'doduo']],
  [PALLET_FIELD_WILDLIFE, ['mankey', 'growlithe']],
  [FLOODPLAIN_REED_WILDLIFE, ['squirtle', 'farfetchd']],
  [MARSH_WILDLIFE, ['chansey', 'kangaskhan', 'pinsir', 'scyther', 'ekans']],
]);

/** What a patch may hold: one of these kinds, at this level. */
export interface ShimmerRarity {
  /** The kinds tied for rarest, by name, so the stream's pick among them is stable. */
  readonly speciesIds: readonly string[];
  readonly level: number;
}

/**
 * The rarest things a place holds, a level over the best the place rolls: its
 * habitat's rare company where that is written down (`SHIMMER_COMPANY`), else
 * the species with the least of the table's weight (a species written on two
 * rows is the sum of them, and every one of them where several tie) - for the
 * raid's stream to pick among. `habitat` is the place's table as it is authored, which is what names
 * the guest; `rolled` is what its grass holds at this raid's hour, which by
 * night is another table. Undefined for a place with nothing in it.
 */
export function rarestOf(
  rolled: WildEncounterTable | undefined,
  habitat: WildEncounterTable | undefined = rolled,
): ShimmerRarity | undefined {
  const bySpecies = new Map<string, number>();
  let best = 0;
  for (const entry of rolled?.entries ?? []) {
    bySpecies.set(entry.speciesId, (bySpecies.get(entry.speciesId) ?? 0) + entry.weight);
    best = Math.max(best, entry.maxLevel);
  }
  if (bySpecies.size === 0) {
    return undefined;
  }
  const level = best + SHIMMER_LEVELS_OVER;
  const company = habitat === undefined ? undefined : SHIMMER_COMPANY.get(habitat);
  if (company) {
    return { speciesIds: [...company].sort(), level };
  }
  const least = Math.min(...bySpecies.values());
  return {
    speciesIds: [...bySpecies.entries()]
      .filter(([, weight]) => weight === least)
      .map(([speciesId]) => speciesId)
      .sort(),
    level,
  };
}

const grassInReach = new WeakMap<readonly Int32Array[], readonly GridPosition[]>();

/**
 * Every tile of tall grass the walk reaches inside the patch's range. Worked
 * out once for a field of steps: a raid is dealt a great many times over the
 * same ground, and only the seat differs.
 */
function grassWalkedTo(map: Pick<WorldMapDefinition, 'tallGrass'>, steps: readonly Int32Array[]): readonly GridPosition[] {
  const known = grassInReach.get(steps);
  if (known) {
    return known;
  }
  const tiles: GridPosition[] = [];
  steps.forEach((row, y) =>
    row.forEach((walk, x) => {
      if (walk >= SHIMMER_LEAST_WALK && walk <= SHIMMER_MOST_WALK && map.tallGrass[y]?.[x] === true) {
        tiles.push({ x, y });
      }
    }),
  );
  grassInReach.set(steps, tiles);
  return tiles;
}

/**
 * Where this raid's patch may lie: tall grass the sure walk reaches, in range,
 * with nothing else on it - beside the trail to the stake where there is one
 * and any grass stands beside it, and anywhere in range where not.
 *
 * `steps` is the stake's own field (`StakeGround.steps`): from the landing,
 * with every figure and watch a wall. `figures` is everybody and everything
 * standing on the map, every tile of a beat among them: the patch keeps
 * `SHIMMER_CLEAR_OF_FIGURES` clear of each.
 */
export function shimmerSeats(
  map: Pick<WorldMapDefinition, 'tallGrass'>,
  steps: readonly Int32Array[],
  reserved: ReadonlySet<string>,
  trail: readonly GridPosition[] = [],
  figures: readonly GridPosition[] = [],
): readonly GridPosition[] {
  const crowded = new Set<string>();
  for (const figure of figures) {
    for (let dy = -SHIMMER_CLEAR_OF_FIGURES; dy <= SHIMMER_CLEAR_OF_FIGURES; dy += 1) {
      for (let dx = -SHIMMER_CLEAR_OF_FIGURES; dx <= SHIMMER_CLEAR_OF_FIGURES; dx += 1) {
        crowded.add(`${figure.x + dx},${figure.y + dy}`);
      }
    }
  }
  const free = grassWalkedTo(map, steps).filter(
    (tile) => !reserved.has(`${tile.x},${tile.y}`) && !crowded.has(`${tile.x},${tile.y}`),
  );
  const walked = trail.slice(Math.floor(trail.length * TRAIL_FROM_SHARE));
  if (walked.length === 0) {
    return free;
  }
  const from = trail.length - walked.length;
  const beside = free.filter((tile) => {
    let near = false;
    for (let index = 0; index < trail.length; index += 1) {
      const across = Math.abs(trail[index].x - tile.x);
      const down = Math.abs(trail[index].y - tile.y);
      // Off the whole trail, and in sight of the part of it past the landing's own screen.
      if (across + down < SHIMMER_OFF_TRAIL.least) {
        return false;
      }
      near ||= index >= from && across <= SHIMMER_OFF_TRAIL.across && down <= SHIMMER_OFF_TRAIL.down;
    }
    return near;
  });
  return beside.length > 0 ? beside : free;
}

/**
 * This raid's patch: one seat off the stream, and one of the rarest things
 * the place of that tile holds. Two rolls are spent whenever there is a seat
 * at all - the seat, and which of the kinds tied for rarest - so a seed lays
 * the same patch whatever the tables hold; a seat whose place has no wildlife
 * gives way to the next that has.
 */
export function layShimmer(
  seats: readonly GridPosition[],
  rarityAt: (tile: GridPosition) => ShimmerRarity | undefined,
  rng: Pick<SeededRng, 'int'>,
): Shimmer | undefined {
  if (seats.length === 0) {
    return undefined;
  }
  const first = rng.int(0, seats.length - 1);
  const pick = rng.int(0, 0xffff);
  for (let offset = 0; offset < seats.length; offset += 1) {
    const position = seats[(first + offset) % seats.length];
    const rarity = rarityAt(position);
    if (rarity) {
      return { position, speciesId: rarity.speciesIds[pick % rarity.speciesIds.length], level: rarity.level };
    }
  }
  return undefined;
}

/**
 * Whether what is in the patch is shiny: rolled once, as it is met, on the
 * raid's own shiny stream (`ActiveRunSession.shinyRng`), as every wild
 * Pokemon's is (`pokemon/shiny.ts`).
 */
export function rollShimmerShiny(rng: Pick<SeededRng, 'next'> = { next: Math.random }): boolean {
  return rng.next() < 1 / SHIMMER_SHINY_ODDS;
}
