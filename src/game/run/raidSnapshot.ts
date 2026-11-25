import { Bag } from '../items/Bag';
import { Pokemon } from '../pokemon/Pokemon';
import { PokemonParty } from '../pokemon/PokemonParty';
import { deserializePokemon, serializePokemon, type SavedPokemon } from '../save/SaveManager';
import { HunterPack } from '../world/hunterPack';
import { RunManager } from './RunManager';
import { createSeededRng, seededRngPosition } from './rng';

/**
 * A raid in progress as plain JSON, and back: the whole of what a fight carries
 * through (`RaidCarriage`, the run session in it and everything that hangs off
 * that), so a raid can be written down mid-way and taken up again after a
 * reload, a crash or a tab the browser threw away (`run/raidResume.ts`).
 *
 * It walks the object graph rather than naming fields, so per-raid state added
 * to the session later is carried without anybody remembering to: plain
 * objects, arrays, `Map`s and `Set`s go as they are, and the few classes a raid
 * is made of are named below. Anything else - a function, a class nobody
 * registered, a loop - is refused with the path to it, so a test that writes a
 * real raid down fails the day something unwritable is added, rather than a
 * player losing a raid to it.
 *
 * A Pokemon is written once however many places hold it - the party, the secure
 * slot, the run manager's loadout and the partner are the same Pokemon - and
 * read back as one object, because the raid's endings find a deployed Pokemon by
 * being the same object (`RunManager.resolveSecureSlot`). It is written as the
 * save writes it, plus what only a raid moves: each move's PP and the kinds it
 * has been.
 */

/** One JSON value of the snapshot. */
export type SnapshotValue = null | boolean | number | string | SnapshotValue[] | { [key: string]: SnapshotValue };

export interface RaidSnapshotGraph {
  readonly root: SnapshotValue;
  readonly pokemon: readonly SnapshotPokemon[];
}

/** A Pokemon as the save writes it, with what a raid moves that a save never needs. */
export interface SnapshotPokemon extends SavedPokemon {
  readonly pp: readonly number[];
  readonly kindsBeen: readonly number[];
}

interface ClassEntry {
  readonly name: string;
  readonly type: abstract new (...args: never[]) => object;
  /** A blank instance the written fields are laid over. */
  readonly make: () => object;
  /** Fields rebuilt by `make` rather than written: caches and the like. */
  readonly transient?: readonly string[];
}

/** The classes a raid in progress is made of. */
const CLASSES: readonly ClassEntry[] = [
  { name: 'RunManager', type: RunManager, make: () => new RunManager() },
  { name: 'Bag', type: Bag, make: () => new Bag() },
  { name: 'PokemonParty', type: PokemonParty, make: () => new PokemonParty() },
  // The pack's path search is a cache over the map, rebuilt on demand.
  { name: 'HunterPack', type: HunterPack, make: () => new HunterPack([]), transient: ['search'] },
];

export class UnwritableRaidState extends Error {}

/**
 * Writes `value` down. Throws `UnwritableRaidState`, naming the path, for
 * anything it cannot. An object in `named` is written as its name alone, for
 * something written down elsewhere - the raid's plan, written once a raid - and
 * read back from `decodeRaidSnapshot`'s `named`.
 */
