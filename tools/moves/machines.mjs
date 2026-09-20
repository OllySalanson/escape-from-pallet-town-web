// What the shipped species can be taught from a machine in FireRed/LeafGreen.
//
//   node tools/moves/machines.mjs --harvest   # re-fetch from PokeAPI
//   node tools/moves/machines.mjs             # read the committed snapshot
//   node tools/moves/machines.mjs --move=aerial-ace
//
// The captain's standing rule is that nothing about the 151 is invented, so the
// per-species TM list in `src/game/pokemon/machineMoves.ts` is not written by
// hand: it is lifted out of `frlg-machines.json` beside this file, which is a
// committed PokeAPI snapshot in the same manner as `frlg-level-up-moves.json`.
//
// Two generation III traps apply here as well as to the level-up harvest, and
// both are handled below:
//
// - **A machine's number is per version group.** TM number 39 is Rock Tomb in
//   generation III and Swagger in generation II, so a machine row is only read
//   when its `version_group` is `firered-leafgreen`. Emerald agrees with FRLG
//   on the numbering; Ruby/Sapphire agree too, but nothing here relies on that.
// - **`past_values` describe the value *before* the change**, so a move's power,
//   accuracy and PP are taken as the earliest entry strictly later than
//   generation III, exactly as the level-up harvest does it - and an entry from
//   generation II is describing generation I, which is the trap Dig falls into:
//   its first row is `gold-silver` at 100 power, and generation III's Dig is the
//   60 on the `diamond-pearl` row below it.
//
// Physical against special is *not* taken from PokeAPI's `damage_class` here
// either: in generation III it is decided by the move's type, and the shipped
// `MoveBase`s follow `src/game/pokemon/moveTyping.test.ts`, which holds that
// rule against the whole catalogue.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const snapshotPath = join(here, 'frlg-machines.json');
const VERSION_GROUP = 'firered-leafgreen';

/**
 * The roster this game ships, read off the species snapshot beside this one
 * rather than typed here. It was a list of seventeen while seventeen were all
 * the game had; the 151 import (PR #143) made that stale, and a stale roster
 * here is a machine that quietly refuses a species the game now fields - which
 * is the one thing this snapshot exists to stop.
 */
const SHIPPED = JSON.parse(
  readFileSync(join(here, '..', 'species', 'frlg-species.json'), 'utf8'),
).species.map((species) => [species.name, species.dexId]);

const api = async (path) => {
  const response = await fetch(`https://pokeapi.co/api/v2/${path}`);
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  return response.json();
};

const GENERATION_NUMBER = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3, 'generation-iv': 4,
  'generation-v': 5, 'generation-vi': 6, 'generation-vii': 7, 'generation-viii': 8,
  'generation-ix': 9,
};

const generationOfVersionGroup = new Map();

const generationOf = async (versionGroup) => {
  if (!generationOfVersionGroup.has(versionGroup)) {
    const group = await api(`version-group/${versionGroup}`);
    generationOfVersionGroup.set(versionGroup, GENERATION_NUMBER[group.generation.name]);
  }
  return generationOfVersionGroup.get(versionGroup);
};

/**
 * A field as generation III had it. `past_values` records what a field was
 * *before* the listed version group changed it, so the generation III value is
 * the earliest entry **strictly later than generation III** that names the
 * field - and an entry from generation II or earlier is describing generation I
 * and must be skipped. Dig is the trap: its first `past_values` row is
 * `gold-silver` at 100 power, which is generation I's Dig; generation III's is
 * the 60 on the `diamond-pearl` row below it.
 */
const generationThreeValue = async (move, field) => {
  for (const entry of move.past_values ?? []) {
    if (entry[field] === null || entry[field] === undefined) {
      continue;
    }
    if ((await generationOf(entry.version_group.name)) > 3) {
      return entry[field];
    }
  }
  return move[field];
};

