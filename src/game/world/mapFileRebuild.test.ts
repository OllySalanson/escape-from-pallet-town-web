import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMapFile, type MapFile } from './mapFile';
import { onlyMapFileFields } from './mapFileRebuild';

/** Every map the game bundles: the sample, and every published player map. */
const bundled = ['../../maps/sample/', '../../maps/player/'].flatMap((folder) => {
  const url = new URL(folder, import.meta.url);
  return readdirSync(url)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, file: JSON.parse(readFileSync(new URL(name, url), 'utf8')) as MapFile }));
});

/** A map using every part of the format at least once, every optional field set. */
const everything: MapFile = {
  format: 1,
  id: 'everything',
  name: 'Everything',
  maker: 'Check',
  width: 20,
  height: 16,
  ground: Array.from({ length: 16 }, () => 'g'.repeat(20)),
  buildings: [{ x: 1, y: 1, kind: 'house-door' }],
  dropIns: [{ x: 2, y: 2, name: 'In', description: 'The way in.' }],
  exits: [
    { x: 3, y: 3, name: 'Out', opens: { when: 'always' } },
    { x: 4, y: 4, name: 'Later', opens: { when: 'after', seconds: 60 } },
    { x: 5, y: 4, name: 'Buried', opens: { when: 'dug' } },
  ],
  itemSpots: [{ x: 5, y: 5, hidden: true }],
  wildlife: 'meadow',
  people: [{ x: 6, y: 6, name: 'Tam', look: 'old-man', facing: 'down', lines: ['Hello.'] }],
  signs: [{ x: 7, y: 7, lines: ['SIGN'] }],
  landmarks: [{ x: 8, y: 8, name: 'Hide', kind: 'hide' }],
  districts: [{ name: 'Pond', x: 0, y: 0, width: 5, height: 5, wildlife: 'wetland', rain: true }],
  trainers: [
    { x: 9, y: 9, name: 'Ann', team: 'maya', look: 'lass', facing: 'left', sight: 3, lines: ['Fight!'] } as unknown as NonNullable<MapFile['trainers']>[number],
  ],
  doors: [{ kind: 'cut-tree', x: 10, y: 10, width: 1, height: 1 }],
  pokemon: [{ x: 11, y: 11, species: 'pikachu', level: 12 }],
  areas: [
    {
      id: 'house',
      name: 'House',
      kind: 'inside',
      style: 'house',
      width: 8,
      height: 6,
      ground: Array.from({ length: 6 }, () => 'p'.repeat(8)),
      buildings: [{ x: 1, y: 1, area: 'house', kind: 'bed' }],
    },
  ],
  berryTrees: [{ x: 12, y: 12, berry: 'oran' }],
  boulders: [{ x: 13, y: 13 }],
  links: [
    {
      ends: [
        { x: 2, y: 3, toward: 'up', look: 'door' },
        { x: 4, y: 5, area: 'house', toward: 'down', look: 'door' },
      ],
    } as unknown as NonNullable<MapFile['links']>[number],
  ],
};

describe('a map file, as the format has it', () => {
  it('keeps every part of the format, at every depth', () => {
    expect(onlyMapFileFields(everything)).toEqual(everything);
  });

  it('reads every bundled map back unchanged', () => {
    expect(bundled.length).toBeGreaterThan(0);
    for (const { name, file } of bundled) {
      const reading = readMapFile(file);
      expect(reading.ok, name).toBe(true);
      expect(reading.ok && reading.file, name).toEqual(file);
    }
  });

  it('drops anything else, wherever it was hidden (the security review, M3)', () => {
    const smuggled = JSON.parse(JSON.stringify(everything)) as Record<string, unknown> & MapFile;
    const add = (target: object): void => {
      Object.assign(target, { note: 'text written for whoever reads the repo' });
    };
    add(smuggled);
    for (const list of [smuggled.buildings, smuggled.dropIns, smuggled.exits, smuggled.itemSpots, smuggled.people!, smuggled.signs!, smuggled.landmarks!, smuggled.districts!, smuggled.trainers!, smuggled.doors!, smuggled.pokemon!, smuggled.areas!, smuggled.areas![0].buildings, smuggled.links!, smuggled.berryTrees!, smuggled.boulders!]) {
      list.forEach(add);
    }
    add(smuggled.exits[0].opens);
    add(smuggled.links![0].ends[0]);
    expect(JSON.stringify(onlyMapFileFields(smuggled))).not.toContain('note');
    expect(onlyMapFileFields(smuggled)).toEqual(everything);
  });

  it('hands back a map file that shares nothing with what it was given', () => {
    const rebuilt = onlyMapFileFields(everything);
    expect(rebuilt.people).not.toBe(everything.people);
    expect(rebuilt.people![0].lines).not.toBe(everything.people![0].lines);
  });

  it('does it for every map read, so nothing unchecked reaches review, approval or publishing', () => {
    const sample = { ...bundled[0].file, secret: 'x', dropIns: bundled[0].file.dropIns.map((spot) => ({ ...spot, secret: 'x' })) };
    const reading = readMapFile(sample);
    expect(reading.ok && JSON.stringify(reading.file)).not.toContain('secret');
  });
});
