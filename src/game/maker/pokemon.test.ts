import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_SPECIES } from '../pokemon/species';
import {
  POKEMON_ICON_ORDER,
  POKEMON_ICON_SHEET,
  POKEMON_ICON_SOLES,
} from '../pokemon/generated/pokemonIcons';
import { decodePng } from '../testing/pngPixels';
import { buildPlayerMap, readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { pokemonCry, pokemonIconFrames } from '../world/pokemonFigures';
import { blankMap, extendMap, paint, placeSpot, rectangle, updateThing } from './draft';

const sheet = decodePng(
  readFileSync(new URL(`../../../public/${POKEMON_ICON_SHEET.imagePath}`, import.meta.url)),
);

/** A 30x20 map with a drop-in on the west and an exit on the east of a one-tile gap. */
function gapMap(): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Pokemon'), maker: 'Tester' };
  file = paint(
    file,
    rectangle({ x: 15, y: 0 }, { x: 15, y: 19 }).filter((tile) => tile.y !== 10),
    'T',
  );
  for (const [kind, at] of [
    ['drop-in', { x: 5, y: 10 }],
    ['exit', { x: 25, y: 10 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    file = outcome.placed ? outcome.file : file;
  }
  return file;
}

function withPokemon(file: MapFile, at: { x: number; y: number }, species: string): MapFile {
  const outcome = placeSpot(file, 'pokemon', at);
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return updateThing(outcome.file, outcome.thing, { species });
}

describe('the Pokemon a map maker can stand in the world', () => {
  // The owner on the palette board, 2026-10-10: "only include Pokémon that we
  // have in the game, and all of the Pokémon that are in the game".
  it('are every species the game has, and none it does not, in national-dex order', () => {
    const game = [...ALL_SPECIES].sort((a, b) => a.dexId - b.dexId).map((species) => species.id);
    expect([...POKEMON_ICON_ORDER]).toEqual(game);
  });

  it('each have two drawn frames on the icon sheet, feet where the table says', () => {
    expect([sheet.width, sheet.height]).toEqual([
      POKEMON_ICON_SHEET.columns * POKEMON_ICON_SHEET.frameSize,
      POKEMON_ICON_SHEET.rows * POKEMON_ICON_SHEET.frameSize,
    ]);
    const size = POKEMON_ICON_SHEET.frameSize;
    POKEMON_ICON_ORDER.forEach((species, index) => {
      let lowest = -1;
      for (const frame of pokemonIconFrames(species)) {
        const left = (frame % POKEMON_ICON_SHEET.columns) * size;
        const top = Math.floor(frame / POKEMON_ICON_SHEET.columns) * size;
        let ink = 0;
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            if (sheet.at(left + x, top + y)[3] > 0) {
              ink += 1;
              lowest = Math.max(lowest, y);
            }
          }
        }
        expect(ink, `${species} frame ${frame}`).toBeGreaterThan(0);
      }
      expect(lowest, species).toBe(POKEMON_ICON_SOLES[index]);
    });
  });

  it('say their own name when spoken to', () => {
    expect(pokemonCry('pikachu')).toBe('PIKACHU: Pika pika!');
    expect(pokemonCry('mew')).toBe('MEW: Mew mew!');
    expect(pokemonCry('mr-mime')).toBe('MR. MIME: Mime mime!');
  });

  it('load from a file as figures in the world, and a species the game lacks does not', () => {
    const file = withPokemon(gapMap(), { x: 8, y: 4 }, 'snorlax');
    expect(readMapFile(JSON.parse(JSON.stringify(file))).ok).toBe(true);
    const entity = buildPlayerMap(file).entities.find((candidate) => candidate.pokemon);
    expect(entity).toMatchObject({
      pokemon: 'snorlax',
      position: { x: 8, y: 4 },
      dialogLines: ['SNORLAX: Snor snor!'],
    });
    expect(readMapFile({ ...file, pokemon: [{ x: 8, y: 4, species: 'celebi' }] }).ok).toBe(false);
  });

  it('move with the ground when the map grows west or north', () => {
    const file = withPokemon(gapMap(), { x: 8, y: 4 }, 'eevee');
    const grown = extendMap(file, { left: 4, top: 2, right: 0, bottom: 0 });
    expect(grown.pokemon).toEqual([{ x: 12, y: 6, species: 'eevee' }]);
  });

  it('are walls the checks walk round, as a person is', () => {
    const open = gapMap();
    expect(checkMapFile(open).find((check) => check.id === 'way-out')?.passed).toBe(true);
    const shut = withPokemon(open, { x: 15, y: 10 }, 'snorlax');
    expect(checkMapFile(shut).find((check) => check.id === 'way-out')?.passed).toBe(false);
  });
});
