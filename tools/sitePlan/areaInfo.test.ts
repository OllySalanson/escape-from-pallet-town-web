import { describe, expect, it } from 'vitest';
import { buildPlanData, titleCase } from './planData';
import { conditionWords, sharesOf } from './areaInfo';
import { districtsForMap } from '../../src/game/world/districts';
import { districtTableFor } from '../../src/game/world/nightRaids';
import { SECRETS } from '../../src/game/world/secrets';
import { OMEN_ROOSTS } from '../../src/game/world/omens';
import { BUILT_IN_FILE_PRIZES } from '../../src/game/world/filePrizes';
import { fileMap } from '../../src/game/world/playerMaps';
import { getWorldMap } from '../../src/game/worldMap';
import { itemNameFor } from '../../src/game/items/items';

const MAP = 'greystone-vale' as const;
const plan = buildPlanData(MAP);
const placeNamed = (name: string) =>
  plan.features.find((f) => (f.kind === 'district' || f.kind === 'room') && f.name === name);
const infoOf = (name: string) => {
  const place = placeNamed(name);
  if (!place) throw new Error(`no place called ${name}`);
  return plan.info[place.id];
};

describe('what the site plan says each place holds', () => {
  it('has a panel for every place and every room', () => {
    for (const f of plan.features)
      if (f.kind === 'district' || f.kind === 'room') expect(plan.info[f.id], f.name).toBeDefined();
  });

  it('reads wildlife off the table the game rolls, with shares that add up', () => {
    const millbrook = districtsForMap(MAP).find((d) => d.name === 'MILLBROOK')!;
    const ground = infoOf('Millbrook').ground.find((g) => g.places.includes('Millbrook'))!;
    expect(ground.day).toEqual(sharesOf(districtTableFor(millbrook, false)!));
    for (const info of Object.values(plan.info))
      for (const g of info.ground) {
        expect(g.day.reduce((sum, w) => sum + w.share, 0)).toBeCloseTo(1, 9);
        // Night is said only where it is something else.
        if (g.night) expect(g.night.map((w) => w.species)).not.toEqual(g.day.map((w) => w.species));
      }
  });

  it('says what the Frozen Lagoon does differently', () => {
    const lagoon = infoOf('The Frozen Lagoon');
    expect(lagoon.mechanics.join(' ')).toMatch(/Ice: a step on it slides/);
    const prize = BUILT_IN_FILE_PRIZES[MAP]!.find((p) => p.place === 'THE FROZEN LAGOON')!;
    expect(lagoon.prizes.map((p) => p.chance)).toContain(prize.chance);
    expect(lagoon.standing.find((s) => s.species === 'articuno')?.legendary).toBe(true);
  });

  it('puts every secret, omen and only-here find in the place it names', () => {
    const named = (name: string, pick: (info: (typeof plan.info)[string]) => readonly string[]) =>
      Object.entries(plan.info).filter(([, info]) => pick(info).includes(name)).length;
    for (const secret of SECRETS)
      expect(
        named(titleCase(secret.name), (i) => i.secrets.map((s) => s.name)),
        secret.name,
      ).toBe(1);
    for (const [bird, roost] of Object.entries(OMEN_ROOSTS))
      expect(infoOf(titleCase(roost.district)).omen, bird).toBe(bird);
    for (const prize of BUILT_IN_FILE_PRIZES[MAP] ?? [])
      expect(
        named(itemNameFor(prize.itemId, prize.quantity), (i) => i.prizes.map((p) => p.item)),
        prize.itemId,
      ).toBe(1);
  });

  it('says every secret condition in words', () => {
    for (const secret of SECRETS)
      for (const condition of secret.when) {
        const words = conditionWords(condition);
        expect(words, secret.id).not.toMatch(/undefined|NaN|\[object/);
        expect(words.length).toBeGreaterThan(5);
      }
  });

  it('marks every Pokemon that stands and fights, and names every species it shows', () => {
    const fighters = (fileMap(MAP)!.file.pokemon ?? []).filter((p) => p.level !== undefined);
    expect(plan.features.filter((f) => f.kind === 'wild')).toHaveLength(fighters.length);
    const shown = new Set<string>();
    for (const info of Object.values(plan.info)) {
      for (const g of info.ground)
        for (const w of [...g.day, ...(g.night ?? [])]) shown.add(w.species);
      for (const w of info.fishing)
        for (const rod of w.rods) for (const x of rod.wild) shown.add(x.species);
    }
    for (const id of shown) expect(plan.species[id], id).toBeDefined();
  });

  it('badges every door in off the outdoors and frames the whole room behind it', () => {
    const map = getWorldMap(MAP);
    const doorsIn = plan.features.filter((f) => f.kind === 'door' && f.enters);
    expect(doorsIn.length).toBeGreaterThan(0);
    const rooms = plan.features.filter((f) => f.kind === 'room');
    for (const door of doorsIn)
      expect(
        rooms.some((room) => JSON.stringify(room.rects[0]) === JSON.stringify(door.goto)),
        door.name,
      ).toBe(true);
    expect(map.warps.length).toBeGreaterThanOrEqual(doorsIn.length);
  });

  it('never says undefined', () => {
    const text = JSON.stringify({ features: plan.features, info: plan.info });
    expect(text).not.toMatch(/undefined|NaN/);
  });
});
