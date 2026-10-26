import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { getSpeciesById } from '../pokemon/species';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from './baseMap';
import { stepsFrom, stepsTo } from './baseWalks';
import { DAY_CARE_KEEPER, penTiles } from './dayCarePen';
import { BASE_DOORS } from './doors';
import { BASE_FIXTURES } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';
import { HARBOUR_LIFE, HARBOUR_SPECIES, harbourBeatTiles, harbourLifeAt, onLand, type HarbourFigure } from './harbourLife';

const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const neighbours = (tile: GridPosition): GridPosition[] =>
  [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }));

/** Every tile anybody on land may ever stand on at one hour, all at once. */
const landBeatsOf = (life: readonly HarbourFigure[]): Set<string> =>
  new Set(life.filter(onLand).flatMap((figure) => harbourBeatTiles(figure).map(key)));

describe('the harbour after dark', () => {
  it('sends the day-only figures home and moves the night ones, and nobody else', () => {
    const day = harbourLifeAt('day');
    const night = harbourLifeAt('night');
    expect(day).toBe(HARBOUR_LIFE);
    expect(night.map((figure) => figure.id)).toEqual(
      HARBOUR_LIFE.filter((figure) => !figure.byDayOnly).map((figure) => figure.id),
    );
    const lapras = night.find((figure) => figure.id === 'bay-lapras')!;
    expect(lapras.lines.join(' ')).toContain('singing');
    expect(harbourLifeAt('dusk')).toBe(HARBOUR_LIFE);
  });
});

describe.each(['day', 'night'] as const)('the harbour\'s people and Pokemon by %s', (hour) => {
  const HARBOUR_LIFE = harbourLifeAt(hour);
  const landBeats = landBeatsOf(HARBOUR_LIFE);

  it('stand each on the ground they belong on: land for walkers, sea for swimmers', () => {
    for (const built of [[], EVERY_RUNG]) {
      const map = getBaseMap(built);
      for (const figure of HARBOUR_LIFE) {
        for (const tile of harbourBeatTiles(figure)) {
          const ground = onLand(figure) ? map.collision[tile.y][tile.x] === false : map.terrain[tile.y][tile.x] === 'water';
          expect([figure.id, tile, ground]).toEqual([figure.id, tile, true]);
        }
      }
    }
  });

  it('walk a beat, never jump one, and never share a tile with each other', () => {
    const seen = new Map<string, string>();
    for (const figure of HARBOUR_LIFE) {
      const beat = harbourBeatTiles(figure);
      for (const tile of beat.slice(1)) {
        const joined = beat.some((other) => other !== tile && neighbours(tile).some((next) => key(next) === key(other)));
        expect([figure.id, tile, joined]).toEqual([figure.id, tile, true]);
      }
      for (const tile of beat) {
        expect([key(tile), seen.get(key(tile)) ?? figure.id]).toEqual([key(tile), figure.id]);
        seen.set(key(tile), figure.id);
      }
    }
  });

  it('never stand where somebody arrives, goes in, or reads something', () => {
    const kept = new Set<string>([
      key(BASE_SPAWN),
      key(BASE_LANDING),
      key(DAY_CARE_KEEPER.position),
      ...penTiles().map(key),
      ...BASE_DOORS.flatMap((door) => [...door.tiles, door.returnTo].map(key)),
    ]);
    for (const figure of HARBOUR_LIFE) {
      for (const tile of harbourBeatTiles(figure)) {
        expect([figure.id, tile, kept.has(key(tile))]).toEqual([figure.id, tile, false]);
      }
    }
    // Everything read by facing it can still be faced with everybody standing
    // on every tile of their beat.
    const map = getBaseMap(EVERY_RUNG);
    const read = [
      ...BASE_SIGNS.map((sign) => ({ x: sign.x, y: sign.y })),
      ...BASE_FIXTURES.map((fixture) => fixture.at),
      ...HARBOUR_LANDMARKS.map((landmark) => landmark.at),
    ];
    for (const tile of read) {
      const free = neighbours(tile).filter((next) => map.collision[next.y]?.[next.x] === false && !landBeats.has(key(next)));
      expect([tile, free.length > 0]).toEqual([tile, true]);
    }
  });

  /**
   * The yard's own rule, asked with every beat tile solid at once: nothing is
   * walled off, and no walk to a door is one step longer than an empty
   * harbour's - walking must never become a toll for re-kitting.
   */
  it('wall nothing off and lengthen no walk to a door, with every beat tile taken at once', () => {
    for (const built of [[], EVERY_RUNG]) {
      const map = getBaseMap(built);
      const crowded = (tile: GridPosition): boolean => landBeats.has(key(tile));
      for (const start of [BASE_SPAWN, BASE_LANDING]) {
        const empty = stepsFrom(map.collision, start);
        const full = stepsFrom(map.collision, start, crowded);
        for (const door of BASE_DOORS) {
          expect([door.id, stepsTo(full, door.tiles)]).toEqual([door.id, stepsTo(empty, door.tiles)]);
        }
        const pen = new Set(penTiles().map(key));
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            if (map.collision[y][x] || pen.has(`${x},${y}`) || landBeats.has(`${x},${y}`)) continue;
            expect([x, y, full[y][x] < Infinity]).toEqual([x, y, true]);
          }
        }
      }
    }
  });

  it('are drawn from art that exists and cry their own cries', () => {
    for (const figure of HARBOUR_LIFE) {
      if (figure.kind !== 'pokemon') continue;
      expect(HARBOUR_SPECIES).toContain(figure.species);
      expect([figure.species, getSpeciesById(figure.species)?.dexId]).toEqual([figure.species, expect.any(Number)]);
    }
  });

  it('ship a 64x128 sheet a species, recorded in the provenance file', () => {
    for (const species of HARBOUR_SPECIES) {
      const png = readFileSync(join(__dirname, `../../../public/assets/harbour-pokemon/${species}.png`));
      expect([species, png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([species, 64, 128]);
    }
    const provenance = readFileSync(join(__dirname, '../../../public/assets/ASSET_PROVENANCE.md'), 'utf8');
    expect(provenance).toContain('harbour-pokemon/');
  });
});
