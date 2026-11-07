import { hasAbility, hasType, knows, PokemonType, roller, type PokemonTraits } from './traits';

/**
 * THE DIG (the harbour arenas plan, section 3.6): this game's own, on a roped
 * patch of THE BEACH eight squares by five. One of the player's Pokémon digs;
 * there are ten digs, and after each a ping says how near the nearest buried
 * thing is - HOT, WARM or COLD, as FireRed's Itemfinder pings - and what is
 * found is kept.
 *
 * What the digger is decides how it digs, read off facts the game holds
 * (`traits.ts`):
 *
 * - **A Ground type** turns over a plus - the square and the four beside it -
 *   instead of one square.
 * - **Knowing Dig** is two more digs.
 * - **Pickup** (FireRed's field rule: picking things up after a battle) turns
 *   a little something up out of an empty dig, one time in three.
 * - **Keen Eye** glints a buried thing in one of the eight squares round a
 *   dig.
 * - **Sand Veil** never has loose sand cave in on it. Loose sand is drawn
 *   darker; a dig into it caves in half the time, and the square is not dug.
 *
 * Pure and Phaser-free: the patch is laid from a seed, and a dig is a value
 * in, a value out.
 */

export const DIG_WIDTH = 8;
export const DIG_HEIGHT = 5;
/** Digs a game, before Dig. */
export const DIGS = 10;
/** Dig, the move, is two more. */
export const DIG_MOVE_BONUS = 2;
/** How many squares of loose sand a patch has. */
export const LOOSE_SQUARES = 7;
/** How often a dig into loose sand caves in. */
export const CAVE_IN_CHANCE = 0.5;
/** How often Pickup turns something up out of an empty square. */
export const PICKUP_CHANCE = 1 / 3;
/** How far Keen Eye sees, in squares: the eight round the dig. */
export const KEEN_EYE_REACH = 1;

/** What can be buried, and what each is worth to the score. */
export type BuriedKind = 'berry' | 'shell' | 'ornament';
export const BURIED_POINTS: Readonly<Record<BuriedKind, number>> = { berry: 10, shell: 5, ornament: 30 };

/** The berries a patch hides, this game's seven. */
export const DIG_BERRIES = [
  'oran-berry',
  'sitrus-berry',
  'pecha-berry',
  'cheri-berry',
  'rawst-berry',
  'chesto-berry',
  'aspear-berry',
] as const;

/** The furniture a patch may hide: Emerald's own SAND ORNAMENT. */
export const DIG_ORNAMENT = 'sand-ornament';

export interface Buried {
  readonly x: number;
  readonly y: number;
  readonly kind: BuriedKind;
  /** The item it is, for a berry or the ornament; a shell is only points. */
  readonly itemId: string | null;
}

export type Ping = 'found' | 'hot' | 'warm' | 'cold';

export interface DugSquare {
  readonly x: number;
  readonly y: number;
  /** Caved in rather than dug: loose sand fell back into it. */
  readonly caved: boolean;
}

export interface DigGame {
  readonly digger: PokemonTraits;
  readonly buried: readonly Buried[];
  readonly loose: readonly { readonly x: number; readonly y: number }[];
  readonly dug: readonly DugSquare[];
  readonly found: readonly Buried[];
  readonly digsLeft: number;
  readonly score: number;
  /** The last dig's ping, and the square it was made from. */
  readonly ping: { readonly x: number; readonly y: number; readonly ping: Ping } | null;
  /** Keen Eye's glint after the last dig, if it saw anything. */
  readonly glint: { readonly x: number; readonly y: number } | null;
  readonly over: boolean;
  readonly seed: number;
}

export type DigEvent =
  | { readonly kind: 'found'; readonly what: Buried; readonly pickup: boolean }
  | { readonly kind: 'caved'; readonly x: number; readonly y: number }
  | { readonly kind: 'ping'; readonly ping: Ping };

/** Whether the digger turns over a plus. */
export const digsAPlus = (digger: PokemonTraits): boolean => hasType(digger, PokemonType.Ground);

/** How many digs the digger has. */
export function digsFor(digger: PokemonTraits): number {
  return DIGS + (knows(digger, 'dig') ? DIG_MOVE_BONUS : 0);
}

/**
 * A patch laid from a seed: six things buried - three berries, two shells and,
 * one game in three, the SAND ORNAMENT in place of a shell - and the loose sand.
 */
export function startDig(digger: PokemonTraits, seed: number): DigGame {
  const roll = roller(seed);
  const squares = Array.from({ length: DIG_WIDTH * DIG_HEIGHT }, (_square, index) => index);
  for (let index = squares.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [squares[index], squares[swap]] = [squares[swap], squares[index]];
  }
  const cell = (index: number) => ({ x: index % DIG_WIDTH, y: Math.floor(index / DIG_WIDTH) });
  const ornament = roll() < 1 / 3;
  const kinds: BuriedKind[] = ['berry', 'berry', 'berry', 'shell', ornament ? 'ornament' : 'shell', 'shell'];
  const buried = kinds.map((kind, index): Buried => ({
    ...cell(squares[index]),
    kind,
    itemId: kind === 'berry' ? DIG_BERRIES[Math.floor(roll() * DIG_BERRIES.length)] : kind === 'ornament' ? DIG_ORNAMENT : null,
  }));
  const loose = squares.slice(kinds.length, kinds.length + LOOSE_SQUARES).map(cell);
  return {
    digger,
    buried,
    loose,
    dug: [],
    found: [],
    digsLeft: digsFor(digger),
    score: 0,
    ping: null,
    glint: null,
    over: false,
    seed: Math.floor(roll() * 2 ** 32) >>> 0,
  };
}

