import { advanceDerby, bestLines, derbyScore, playerPlace, startDerby, toNextCorner, type DerbyEntrant, type DerbyRace } from './derby';
import { DIG_HEIGHT, DIG_WIDTH, digAt, digShape, isDug, isLoose, startDig, type DigGame } from './dig';
import { hasAbility, roller, type PokemonTraits } from './traits';

/**
 * Model players for the promenade's outdoor games, for their tests and for the
 * measuring tool (`tools/minigames/outdoor.mts`): how the tickets were set and
 * how "which Pokémon does better" is held as numbers, not argued.
 */

/**
 * A race run by a model rider: the quicker line at each fork, and a sprint
 * tapped on the straights whenever there is breath for it - eased off into the
 * corners `skill` of the time - and, at `skill` 1, never wasted.
 */
export function modelDerby(
  racer: PokemonTraits,
  field: readonly DerbyEntrant[],
  wet: boolean,
  seed: number,
  skill: number,
): DerbyRace {
  let race = startDerby({ name: 'YOU', racer }, field, wet, seed);
  const lines = bestLines(racer, wet);
  const roll = roller(seed ^ 0x5bd1e995);
  let careless = false;
  let lastCorner = Number.POSITIVE_INFINITY;
  while (!race.over) {
    const me = race.runners[0];
    const corner = toNextCorner(me);
    // A new corner coming up: does the rider remember to ease off for it?
    if (corner > lastCorner + 0.5) careless = roll() > skill;
    lastCorner = corner;
    const tap = me.finishedMs === null && me.stamina > 150 && (corner > 1.6 || careless) && roll() < 0.5;
    race = advanceDerby(race, 1000 / 60, { tap, first: lines.first, second: lines.second });
  }
  return race;
}

/** A race's place for the model rider. */
export function modelPlace(racer: PokemonTraits, field: readonly DerbyEntrant[], wet: boolean, seed: number, skill: number): number {
  const race = modelDerby(racer, field, wet, seed, skill);
  return playerPlace(race) ?? race.runners.length;
}

export { derbyScore };

/**
 * A dig played by a model digger: it digs where the pings so far say a thing
 * could be - a square as far from a HOT, WARM or COLD ping as that ping says -
 * Keen Eye's glint first, and loose sand last unless it is Sand Veil.
 */
export function modelDig(digger: PokemonTraits, seed: number): DigGame {
  let game = startDig(digger, seed);
  const roll = roller(seed ^ 0x2545f491);
  const pings: { x: number; y: number; far: number; at: number }[] = [];
  let digs = 0;
  while (!game.over) {
    const candidates: { x: number; y: number; weight: number }[] = [];
    for (let y = 0; y < DIG_HEIGHT; y += 1) {
      for (let x = 0; x < DIG_WIDTH; x += 1) {
        if (isDug(game, x, y)) continue;
        const fresh = digShape(digger, x, y).filter((square) => !isDug(game, square.x, square.y)).length;
        let weight = fresh;
        for (const ping of pings) {
          // Pings made before something was found are stale; trust the newest most.
          const away = Math.abs(ping.x - x) + Math.abs(ping.y - y);
          const trust = ping.at === digs - 1 ? 3 : 1;
          if (ping.far <= 2) weight += away === ping.far ? 4 * trust : away < ping.far ? -2 * trust : 0;
          else weight += away >= 3 ? trust : -3 * trust;
        }
        if (game.glint && game.glint.x === x && game.glint.y === y) weight += 50;
        if (isLoose(game, x, y) && !hasAbility(digger, 'sand-veil')) weight -= 3;
        candidates.push({ x, y, weight: weight + roll() * 0.5 });
      }
    }
    candidates.sort((a, b) => b.weight - a.weight);
    const target = candidates[0];
    if (!target) break;
    const result = digAt(game, target.x, target.y);
    game = result.game;
    const ping = game.ping;
    if (ping && ping.ping !== 'found') {
      pings.push({ x: ping.x, y: ping.y, far: ping.ping === 'hot' ? 1 : ping.ping === 'warm' ? 2 : 3, at: digs });
    }
    digs += 1;
  }
  return game;
}
