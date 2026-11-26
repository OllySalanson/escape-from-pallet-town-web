import { describe, expect, it } from 'vitest';
import { getItemById, ITEMS, packContents } from '../items';
import { Pokemon, getSpeciesById } from '../pokemon';
import {
  ALL_POCKETS,
  ableCount,
  handCard,
  homeUseOf,
  memberCard,
  findRoomBody,
  teamDoorCard,
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
  it('says it is packed for a raid, and that the POKÉMON CENTER heals at home for nothing', () => {
    // A Pokémon on 2 HP, three Potions, and this screen said 'nothing to use
    // it on here' (AI playtest, 22 Nov); healing at the Center is free since 25 Nov.
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
  team: [],
  pack: {
    name: 'Raid pack',
    itemId: 'raid-pack',
    layout: packContents({ potion: 2 }, { width: 6, height: 3 }),
    used: 2,
    total: 18,
    locked: {},
  },
  locker: { layout: packContents({}, { width: 2, height: 2 }), used: 0, total: 4 },
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
  it('draws home safe on one side and the next raid on the other, and offers nothing to drop', () => {
    const html = thingsScreen(screen({ potion: 2, 'fire-stone': 1 }), '');
    expect(html).toContain('data-grid="stash"');
    expect(html).toContain('data-grid="pack"');
    expect(html).toContain('data-grid="locker"');
    expect(html).toMatch(/things-stash.*things-chest.*Chest<\/span><small>Safe/);
    expect(html).toMatch(/things-team.*Next raid/);
    expect(html).toMatch(/px-tone-risk things-pack.*Raid pack.*Lost on a wipe/);
    expect(html).toMatch(/px-tone-secure things-locker.*Locker.*Kept on a wipe/);
    expect(html).toContain('>2/18</b>');
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

  it('marks what can never go on a raid with a house, and nothing else', () => {
    const html = thingsScreen(screen({ 'mooring-rope': 1, potion: 1, satchel: 1 }), '');
    expect(html).toMatch(/is-home-only[^>]*data-grid-piece="cargo:mooring-rope"/);
    expect(html).not.toMatch(/is-home-only[^>]*data-grid-piece="cargo:potion"/);
    expect(html).not.toMatch(/is-home-only[^>]*data-grid-piece="cargo:satchel"/);
  });

  it('shows each of the team with what a wipe would do to it', () => {
    const member = (name: string, speciesId: string, fate: 'partner' | 'locked' | 'risk') => ({
      id: `${speciesId}-1`,
      name,
      speciesId,
      currentHp: 10,
      maxHp: 10,
      fate,
    });
    const html = thingsScreen(
      screen({}, { team: [member('Squirtle', 'squirtle', 'partner'), member('Pidgey', 'pidgey', 'locked'), member('Rattata', 'rattata', 'risk')] }),
      '',
    );
    expect(html).toContain('Team 3 of 6');
    // The three free places are YOUR TEAM's door.
    expect(html.match(/is-free" data-team-open/g)).toHaveLength(3);
    expect(html).toMatch(/things-tag">Partner<.*things-tag">Safe<.*things-tag">At risk</);
    expect(html).toMatch(/is-partner" data-team-member="squirtle-1" tabindex="-1" aria-label="Squirtle: always comes home".*things-rosette/);
    expect(html).toMatch(/is-locked" data-team-member="pidgey-1" tabindex="-1" aria-label="Pidgey: kept by the locker".*padlock/);
    expect(html).toMatch(/is-risk" data-team-member="rattata-1" tabindex="-1" aria-label="Rattata: lost on a wipe".*things-torn/);
  });

  it('lines the blocks of the pack the locker keeps, and draws a padlock in the locker for each, never the thing twice', () => {
    const html = thingsScreen(
      screen({}, {
        pack: {
          name: 'Raid pack',
          itemId: 'raid-pack',
          layout: packContents({ potion: 3 }, { width: 6, height: 3 }),
          used: 3,
          total: 18,
          locked: { potion: 2 },
        },
        locker: { layout: packContents({ potion: 2 }, { width: 2, height: 2 }), used: 2, total: 4 },
      }),
      '',
    );
    const pack = html.slice(html.indexOf('things-pack'), html.indexOf('things-locker'));
    const locker = html.slice(html.indexOf('things-locker'), html.indexOf('things-hand'));
    expect(pack.match(/is-locked/g)).toHaveLength(2);
    // The locker draws the same two, lined as the pack lines them.
    expect(locker.match(/px-grid-block is-locked[^>]*data-grid-piece="item:\d+:potion"/g)).toHaveLength(2);
  });
});

describe('ROOM FOR A FIND', () => {
  it('is a button on the locker card where the screen offers it', () => {
    expect(thingsScreen(screen({}, { findRoom: true }), '')).toContain('data-find-open');
    expect(thingsScreen(screen({}), '')).not.toContain('data-find-open');
  });

  it('lists each find with what the locker keeps for it, and greys one with no room', () => {
    const locker = { layout: packContents({}, { width: 2, height: 2 }), used: 0, total: 4 };
    const html = findRoomBody(
      [
        { itemId: 'parts-crate', name: 'Parts crate', squares: 4, kept: 1, canKeep: false },
        { itemId: 'money', name: 'Pokédollars', squares: 1, kept: 0, canKeep: false },
        { itemId: 'radio-valve', name: 'Radio valve', squares: 2, kept: 0, canKeep: true },
      ],
      locker,
    );
    expect(html).toMatch(/data-find="parts-crate"[^>]*>.*Kept ×1/);
    expect(html).toMatch(/data-find="money"[^>]*aria-disabled="true">.*No room/);
    expect(html).toMatch(/data-find="radio-valve"[^>]*>.*Keep room/);
    expect(html).toContain('data-grid="locker"');
  });
});

describe('the card of a free place on the team', () => {
  it('offers YOUR TEAM on P', () => {
    expect(teamDoorCard()).toMatch(/data-hand="team"[^>]*><span class="things-cap">P<\/span>Your team/);
  });
});

describe('the card of one of the team', () => {
  const pikachu = new Pokemon(getSpeciesById('pikachu')!, 9);
  it('offers to lock one that fits, unlock one kept, and nothing for the partner', () => {
    expect(memberCard(pikachu, { fate: 'risk', squares: 4, canLock: true })).toMatch(/L<\/span>Lock/);
    expect(memberCard(pikachu, { fate: 'risk', squares: 4, canLock: true })).toContain('4 squares · lost on a wipe');
    expect(memberCard(pikachu, { fate: 'locked', squares: 4, canLock: true })).toMatch(/L<\/span>Unlock/);
    expect(memberCard(pikachu, { fate: 'risk', squares: 9, canLock: false })).toMatch(/aria-disabled="true"><span class="things-cap">L<\/span>Too big/);
    expect(memberCard(pikachu, { fate: 'partner', squares: 4, canLock: true })).not.toContain('data-hand');
    // The locker's one place is taken: keeping this one lets the other go, and the button says who.
    expect(memberCard(pikachu, { fate: 'risk', squares: 4, canLock: true, swapsOut: 'RATTATA' })).toMatch(/L<\/span>Lock · RATTATA out/);
  });
});

describe('the card of what the cursor is on', () => {
  it('says what a thing at home does and offers to pack it, with the key in the button', () => {
    const html = handCard(item('potion'), 'stash', { canPack: true });
    expect(html).toContain(item('potion').description);
    expect(html).toMatch(/<span class="things-cap">ENTER<\/span>Put in the pack/);
    expect(html).not.toContain('aria-disabled');
    expect(html).not.toMatch(/In hand|Carrying/);
  });

  it('greys out packing when the pack is full, and offers none for what stays at home', () => {
    expect(handCard(item('potion'), 'stash', { canPack: false })).toMatch(/data-hand="pack"[^>]*aria-disabled="true"/);
    expect(handCard(item('mooring-rope'), 'stash', { canPack: false })).not.toContain('data-hand="pack"');
    expect(handCard(item('mooring-rope'), 'stash', { canPack: false })).toContain('Home only');
    // A find's room can be kept in the locker; a furniture piece's too, as THE LOCKER always allowed.
    expect(handCard(item('mooring-rope'), 'stash', { canPack: false, canLock: true })).toMatch(/L<\/span>Keep room/);
    expect(handCard(item('mooring-rope'), 'stash', { canPack: false, canLock: false })).toMatch(/aria-disabled="true"><span class="things-cap">L<\/span>Locker full/);
    expect(handCard(item('mooring-rope'), 'stash', { canPack: false, canLock: false, roomKept: true })).toMatch(/L<\/span>Room kept/);
  });

  it('wears a pack rather than packing it', () => {
    expect(handCard(item('satchel'), 'stash', { canPack: true })).toMatch(/ENTER<\/span>Wear it/);
  });

  it('offers to teach a disc and use a stone here', () => {
    expect(handCard(item('tm40-aerial-ace'), 'stash', { canPack: true })).toContain('data-hand="use"');
    expect(handCard(item('potion'), 'stash', { canPack: true })).not.toContain('data-hand="use"');
  });

  it('locks or unlocks a thing in the pack, takes one out, and puts down what is carried', () => {
    expect(handCard(item('potion'), 'pack', { canPack: true })).toMatch(/L<\/span>Lock/);
    expect(handCard(item('potion'), 'pack', { canPack: true, locked: true })).toMatch(/L<\/span>Unlock/);
    expect(handCard(item('potion'), 'pack', { canPack: true, canLock: false })).toMatch(/data-hand="lock"[^>]*aria-disabled="true"><span class="things-cap">L<\/span>Locker full/);
    expect(handCard(item('potion'), 'pack', { canPack: true, locked: true, canLock: false })).not.toContain('aria-disabled');
    expect(handCard(item('potion'), 'pack', { canPack: true })).toMatch(/BKSP<\/span>Take one out/);
    expect(handCard(item('potion'), 'carrying', { canPack: true })).toMatch(/Carrying.*ENTER<\/span>Put down/);
  });
});
