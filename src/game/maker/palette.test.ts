import { describe, expect, it } from 'vitest';
import { buildPlayerMap, MAP_FILE_BUILDINGS, readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { PLAYER_MAP_TILESET } from '../world/tileset/playerMapTileset';
import { blankMap, paintWith, placeBuilding, placeSpot, rectangle } from './draft';
import { makerScreen } from './makerView';
import { BUILDING_CHOICES, GROUND_BRUSHES, PLANT_GROUPS } from './palette';

/** A blank map with its front door and a way out, so the checks have something to walk. */
function workingMap(): MapFile {
  let file: MapFile = { ...blankMap(40, 30, 'Palette'), maker: 'Tester' };
  for (const [kind, x, y] of [
    ['drop-in', 4, 4],
    ['exit', 35, 25],
  ] as const) {
    const outcome = placeSpot(file, kind, { x, y });
    if (!outcome.placed) {
      throw new Error(outcome.reason);
    }
    file = outcome.file;
  }
  return file;
}

describe('the things a maker can plant', () => {
  it('offers every word the map file knows, once, under a heading that has something in it', () => {
    const offered = BUILDING_CHOICES.map((choice) => choice.kind);
    expect([...offered].sort()).toEqual(Object.keys(MAP_FILE_BUILDINGS).sort());
    expect(new Set(offered).size).toBe(offered.length);
    for (const group of PLANT_GROUPS) {
      expect(BUILDING_CHOICES.some((choice) => choice.group === group)).toBe(true);
    }
  });

  it('names a thing the catalogue draws for every word', () => {
    for (const prop of Object.values(MAP_FILE_BUILDINGS)) {
      expect(PLAYER_MAP_TILESET.props[prop], prop).toBeDefined();
    }
  });

  it.each(BUILDING_CHOICES.map((choice) => [choice.label, choice] as const))(
    '%s plants, saves and loads as a map the game can play',
    (_label, choice) => {
      const ground = choice.on === 'water' ? 'W' : '.';
      const base = workingMap();
      const water = paintWith(base, rectangle({ x: 10, y: 8 }, { x: 24, y: 20 }), {
        id: 'w',
        label: 'w',
        help: '',
        letterFor: () => ground,
        swatch: ground,
      });
      const outcome = placeBuilding(water, choice.kind, { x: 12, y: 10 });
      expect(outcome.placed).toBe(true);
      if (!outcome.placed) {
        return;
      }
      const reading = readMapFile(JSON.parse(JSON.stringify(outcome.file)));
      expect(reading.ok ? [] : reading.problems).toEqual([]);
      expect(() => buildPlayerMap(outcome.file)).not.toThrow();
    },
  );
});

describe('the ground brushes', () => {
  it.each(GROUND_BRUSHES.map((brush) => [brush.label, brush] as const))(
    '%s paints ground a map file reads and the checks can load',
    (_label, brush) => {
      const file = paintWith(workingMap(), rectangle({ x: 12, y: 10 }, { x: 15, y: 12 }), brush);
      expect(readMapFile(JSON.parse(JSON.stringify(file))).ok).toBe(true);
      expect(checkMapFile(file).find((check) => check.id === 'loads')?.passed ?? true).toBe(true);
    },
  );
});

describe('the paint list', () => {
  it('puts every thing to plant under its heading, each with a picture of itself', () => {
    const file = workingMap();
    const markup = makerScreen({
      file,
      tool: 'brush',
      brushId: 'grass',
      place: { kind: 'drop-in' },
      selected: undefined,
      zoom: 16,
      overview: true,
      checks: checkMapFile(file),
      canUndo: false,
      canRedo: false,
      drafts: [],
      draftKey: 'draft-a',
      panel: 'map',
      sending: { step: 'checking' },
      sent: { step: 'loading' },
      review: { step: 'checking' },
      reviewing: undefined,
    });
    for (const group of PLANT_GROUPS) {
      expect(markup).toContain(`<p class="px-subheading">${group}</p>`);
    }
    for (const choice of BUILDING_CHOICES) {
      expect(markup).toContain(`data-plant="${choice.kind}"`);
    }
  });
});
