// The contact, sound, bite and punch flags for every move this game ships.
//
//   node tools/abilities/harvest-move-flags.mjs > tools/abilities/frlg-move-flags.json
//
// These four are the flags `MoveFlag` declares, and an ability is what finally
// reads one: Static asks whether the move that hit it made contact, and
// Soundproof asks whether the move coming in is a sound. They were declared on
// six moves and missing from every move older than them, which is invisible
// until something reads them.
//
// **The REST API does not serve move flags** - `/move/{name}` has no `flags`
// field at all - so this reads PokeAPI's own source tables instead, which is
// the same data the API is built from. One generation III caveat: these tables
// carry the *current* flag set and the contact flag has been revised since
// FireRed, so a move added later is checked against its generation III entry
// rather than trusted to this file.
import { createInterface } from 'node:readline';

const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const WANTED = new Set(['contact', 'punch', 'bite', 'sound']);

/** The moves `src/game/pokemon/moves.ts` ships, by PokeAPI identifier. */
const MOVES = [
  'tackle', 'growl', 'tail-whip', 'scratch', 'ember', 'water-gun', 'vine-whip',
  'poison-powder', 'sing', 'supersonic', 'thunder-wave', 'sleep-powder', 'razor-leaf',
  'scary-face', 'flamethrower', 'heat-wave', 'slash', 'wing-attack', 'gust',
  'feather-dance', 'bubble', 'hydro-pump', 'thunder-shock', 'thunderbolt', 'bite',
  'metal-claw', 'quick-attack', 'double-slap', 'double-edge', 'agility', 'smokescreen',
  'double-team', 'synthesis', 'solar-beam', 'body-slam', 'psybeam',
  'bullet-seed', 'ice-beam', 'iron-tail', 'dig', 'aerial-ace', 'rock-smash',
  'rain-dance',
];

const csv = async (name) => {
  const response = await fetch(`${CSV}/${name}.csv`);
  if (!response.ok) throw new Error(`could not fetch ${name}.csv`);
  const [header, ...lines] = (await response.text()).trim().split('\n');
  const columns = header.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
};

const flagNames = new Map((await csv('move_flags')).map((row) => [row.id, row.identifier]));
const moveIds = new Map((await csv('moves')).map((row) => [row.identifier, row.id]));
const byMove = new Map();
for (const row of await csv('move_flag_map')) {
  const flag = flagNames.get(row.move_flag_id);
  if (!WANTED.has(flag)) continue;
  byMove.set(row.move_id, [...(byMove.get(row.move_id) ?? []), flag]);
}

const rows = MOVES.map((name) => {
  const id = moveIds.get(name);
  if (!id) throw new Error(`unknown move ${name}`);
  return { name, flags: (byMove.get(id) ?? []).sort() };
});
process.stdout.write(`${JSON.stringify(rows, null, 1)}\n`);
