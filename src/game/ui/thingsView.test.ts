import { describe, expect, it } from 'vitest';
import { getItemById, ITEMS, packContents } from '../items';
import { Pokemon, getSpeciesById } from '../pokemon';
import {
  ALL_POCKETS,
  ableCount,
  handCard,
  homeUseOf,
  pocketOf,
  pocketTabs,
  stashCargo,
  stashLayout,
  STASH_COLUMNS,
  STASH_MIN_ROWS,
  storedPockets,
  thingsScreen,
  THINGS_POCKETS,
  whereItIsUsed,
  MEDICINE_AT_BASE,
  type ThingsScreen,
} from './thingsView';

const item = (id: string) => getItemById(id)!;

describe('YOUR THINGS sorts storage into pockets', () => {
  it('puts every thing in the catalogue in a pocket, and says where every one is used', () => {
    for (const definition of Object.values(ITEMS)) {
      expect(THINGS_POCKETS).toContain(pocketOf(definition));
      expect(whereItIsUsed(definition).length).toBeGreaterThan(10);
    }
  });

  it('keeps discs and stones in pockets of their own, the two things used at home', () => {
    expect(pocketOf(item('tm40-aerial-ace'))).toBe('discs');
    expect(pocketOf(item('hm01-cut'))).toBe('discs');
    expect(pocketOf(item('fire-stone'))).toBe('stones');
    expect(homeUseOf(item('tm40-aerial-ace'))).toBe('teach');
    expect(homeUseOf(item('fire-stone'))).toBe('evolve');
    expect(homeUseOf(item('potion'))).toBeNull();
    expect(homeUseOf(item('money'))).toBeNull();
  });

  it('files medicine, balls, found goods and money where a player would look', () => {
    expect(pocketOf(item('potion'))).toBe('medicine');
    expect(pocketOf(item('poke-ball'))).toBe('balls');
    expect(pocketOf(item('money'))).toBe('found');
    expect(pocketOf(item('cable-coil'))).toBe('found');
  });

  it('reads the pockets in their own order, empty ones left out', () => {
    const pockets = storedPockets({ 'fire-stone': 1, potion: 3, money: 120, 'poke-ball': 0, 'no-such-thing': 4 });
    expect(pockets.map(({ pocket }) => pocket)).toEqual(['medicine', 'stones', 'found']);
  });
});

describe('medicine at base', () => {
  it('sends a player to THE BENCH, never says there is nothing to use it on', () => {
    // A Pokémon on 2 HP, three Potions, and this screen said 'nothing to use
    // it on here', so players paid Nurse Joy raid time (AI playtest, 22 Nov).
    for (const id of ['potion', 'super-potion', 'antidote']) {
      expect(whereItIsUsed(item(id))).toContain(MEDICINE_AT_BASE);
    }
  });
});

describe('a disc or a stone counts who it would do something for', () => {
  it('counts the Pokémon a stone would evolve', () => {
    const party = [new Pokemon(getSpeciesById('pikachu')!, 10), new Pokemon(getSpeciesById('rattata')!, 10)];
    expect(ableCount(item('thunder-stone'), party)).toBe(1);
    expect(ableCount(item('fire-stone'), party)).toBe(0);
  });
});

const screen = (stash: Record<string, number>, overrides: Partial<ThingsScreen> = {}): ThingsScreen => ({
  stash,
  stashArrangement: { items: [], cargo: [] },
  pocket: ALL_POCKETS,
  pack: { name: 'Raid pack', itemId: 'raid-pack', layout: packContents({ potion: 2 }, { width: 6, height: 3 }), used: 2, total: 18 },
  locker: { layout: packContents({}, { width: 2, height: 2 }), pokemon: [] },
  ...overrides,
});