export function encodeRaidSnapshot(value: unknown, named: ReadonlyMap<object, string> = new Map()): RaidSnapshotGraph {
  const pokemon: SnapshotPokemon[] = [];
  const pokemonIndex = new Map<Pokemon, number>();
  const walking = new Set<object>();

  const encode = (current: unknown, path: string): SnapshotValue => {
    if (current === undefined) {
      return { $u: 1 };
    }
    if (current === null || typeof current === 'boolean' || typeof current === 'string') {
      return current;
    }
    if (typeof current === 'number') {
      return Number.isFinite(current) ? current : { $n: String(current) };
    }
    if (typeof current !== 'object') {
      throw new UnwritableRaidState(`${path} is a ${typeof current}, which a raid cannot be written down with.`);
    }
    if (current instanceof Pokemon) {
      let index = pokemonIndex.get(current);
      if (index === undefined) {
        index = pokemon.length;
        pokemonIndex.set(current, index);
        pokemon.push({
          ...serializePokemon(current),
          pp: current.moves.map((move) => move.pp),
          kindsBeen: current.kindsBeen,
        });
      }
      return { $p: index };
    }
    const name = named.get(current);
    if (name !== undefined) {
      return { $ref: name };
    }
    const position = seededRngPosition(current as never);
    if (position !== null) {
      return { $rng: position };
    }
    if (walking.has(current)) {
      throw new UnwritableRaidState(`${path} refers back to itself.`);
    }
    walking.add(current);
    try {
      if (Array.isArray(current)) {
        return current.map((item, index) => encode(item, `${path}[${index}]`));
      }
      if (current instanceof Map) {
        return { $map: [...current].map(([key, item], index) => [encode(key, `${path}<key ${index}>`), encode(item, `${path}<${String(key)}>`)]) };
      }
      if (current instanceof Set) {
        return { $set: [...current].map((item, index) => encode(item, `${path}{${index}}`)) };
      }
      const prototype = Object.getPrototypeOf(current) as object | null;
      if (prototype === Object.prototype || prototype === null) {
        const fields = encodeFields(current as Record<string, unknown>, path, [], encode);
        return Object.keys(fields).some((key) => key.startsWith('$')) ? { $o: fields } : fields;
      }
      const entry = CLASSES.find((each) => prototype === each.type.prototype);
      if (!entry) {
        const kind = (current as { constructor?: { name?: string } }).constructor?.name ?? 'object';
        throw new UnwritableRaidState(`${path} is a ${kind}, which nobody has said how to write down (raidSnapshot.ts, CLASSES).`);
      }
      return { $c: entry.name, f: encodeFields(current as Record<string, unknown>, path, entry.transient ?? [], encode) };
    } finally {
      walking.delete(current);
    }
  };

  const root = encode(value, 'raid');
  return { root, pokemon };
}

function encodeFields(
  record: Record<string, unknown>,
  path: string,
  transient: readonly string[],
  encode: (value: unknown, path: string) => SnapshotValue,
): { [key: string]: SnapshotValue } {
  const fields: { [key: string]: SnapshotValue } = {};
  for (const key of Object.keys(record)) {
    if (!transient.includes(key)) {
      fields[key] = encode(record[key], `${path}.${key}`);
    }
  }
  return fields;
}

/**
 * Reads a written raid back. Throws on anything it does not recognise, because
 * a raid half read back is worse than one settled as abandoned.
 */
export function decodeRaidSnapshot(graph: RaidSnapshotGraph, named: Readonly<Record<string, unknown>> = {}): unknown {
  const pokemon = graph.pokemon.map((saved, index) => {
    const restored = deserializePokemon(saved);
    if (!restored) {
      throw new Error(`Pokemon ${index} of the raid could not be read back.`);
    }
    saved.pp.forEach((pp, move) => restored.moves[move]?.setPp(pp));
    restored.rememberKinds(saved.kindsBeen);
    return restored;
  });

  const decode = (value: SnapshotValue): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(decode);
    }
    if ('$u' in value) {
      return undefined;
    }
    if ('$ref' in value) {
      const name = JSON.stringify(value.$ref);
      if (typeof value.$ref !== 'string' || !(value.$ref in named)) {
        throw new Error(`The raid names ${name}, which was not read back with it.`);
      }
      return named[value.$ref];
    }
    if ('$n' in value) {
      return Number(value.$n);
    }
    if ('$p' in value) {
      const found = pokemon[value.$p as number];
      if (!found) {
        throw new Error(`The raid names Pokemon ${JSON.stringify(value.$p)}, which it never wrote.`);
      }
      return found;
    }
    if ('$rng' in value) {
      // The seed is spent: a stream taken up from a position is that stream.
      return createSeededRng(0, value.$rng as number);
    }
    if ('$map' in value) {
      return new Map((value.$map as SnapshotValue[][]).map(([key, item]) => [decode(key), decode(item)]));
    }
    if ('$set' in value) {
      return new Set((value.$set as SnapshotValue[]).map(decode));
    }
    if ('$o' in value) {
      return decodeFields(value.$o as { [key: string]: SnapshotValue }, {}, decode);
    }
    if ('$c' in value) {
      const entry = CLASSES.find((each) => each.name === value.$c);
      if (!entry) {
        throw new Error(`The raid names a ${JSON.stringify(value.$c)}, which this game does not know.`);
      }
      return decodeFields(value.f as { [key: string]: SnapshotValue }, entry.make(), decode);
    }
    return decodeFields(value, {}, decode);
  };

  return decode(graph.root);
}

function decodeFields(
  fields: { [key: string]: SnapshotValue },
  into: object,
  decode: (value: SnapshotValue) => unknown,
): object {
  const target = into as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    target[key] = decode(value);
  }
  return into;
}
