import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KANTO_POKEDEX_SIZE, POKEDEX_MILESTONES, type Pokedex } from '../hub/pokedex';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import {
  CARD_WHERE_LINES,
  DEX_TILE,
  DEX_TILE_MOST,
  dexBand,
  dexCard,
  dexEntryBody,
  dexFamily,
  dexGoal,
  dexListBody,
  dexNumber,
  dexPitch,
  dexTile,
  dexTileHelp,
  heightWords,
  kindAt,
  milestoneStanding,
  neighbourPage,
  weightWords,
} from './pokedexView';

/** Bulbasaur's line and Pikachu owned, a shiny Magikarp and Zapdos among them; Pidgey, Raichu and Snorlax only met. */
const DEX: Pokedex = {
  owned: [1, 2, 3, 25, 129, 145],
  seen: [1, 2, 3, 16, 25, 26, 129, 143, 145],
  shiny: [129],
};

const tilesOf = (markup: string, standing: string): number =>
  [...markup.matchAll(new RegExp(`class="dex-tile is-${standing}`, 'g'))].length;

describe('the Pokédex grid', () => {
  // A page names where a kind lives: asked of the roster a player is offered.
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));

  it('is all 151 in Kanto order, each a control the cursor can rest on', () => {
    const body = dexListBody({ dex: DEX, claimed: [] }, 1);
    const numbers = [...body.matchAll(/<button type="button" class="dex-tile[^"]*" data-dex="(\d+)"/g)].map((match) => Number(match[1]));
    expect(numbers).toEqual(Array.from({ length: KANTO_POKEDEX_SIZE }, (_, index) => index + 1));
  });

  it('draws an owned kind in colour, a kind only met as its shape, and one never met as an empty ball', () => {
    const body = dexListBody({ dex: DEX, claimed: [] }, 1);
    expect(tilesOf(body, 'owned')).toBe(6);
    expect(tilesOf(body, 'seen')).toBe(3);
    expect(tilesOf(body, 'unknown')).toBe(KANTO_POKEDEX_SIZE - 9);
    // The icon is the kind's own for an owned or met one; an empty ball has no icon and no name.
    expect(dexTile(DEX, 25)).toContain('px-mon-icon');
    expect(dexTile(DEX, 16)).toContain('px-mon-icon');
    const unknown = dexTile(DEX, 150);
    expect(unknown).toContain('dex-ball');
    expect(unknown).not.toContain('px-mon-icon');
    expect(unknown.toLowerCase()).not.toContain('mewtwo');
  });

  it('marks a shiny that has been owned with the star, and only an owned one', () => {
    expect(dexTile(DEX, 129)).toContain('px-shiny');
    expect(dexTile(DEX, 129)).toContain('is-shiny');
    expect(dexTile(DEX, 25)).not.toContain('px-shiny');
    // Registered as shiny but not as owned cannot happen through the save; the tile still stands by owned.
    expect(dexTile({ ...DEX, shiny: [16] }, 16)).not.toContain('px-shiny');
  });

  it('stands a legend apart', () => {
    expect(dexTile(DEX, 145)).toContain('is-legend');
    expect(dexTile(DEX, 25)).not.toContain('is-legend');
  });

  it('starts the cursor on the tile it is told to, and nowhere else', () => {
    const body = dexListBody({ dex: DEX, claimed: [] }, 25);
    expect([...body.matchAll(/data-cursor-start/g)]).toHaveLength(1);
    expect(body).toMatch(/data-dex="25"[^>]*data-cursor-start/);
  });

  it('says in the help bar who a tile is, and never names one not met', () => {
    expect(dexTileHelp(25, 'owned')).toBe('No. 025 PIKACHU · ELECTRIC. ENTER opens its page.');
    expect(dexTileHelp(1, 'owned')).toBe('No. 001 BULBASAUR · GRASS / POISON. ENTER opens its page.');
    expect(dexTileHelp(129, 'owned', true)).toBe('No. 129 MAGIKARP · WATER · Shiny owned. ENTER opens its page.');
    expect(dexTileHelp(16, 'seen')).toBe('No. 016 PIDGEY · Met, not owned yet. ENTER opens its page.');
    expect(dexTileHelp(150, 'unknown')).toBe('No. 150 · Not met yet.');
  });

  it('types no arrow and no tick: the face has neither', () => {
    const drawn = `${dexListBody({ dex: DEX, claimed: [10] }, 1)}${dexEntryBody(DEX, 25) ?? ''}`;
    expect(drawn).not.toMatch(/[←→↑↓▶►◀✓✔★☆]/);
  });
});