describe('the stash as squares', () => {
  it('lays each kind of thing once, as big as it is, with a spare row under the last', () => {
    const layout = stashLayout({ potion: 4, 'mooring-rope': 2, 'poke-ball': 1 });
    expect(layout.size.width).toBe(STASH_COLUMNS);
    expect(layout.cargo.map((piece) => piece.cargoId).sort()).toEqual(['mooring-rope', 'poke-ball', 'potion']);
    const rope = layout.cargo.find((piece) => piece.cargoId === 'mooring-rope')!;
    const footprint = item('mooring-rope').footprint ?? { width: 1, height: 1 };
    expect(rope.width * rope.height).toBe(footprint.width * footprint.height);
    const bottom = Math.max(...layout.cargo.map((piece) => piece.y + piece.height));
    expect(layout.size.height).toBe(Math.max(STASH_MIN_ROWS, bottom + 1));
  });

  it('always leaves a spare row, however full it is', () => {
    const contents = Object.fromEntries(
      Object.values(ITEMS)
        .slice(0, 40)
        .map((one) => [one.id, 1] as const),
    );
    const layout = stashLayout(contents);
    const lastRow = layout.size.height - 1;
    expect(layout.cargo.every((piece) => piece.y + piece.height - 1 < lastRow)).toBe(true);
  });

  it('keeps a thing where the player put it', () => {
    const layout = stashLayout({ potion: 1, 'poke-ball': 1 }, { items: [], cargo: [{ cargoId: 'poke-ball', x: 5, y: 8, rotated: false }] });
    expect(layout.cargo.find((piece) => piece.cargoId === 'poke-ball')).toMatchObject({ x: 5, y: 8 });
    // The spare row is under the lowest thing, wherever that is.
    expect(layout.size.height).toBe(10);
  });

  it('reads medicine first and clothes last when nothing has been moved', () => {
    const order = stashCargo({ 'red-cap': 1, potion: 1, 'poke-ball': 1 }).map((piece) => piece.cargoId);
    expect(order.indexOf('potion')).toBeLessThan(order.indexOf('poke-ball'));
  });

  it('offers a tab for every pocket it has something in, after ALL', () => {
    expect(pocketTabs({ potion: 1, 'fire-stone': 1 })).toEqual(['all', 'medicine', 'stones']);
  });
});

describe('the screen', () => {
  it('draws the stash, the raid pack at risk and the locker safe, and offers nothing to drop', () => {
    const html = thingsScreen(screen({ potion: 2, 'fire-stone': 1 }), '');
    expect(html).toContain('data-grid="stash"');
    expect(html).toContain('data-grid="pack"');
    expect(html).toMatch(/px-tone-risk things-pack.*At risk/);
    expect(html).toMatch(/px-tone-secure things-locker.*Safe/);
    expect(html).toContain('<b>2</b><small>of</small><b>18</b>');
    expect(html).not.toMatch(/data-drop|Drop one/);
  });

  it('counts each kind on its own corner', () => {
    expect(thingsScreen(screen({ potion: 3 }), '')).toContain('<b>×3</b>');
  });

  it("stands back the things a pocket tab leaves out, and lights the tab", () => {
    const html = thingsScreen(screen({ potion: 1, 'poke-ball': 1 }, { pocket: 'balls' }), '');
    expect(html).toMatch(/is-cargo is-dim[^>]*data-grid-piece="cargo:potion"/);
    expect(html).not.toMatch(/is-cargo is-dim[^>]*data-grid-piece="cargo:poke-ball"/);
    expect(html).toContain('things-tab is-here" data-pocket-tab="balls"');
  });

  it('gives the partner its own place in the locker, with the rosette', () => {
    const html = thingsScreen(
      screen({}, {
        locker: {
          layout: packContents({}, { width: 2, height: 2 }),
          partner: { name: 'Squirtle', dexId: 7, shiny: false },
          pokemon: [{ name: 'Pikachu', dexId: 25, shiny: false, squares: 4 }],
        },
      }),
      '',
    );
    expect(html).toContain('4 squares');
    expect(html).toMatch(/is-partner.*things-rosette.*Squirtle.*Its own place/);
  });
});

describe('the card of what is in hand', () => {
  it('says what a thing in the stash does and offers to pack it, with the key in the button', () => {
    const html = handCard(item('potion'), 'stash', true);
    expect(html).toContain(item('potion').description);
    expect(html).toMatch(/<span class="things-cap">ENTER<\/span>Put in the pack/);
    expect(html).not.toContain('aria-disabled');
  });

  it('greys out packing what cannot go in the pack', () => {
    expect(handCard(item('mooring-rope'), 'stash', false)).toMatch(/data-hand="pack"[^>]*aria-disabled="true"/);
  });

  it('offers to teach a disc and use a stone here', () => {
    expect(handCard(item('tm40-aerial-ace'), 'stash', true)).toContain('data-hand="use"');
    expect(handCard(item('potion'), 'stash', true)).not.toContain('data-hand="use"');
  });

  it('takes one out of the pack, and puts down what is carried', () => {
    expect(handCard(item('potion'), 'pack', true)).toMatch(/BKSP<\/span>Take one out/);
    expect(handCard(item('potion'), 'carrying', true)).toMatch(/ENTER<\/span>Put down/);
  });
});