const same = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => a.x === b.x && a.y === b.y;
const inPatch = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < DIG_WIDTH && y < DIG_HEIGHT;

/** The squares a dig at (x, y) turns over: the one, or a plus for a Ground type. */
export function digShape(digger: PokemonTraits, x: number, y: number): readonly { readonly x: number; readonly y: number }[] {
  const shape = digsAPlus(digger)
    ? [
        { x, y },
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ]
    : [{ x, y }];
  return shape.filter((square) => inPatch(square.x, square.y));
}

/** Whether a square has been dug, for good (a cave-in fills a square back in). */
export function isDug(game: DigGame, x: number, y: number): boolean {
  return game.dug.some((square) => square.x === x && square.y === y && !square.caved);
}

/** Whether a square is loose sand. */
export function isLoose(game: DigGame, x: number, y: number): boolean {
  return game.loose.some((square) => square.x === x && square.y === y);
}

function stillBuried(game: Pick<DigGame, 'buried' | 'found'>): readonly Buried[] {
  return game.buried.filter((thing) => !game.found.some((found) => same(found, thing)));
}

/** HOT is a square away, WARM two, COLD further, by steps across the sand. */
export function pingFor(distance: number): Ping {
  return distance === 0 ? 'found' : distance === 1 ? 'hot' : distance === 2 ? 'warm' : 'cold';
}

/** A dig at (x, y), and what came of it. */
export function digAt(game: DigGame, x: number, y: number): { readonly game: DigGame; readonly events: readonly DigEvent[] } {
  if (game.over || !inPatch(x, y) || isDug(game, x, y)) {
    return { game, events: [] };
  }
  let seed = game.seed;
  const roll = (): number => {
    seed = (Math.imul(1103515245, seed) + 24691) >>> 0;
    return (seed >>> 8) / 2 ** 24;
  };
  const events: DigEvent[] = [];
  const dug: DugSquare[] = [...game.dug];
  const found: Buried[] = [...game.found];
  let score = game.score;
  let anything = false;
  for (const square of digShape(game.digger, x, y)) {
    if (isDug({ ...game, dug }, square.x, square.y)) continue;
    if (isLoose(game, square.x, square.y) && !hasAbility(game.digger, 'sand-veil') && roll() < CAVE_IN_CHANCE) {
      dug.push({ ...square, caved: true });
      events.push({ kind: 'caved', ...square });
      continue;
    }
    dug.push({ ...square, caved: false });
    const thing = game.buried.find((buried) => same(buried, square) && !found.some((other) => same(other, buried)));
    if (thing) {
      found.push(thing);
      score += BURIED_POINTS[thing.kind];
      anything = true;
      events.push({ kind: 'found', what: thing, pickup: false });
    }
  }
  // Pickup: an empty dig now and then has a little something in it after all.
  if (!anything && hasAbility(game.digger, 'pickup') && !events.some((event) => event.kind === 'caved' && same(event, { x, y })) && roll() < PICKUP_CHANCE) {
    const berry: Buried = { x, y, kind: 'berry', itemId: DIG_BERRIES[Math.floor(roll() * DIG_BERRIES.length)] };
    score += BURIED_POINTS.berry;
    events.push({ kind: 'found', what: berry, pickup: true });
    found.push({ ...berry, x: -1 - found.length, y: -1 });
  }
  const left = stillBuried({ buried: game.buried, found });
  const nearest = left.reduce((best, thing) => Math.min(best, Math.abs(thing.x - x) + Math.abs(thing.y - y)), Number.POSITIVE_INFINITY);
  const ping: Ping = anything ? 'found' : pingFor(Number.isFinite(nearest) ? Math.max(1, nearest) : 99);
  events.push({ kind: 'ping', ping });
  let glint: DigGame['glint'] = null;
  if (hasAbility(game.digger, 'keen-eye')) {
    const seen = left
      .map((thing) => ({ thing, far: Math.max(Math.abs(thing.x - x), Math.abs(thing.y - y)) }))
      .filter(({ far }) => far <= KEEN_EYE_REACH)
      .sort((a, b) => a.far - b.far)[0];
    if (seen) glint = { x: seen.thing.x, y: seen.thing.y };
  }
  const digsLeft = game.digsLeft - 1;
  return {
    game: {
      ...game,
      dug,
      found,
      score,
      digsLeft,
      ping: { x, y, ping },
      glint,
      over: digsLeft <= 0 || left.length === 0,
      seed,
    },
    events,
  };
}

/** What a digger is like, in a few words, for the choosing screen. */
export function diggerNotes(digger: PokemonTraits): readonly string[] {
  const notes: string[] = [];
  if (digsAPlus(digger)) notes.push('Digs five squares');
  if (knows(digger, 'dig')) notes.push(`Knows DIG: ${DIGS + DIG_MOVE_BONUS} digs`);
  if (hasAbility(digger, 'pickup')) notes.push('Picks things up');
  if (hasAbility(digger, 'keen-eye')) notes.push('Keen eye');
  if (hasAbility(digger, 'sand-veil')) notes.push('Sand never caves in');
  if (notes.length === 0) notes.push('One square a dig');
  return notes;
}

/** What the game found that goes home: the berries and the ornament, by item id. */
export function digItems(game: DigGame): readonly string[] {
  return game.found.flatMap((thing) => (thing.itemId ? [thing.itemId] : []));
}