describe('the count and Oak’s milestones', () => {
  const stateWith = (owned: number, claimed: readonly number[] = []): { dex: Pokedex; claimed: readonly number[] } => {
    const kinds = Array.from({ length: owned }, (_, index) => index + 1);
    return { dex: { owned: kinds, seen: kinds, shiny: [] }, claimed };
  };

  it('draws the count large, with how many have been met beside it', () => {
    const band = dexBand({ dex: DEX, claimed: [] });
    expect(band).toContain('data-dex-owned="6"');
    expect(band).toContain('of 151 owned');
    expect(band).toContain('9 met');
    expect(band).toContain('--owned:6');
  });

  it('puts a pip on every milestone, by whether it is paid, waiting on Oak, next or further off', () => {
    const { dex, claimed } = stateWith(30, [10]);
    expect(POKEDEX_MILESTONES.map((milestone) => milestoneStanding(milestone, dex.owned.length, claimed))).toEqual([
      'paid',
      'due',
      'next',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
    ]);
    const band = dexBand({ dex, claimed });
    expect([...band.matchAll(/class="dex-pip is-/g)]).toHaveLength(POKEDEX_MILESTONES.length);
    expect(band).toContain('class="dex-pip is-next" style="--at:50"');
  });

  it('shows the next reward as the things themselves and how far off it is', () => {
    const goal = dexGoal(stateWith(37, [10, 25]));
    expect(goal).toContain('At 50');
    expect(goal).toContain('13 to go');
    // Every stone, each its own icon.
    expect([...goal.matchAll(/class="dex-reward"/g)]).toHaveLength(5);
  });

  it('says Oak is holding a reward when one is reached and unpaid, and counts a reward of several', () => {
    const goal = dexGoal(stateWith(12));
    expect(goal).toContain('Oak has a reward');
    expect(goal).toContain('×5');
  });

  it('says so when there is nothing left to reach', () => {
    const goal = dexGoal(stateWith(KANTO_POKEDEX_SIZE, POKEDEX_MILESTONES.map((milestone) => milestone.kinds)));
    expect(goal).toContain('Complete');
    expect(goal).not.toContain('dex-reward');
  });
});

describe('a kind’s page', () => {
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));

  it('is FireRed’s entry for a kind owned: number, name, category, types, size and its words', () => {
    const page = dexEntryBody(DEX, 25)!;
    expect(page).toContain('No. 025');
    expect(page).toContain('Pikachu');
    expect(page).toContain('MOUSE POKéMON');
    expect(page).toContain('px-type-electric');
    expect(page).toContain('0.4 m');
    expect(page).toContain('6.0 kg');
    // The cartridge's three lines run together for the window to wrap.
    expect(page).toContain('It has small electric sacs on both its cheeks. If threatened, it looses electric charges from the sacs.');
    expect(page).toContain('assets/pokemon/front/25.png');
  });

  it('names only places the game has for it', () => {
    const page = dexEntryBody(DEX, 25)!;
    expect(page).toContain('Where to find one');
    expect(page).toMatch(/Wild in THE POWER STATION/);
    expect(dexEntryBody(DEX, 145)).toContain('A legend, standing in TURBINE HALL');
  });

  it('gives up only the name and where it lives for a kind only met, as FireRed does', () => {
    const page = dexEntryBody(DEX, 143)!;
    expect(page).toContain('Snorlax');
    expect(page).toContain('is-silhouette');
    expect(page).toContain('????? POKéMON');
    expect(page).toContain('Met, not owned');
    expect(page).toContain('Own one, and its page fills in.');
    expect(page).toContain('One of the vale’s secrets');
    // Nothing owning one would tell: not its category, its types, its size or its words.
    expect(page).not.toContain('SLEEPING');
    expect(page).not.toContain('px-type-');
    expect(page).not.toContain(' kg');
    expect(page).not.toContain('It is not satisfied');
  });

  it('has no page for a kind never met', () => {
    expect(dexEntryBody(DEX, 150)).toBeUndefined();
    expect(dexEntryBody(DEX, 0)).toBeUndefined();
  });

  it('shows the shiny beside the plain one once a shiny has been owned', () => {
    const shiny = dexEntryBody(DEX, 129)!;
    expect(shiny).toContain('assets/pokemon/front/129.png');
    expect(shiny).toContain('assets/pokemon/shiny/front/129.png');
    expect(dexEntryBody(DEX, 25)).not.toContain('/shiny/');
  });

  it('draws the line a kind belongs to, each as the grid has it and its own place lit', () => {
    const family = dexFamily(DEX, kindAt(25)!);
    expect([...family.matchAll(/class="dex-kin /g)]).toHaveLength(2);
    expect(family).toContain('class="dex-kin is-owned is-here"');
    expect(family).toContain('class="dex-kin is-seen"');
    // Not met: an empty ball, and no name given away.
    const unknown = dexFamily({ owned: [133], seen: [133], shiny: [] }, kindAt(133)!);
    expect([...unknown.matchAll(/dex-ball/g)]).toHaveLength(3);
    expect(unknown.toLowerCase()).not.toContain('vaporeon');
    // A kind with no line has no strip.
    expect(dexFamily(DEX, kindAt(143)!)).toBe('');
    expect(dexEntryBody(DEX, 143)).not.toContain('Family');
  });

  it('turns to the next kind met either way, and stays where there is none', () => {
    expect(neighbourPage(DEX, 25, 1)).toBe(26);
    expect(neighbourPage(DEX, 26, 1)).toBe(129);
    expect(neighbourPage(DEX, 25, -1)).toBe(16);
    expect(neighbourPage(DEX, 1, -1)).toBe(1);
    expect(neighbourPage(DEX, 145, 1)).toBe(145);
    const last = dexEntryBody(DEX, 145)!;
    expect(last).toMatch(/data-dex-turn="145" aria-disabled="true"/);
    expect(last).toMatch(/data-dex-turn="143"/);
  });

  it('starts the cursor on CRY, the one thing a page has to press', () => {
    const page = dexEntryBody(DEX, 25)!;
    expect(page).toMatch(/data-dex-cry="25" data-cursor-start/);
    expect([...page.matchAll(/data-cursor-start/g)]).toHaveLength(1);
  });
});

describe('the card beside the grid', () => {
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));

  it('answers for the tile under the cursor: a kind owned in full, one only met as its shape, one never met as a ball', () => {
    expect(dexCard(DEX, 25)).toContain('MOUSE POKéMON');
    expect(dexCard(DEX, 16)).toContain('is-silhouette');
    const unknown = dexCard(DEX, 150);
    expect(unknown).toContain('No. 150');
    expect(unknown).toContain('?????');
    expect(unknown.toLowerCase()).not.toContain('mewtwo');
  });

  it('names a few of the places once they have been worked out, and leaves the rest to the page', () => {
    // The page asked, so the walk is done.
    dexEntryBody(DEX, 16);
    const lines = [...dexCard(DEX, 16).matchAll(/<small class="px-wrap">/g)];
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(CARD_WHERE_LINES);
  });
});

describe('how big a tile is drawn', () => {
  const rows = (width: number, pitch: number): number => Math.ceil(KANTO_POKEDEX_SIZE / Math.floor(width / pitch));

  it('is its own size where a 1280x800 window holds exactly nine rows of them', () => {
    expect(dexPitch(602, 306)).toBe(DEX_TILE);
    expect(rows(602, DEX_TILE) * DEX_TILE).toBe(306);
  });

  it('is given the room a bigger window has, with all 151 still in view', () => {
    const pitch = dexPitch(722, 380);
    expect(pitch).toBe(42);
    expect(rows(722, pitch) * pitch).toBeLessThanOrEqual(380);
    expect(rows(722, pitch + 1) * (pitch + 1)).toBeGreaterThan(380);
  });

  it('never goes under its own size, so a small window scrolls, and never over the most', () => {
    expect(dexPitch(362, 206)).toBe(DEX_TILE);
    expect(dexPitch(0, 0)).toBe(DEX_TILE);
    expect(dexPitch(4000, 4000)).toBe(DEX_TILE_MOST);
  });
});

describe('the small words', () => {
  it('numbers a page as FireRed does', () => {
    expect(dexNumber(1)).toBe('No. 001');
    expect(dexNumber(151)).toBe('No. 151');
  });

  it('says a size in metres and kilograms from the cartridge’s decimetres and hectograms', () => {
    expect(heightWords(4)).toBe('0.4 m');
    expect(heightWords(88)).toBe('8.8 m');
    expect(weightWords(60)).toBe('6.0 kg');
    expect(weightWords(4600)).toBe('460.0 kg');
  });
});
