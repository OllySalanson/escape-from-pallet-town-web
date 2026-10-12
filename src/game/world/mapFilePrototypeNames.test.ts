import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { makeInside } from '../maker/areas';
import { BERRY_IDS } from './berries';
import { readMapFile, type MapFile } from './mapFile';
import { POKEMON_ICON_ORDER } from '../pokemon/generated/pokemonIcons';

/**
 * A map file is a stranger's text, and every name in it that picks something
 * out of one of the game's tables must be one of that table's own: `in`
 * answered yes for `constructor`, `toString` and every other name a plain
 * object inherits, so one anonymous submission blanked the reviewer's queue
 * and a hidden `wildlife` crashed the first tall-grass step (red team F1).
 */
const INHERITED = [...Object.getOwnPropertyNames(Object.prototype), '__proto__'];

type Json = Record<string, unknown> & { [key: string]: unknown };

function base(): Json {
  const inside = makeInside(sampleLane as unknown as MapFile, 0);
  if (!inside.made) {
    throw new Error(inside.reason);
  }
  return JSON.parse(
    JSON.stringify({
      ...inside.file,
      berryTrees: [{ x: 5, y: 5, berry: BERRY_IDS[0] }],
      pokemon: [{ x: 6, y: 6, species: POKEMON_ICON_ORDER[0] }],
      doors: [{ kind: 'cut-tree', x: 7, y: 7, width: 1, height: 1 }],
    }),
  ) as Json;
}

/** Every field of a file whose value is a name out of one of the game's lists. */
const FIELDS: Record<string, (file: Json, name: string) => void> = {
  wildlife: (file, name) => (file.wildlife = name),
  'building kind': (file, name) => ((file.buildings as Json[])[0].kind = name),
  'furniture kind': (file, name) => (((file.areas as Json[])[0].buildings as Json[])[0].kind = name),
  'area kind': (file, name) => ((file.areas as Json[])[0].kind = name),
  'area style': (file, name) => ((file.areas as Json[])[0].style = name),
  'link facing': (file, name) => ((((file.links as Json[])[0].ends as Json[])[0]).toward = name),
  'link look': (file, name) => ((((file.links as Json[])[0].ends as Json[])[0]).look = name),
  'exit opening': (file, name) => (((file.exits as Json[])[0].opens as Json).when = name),
  'person look': (file, name) => ((file.people as Json[])[0].look = name),
  'person facing': (file, name) => ((file.people as Json[])[0].facing = name),
  'landmark kind': (file, name) => ((file.landmarks as Json[])[0].kind = name),
  'district wildlife': (file, name) => ((file.districts as Json[])[0].wildlife = name),
  'trainer team': (file, name) => ((file.trainers as Json[])[0].team = name),
  'trainer look': (file, name) => ((file.trainers as Json[])[0].look = name),
  'trainer facing': (file, name) => ((file.trainers as Json[])[0].facing = name),
  berry: (file, name) => ((file.berryTrees as Json[])[0].berry = name),
  'pokemon species': (file, name) => ((file.pokemon as Json[])[0].species = name),
  'door kind': (file, name) => ((file.doors as Json[])[0].kind = name),
};

describe('a map file that names something the game does not have', () => {
  it('starts from a file the game reads, so each refusal below is the name alone', () => {
    const file = base();
    expect((file.areas as Json[])[0].buildings).not.toHaveLength(0);
    expect(readMapFile(file)).toMatchObject({ ok: true });
  });

  for (const [field, set] of Object.entries(FIELDS)) {
    it(`is refused, never read and never thrown on, for an inherited ${field}`, () => {
      for (const name of INHERITED) {
        for (const draft of [false, true]) {
          const file = base();
          set(file, name);
          let reading: ReturnType<typeof readMapFile> | undefined;
          expect(() => (reading = readMapFile(file, { draft })), `${field} = ${name}`).not.toThrow();
          expect(reading?.ok, `${field} = ${name}${draft ? ' (draft)' : ''}`).toBe(false);
        }
      }
    });
  }
});