async function harvest() {
  const learners = new Map();
  const wanted = new Set();
  for (const [name, dexId] of SHIPPED) {
    const species = await api(`pokemon/${dexId}`);
    const taught = species.moves
      .filter((entry) =>
        entry.version_group_details.some(
          (detail) =>
            detail.version_group.name === VERSION_GROUP &&
            detail.move_learn_method.name === 'machine',
        ),
      )
      .map((entry) => entry.move.name)
      .sort();
    learners.set(name, taught);
    for (const move of taught) {
      wanted.add(move);
    }
    process.stderr.write(`${name}: ${taught.length}\n`);
  }

  const machines = {};
  for (const name of [...wanted].sort()) {
    const move = await api(`move/${name}`);
    const row = move.machines.find((entry) => entry.version_group.name === VERSION_GROUP);
    if (!row) {
      continue;
    }
    const machine = await api(row.machine.url.split('/api/v2/')[1]);
    machines[name] = {
      machine: machine.item.name.toUpperCase(),
      type: (move.past_types ?? [])[0]?.types?.[0]?.type?.name ?? move.type.name,
      power: await generationThreeValue(move, 'power'),
      accuracy: await generationThreeValue(move, 'accuracy'),
      pp: await generationThreeValue(move, 'pp'),
      damage_class: move.damage_class.name,
      priority: move.priority,
      ailment: move.meta?.ailment?.name ?? 'none',
      ailment_chance: move.meta?.ailment_chance ?? 0,
      flinch_chance: move.meta?.flinch_chance ?? 0,
      stat_chance: move.meta?.stat_chance ?? 0,
      crit_rate: move.meta?.crit_rate ?? 0,
      drain: move.meta?.drain ?? 0,
      min_hits: move.meta?.min_hits ?? null,
      max_hits: move.meta?.max_hits ?? null,
      effect_chance: move.effect_chance,
      stat_changes: move.stat_changes.map((change) => ({
        stat: change.stat.name,
        change: change.change,
      })),
      target: move.target.name,
    };
    process.stderr.write(`${machines[name].machine} ${name}\n`);
  }

  const snapshot = {
    source: `https://pokeapi.co/api/v2, version group ${VERSION_GROUP}`,
    harvested: new Date().toISOString().slice(0, 10),
    machines,
    learners: Object.fromEntries([...learners].map(([name, moves]) => [name, moves])),
  };
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 1)}\n`);
  process.stderr.write(`\nwrote ${snapshotPath}\n`);
  return snapshot;
}

const snapshot = process.argv.includes('--harvest')
  ? await harvest()
  : JSON.parse(readFileSync(snapshotPath, 'utf8'));

const wantedMove = process.argv.find((argument) => argument.startsWith('--move='))?.slice(7);
if (wantedMove) {
  const machine = snapshot.machines[wantedMove];
  console.log(`${machine?.machine ?? '(no machine)'} ${wantedMove}`);
  for (const [name, moves] of Object.entries(snapshot.learners)) {
    console.log(`  ${moves.includes(wantedMove) ? 'yes' : ' no'}  ${name}`);
  }
} else {
  const rows = Object.entries(snapshot.machines).map(([name, machine]) => ({
    name,
    ...machine,
    learners: Object.values(snapshot.learners).filter((moves) => moves.includes(name)).length,
  }));
  rows.sort((left, right) => left.machine.localeCompare(right.machine));
  console.log(`${rows.length} machines reach the shipped roster (${VERSION_GROUP}):`);
  for (const row of rows) {
    console.log(
      `  ${row.machine.padEnd(5)} ${row.name.padEnd(16)} ${String(row.type).padEnd(9)} ` +
        `pow ${String(row.power ?? '-').padStart(3)}  acc ${String(row.accuracy ?? '-').padStart(3)}  ` +
        `pp ${String(row.pp).padStart(2)}  ${row.learners}/${SHIPPED.length} learn it`,
    );
  }
}
