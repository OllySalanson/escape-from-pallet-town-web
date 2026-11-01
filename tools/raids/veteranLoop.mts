// What a raid pays, played three ways over the real generator on the real map,
// so "the best play is to leave" is a number rather than a feeling.
//
//   npx vite-node tools/raids/veteranLoop.mts [-- --seeds=200 --insertion=greystone-vale]
//
// `walk-out` goes straight to the nearest open way out, taking only what lies on
// that walk. `veteran` is the loop the character tests found: everything within
// 25 steps of the landing, then the nearest way out. `wider` is the same within
// 70 steps, leaving the stake where it lies. `stay` goes after the raid's
// stake (`world/raidStake.ts`), picks up what lies within 8 steps of that walk and
// then leaves by the nearest way out; on a build with no stake it goes after the
// nearest money, which is what staying used to mean.
//
// Steps are on open ground at walking pace and a fight costs nothing here, so a
// person is slower than every line of this. `value` prices goods at Bill's shelf
// and a material at ₽100, which is only a common scale to add them up on. A cycle
// is the raid plus the half a minute from the result screen back over the rail
// that the character tests measured.
import { STEP_DURATION_MS } from '../../src/game/movement/stepClock';
import { TRADER_STOCK } from '../../src/game/hub/trader';
import { MATERIAL_IDS, type ItemId } from '../../src/game/items';
import { generateRunPlan, requireInsertion, type RunInsertionId } from '../../src/game/run/runGeneration';
import { stepDistances } from '../../src/game/world/mapStructure';
import type { WorldLoot } from '../../src/game/world/loot';
import { getWorldMap } from '../../src/game/worldMap';

const option = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const seeds = Number(option('seeds') ?? 200);
const insertionId = (option('insertion') ?? 'greystone-vale') as RunInsertionId;
const REST_OF_THE_CYCLE_S = 28;
const VETERAN_REACH = 25;
/** A veteran who has noticed the near ground is bare and goes a bit further for it. */
const WIDER_REACH = 70;
const STAY_REACH = 8;

const insertion = requireInsertion(insertionId);
const map = getWorldMap(insertion.mapId, []);
const links = map.links;

const fieldFrom = (tile: { readonly x: number; readonly y: number }) => stepDistances(map.collision, tile, undefined, links);
const walk = (field: readonly Int32Array[], tile: { readonly x: number; readonly y: number }): number => field[tile.y]?.[tile.x] ?? -1;

const worth = (itemId: ItemId, quantity: number): number => {
  if (itemId === 'money') {
    return quantity;
  }
  const shelf = TRADER_STOCK.find((item) => item.itemId === itemId);
  if (shelf) {
    return shelf.price * quantity;
  }
  return (MATERIAL_IDS as readonly string[]).includes(itemId) ? 100 * quantity : 50 * quantity;
};

interface Outcome {
  readonly steps: number;
  readonly pieces: number;
  readonly money: number;
  readonly value: number;
}

const openExits = (plan: ReturnType<typeof generateRunPlan>) =>
  plan.extractionPoints.filter(
    (point) => point.mapId === insertion.mapId && (point.requirement?.kind === 'always' || (point.requirement === undefined && point.unlockAtMs === 0)),
  );

/** Walks a list of stops in order, then the nearest open way out from the last. */
function tour(start: { readonly x: number; readonly y: number }, stops: readonly WorldLoot[], plan: ReturnType<typeof generateRunPlan>): Outcome {
  let at = start;
  let steps = 0;
  for (const stop of stops) {
    steps += Math.max(0, walk(fieldFrom(at), stop.position));
    at = stop.position;
  }
  const field = fieldFrom(at);
  const out = Math.min(...openExits(plan).map((exit) => walk(field, exit.position)).filter((each) => each >= 0));
  return {
    steps: steps + out,
    pieces: stops.length,
    money: stops.filter((stop) => stop.itemId === 'money').reduce((sum, stop) => sum + stop.quantity, 0),
    value: stops.reduce((sum, stop) => sum + worth(stop.itemId, stop.quantity), 0),
  };
}

const nearestFirst = (start: { readonly x: number; readonly y: number }, pieces: readonly WorldLoot[]): WorldLoot[] => {
  const left = [...pieces];
  const order: WorldLoot[] = [];
  let at = start;
  while (left.length > 0) {
    const field = fieldFrom(at);
    left.sort((one, other) => walk(field, one.position) - walk(field, other.position));
    const next = left.shift()!;
    order.push(next);
    at = next.position;
  }
  return order;
};

const totals = new Map<string, { steps: number; pieces: number; money: number; value: number; empty: number; pastHunter: number; count: number }>();
const note = (policy: string, outcome: Outcome, spawnDelayMs: number): void => {
  const row = totals.get(policy) ?? { steps: 0, pieces: 0, money: 0, value: 0, empty: 0, pastHunter: 0, count: 0 };
  row.steps += outcome.steps;
  row.pieces += outcome.pieces;
  row.money += outcome.money;
  row.value += outcome.value;
  row.empty += outcome.pieces === 0 ? 1 : 0;
  row.pastHunter += outcome.steps * STEP_DURATION_MS >= spawnDelayMs ? 1 : 0;
  row.count += 1;
  totals.set(policy, row);
};

const landing = fieldFrom(insertion.position);
let stakeWalk = 0;
let stakeOut = 0;
let stakes = 0;
for (let seed = 1; seed <= seeds; seed += 1) {
  const plan = generateRunPlan(seed, undefined, insertionId, undefined);
  const pieces = (plan.loot[insertion.mapId] ?? []).filter((piece) => walk(landing, piece.position) >= 0);
  const walkOutExit = Math.min(...openExits(plan).map((exit) => walk(landing, exit.position)).filter((each) => each >= 0));
  const onTheWayOut = pieces.filter((piece) => {
    const field = fieldFrom(piece.position);
    return walk(landing, piece.position) + Math.min(...openExits(plan).map((exit) => walk(field, exit.position)).filter((each) => each >= 0)) <= walkOutExit;
  });
  note('walk-out', tour(insertion.position, onTheWayOut, plan), plan.hunter.spawnDelayMs);
  const within = pieces.filter((piece) => walk(landing, piece.position) <= VETERAN_REACH);
  note('veteran', tour(insertion.position, nearestFirst(insertion.position, within), plan), plan.hunter.spawnDelayMs);
  const wider = pieces.filter((piece) => walk(landing, piece.position) <= WIDER_REACH && !piece.id.endsWith('/stake'));
  note('wider', tour(insertion.position, nearestFirst(insertion.position, wider), plan), plan.hunter.spawnDelayMs);
  const target =
    pieces.find((piece) => piece.id.endsWith('/stake')) ??
    [...pieces].filter((piece) => piece.itemId === 'money').sort((one, other) => walk(landing, one.position) - walk(landing, other.position))[0];
  if (target) {
    const fromTarget = fieldFrom(target.position);
    const direct = walk(landing, target.position);
    const beside = pieces.filter(
      (piece) => piece !== target && walk(landing, piece.position) + walk(fromTarget, piece.position) <= direct + STAY_REACH * 2,
    );
    const stay = tour(insertion.position, [...nearestFirst(insertion.position, beside).filter((piece) => walk(landing, piece.position) <= direct), target], plan);
    note('stay', stay, plan.hunter.spawnDelayMs);
    stakeWalk += direct;
    const out = Math.min(...openExits(plan).map((exit) => walk(fromTarget, exit.position)).filter((each) => each >= 0));
    stakeOut += out;
    stakes += 1;
  }
}

console.log(`${insertion.label}, ${seeds} seeds. Walking only: no fights, nothing read, nobody hunted.`);
console.log(`The target of 'stay': ${(stakeWalk / Math.max(1, stakes)).toFixed(0)} steps from the landing, ${(stakeOut / Math.max(1, stakes)).toFixed(0)} from the nearest way out.`);
console.log('policy    steps  raid s  cycle s  pieces  money  value  value/min  empty  past 1st hunter');
for (const [policy, row] of totals) {
  const raidSeconds = (row.steps / row.count) * (STEP_DURATION_MS / 1000);
  const cycle = raidSeconds + REST_OF_THE_CYCLE_S;
  const value = row.value / row.count;
  console.log(
    `${policy.padEnd(9)} ${(row.steps / row.count).toFixed(0).padStart(5)} ${raidSeconds.toFixed(1).padStart(7)} ${cycle.toFixed(1).padStart(8)} ${(row.pieces / row.count).toFixed(1).padStart(7)} ${(row.money / row.count).toFixed(0).padStart(6)} ${value.toFixed(0).padStart(6)} ${((value / cycle) * 60).toFixed(0).padStart(10)} ${`${Math.round((row.empty / row.count) * 100)}%`.padStart(6)} ${`${Math.round((row.pastHunter / row.count) * 100)}%`.padStart(16)}`,
  );
}
