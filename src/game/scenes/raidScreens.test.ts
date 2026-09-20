import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * The three screens a raid opens over the world - the pack, the party and the
 * field guide - and the one thing that is true of all of them: they are the
 * same screens as the ones at base.
 *
 * Two menu changes shipped the lobby side of that (#148, #149) and left these
 * three in an older rounded language, so the captain opened the bag mid-raid
 * and found a different game. What is pinned here is the part a screenshot
 * cannot show: that they are built from the same parts, laid out by the same
 * rules, and have not grown a layer of their own.
 */
const read = (file: string): Promise<string> =>
  readFile(new URL(file, import.meta.url), 'utf8');

const RAID_SCREENS = ['BagScene', 'PartyScene', 'ObjectivesScene'] as const;

describe('the screens a raid opens over the world', () => {
  it('are all pixel-ui, like every other screen the game has', async () => {
    for (const scene of RAID_SCREENS) {
      const source = await read(`./${scene}.ts`);
      expect(source).toMatch(/new MenuOverlay\(this, '[a-z-]+ pixel-ui'/);
      // Built from the shared parts rather than from markup of their own.
      expect(source).toContain('pixelScreen(');
      expect(source).toContain("from '../ui/pixelUi'");
      // The rounded language, by the names only it used.
      expect(source).not.toMatch(/menu-shell|entity-row|entity-list|empty-state|menu-header/);
    }
  });

  it('fill the width they have, with the cursor and help bar every list uses', async () => {
    for (const scene of RAID_SCREENS) {
      const source = await read(`./${scene}.ts`);
      // A collection says the narrowest a column of it may be and takes as many
      // as fit (`ui/columnLayout.ts`); it is the one rule PR #149 taught the
      // lobby and the half of this that matters most.
      expect(source).toContain('pixelColumns(COLUMN_MEASURES.');
      expect(source).toContain('px-list px-scroll');
      // The arrow keys move by where controls are, not round a ring of buttons.
      expect(source).toContain('moveCursor(event.key)');
    }
  });

  it('leave the raid by the key that opened them, and by Escape', async () => {
    const keys: Record<(typeof RAID_SCREENS)[number], string> = {
      BagScene: "isOverlayDismissKey(event, 'b', 'Backspace')",
      PartyScene: "isOverlayDismissKey(event, 'p', 'Backspace')",
      ObjectivesScene: "isOverlayDismissKey(event, 'o')",
    };
    for (const scene of RAID_SCREENS) {
      expect(await read(`./${scene}.ts`)).toContain(keys[scene]);
    }
  });
});

describe('the pack', () => {
  it('shows every pocket at once, gear included', async () => {
    const source = await read('./BagScene.ts');
    // A tab strip is a layer between the player and the Potion at the moment
    // they have least time for one, and the pack is eighteen squares: all of
    // it fits on one screen with a band naming each pocket.
    expect(source).not.toContain('data-category');
    expect(source).toContain('px-subheading');
    for (const pocket of ['Medicine', 'PokeBall', 'Held', 'Misc']) {
      expect(source).toContain(`ItemCategory.${pocket}`);
    }
  });

  it('acts on the row, so using a Potion is four presses', async () => {
    const source = await read('./BagScene.ts');
    // The row is the act; the pane under it is what the thing is and the one
    // deed that is not the row's own. There is no USE button to reach first.
    expect(source).toContain('on(\'[data-item]\', (button) => this.pressItem(');
    expect(source).toContain('on(\'[data-target]\', (button) => this.giveTo(');
    expect(source).not.toContain('data-use');
  });

  it('lights the squares the cursor is over without rebuilding the screen', async () => {
    const source = await read('./BagScene.ts');
    // The cursor moves on every arrow key; a re-render there costs the player
    // a beat, and this screen is read under the clock.
    expect(source).toContain("addEventListener('focusin'");
    expect(source).toContain('markPack');
    // The square carries the same key its row does, so pointing at either
    // answers for the other - `ui/hoverDescribe.ts` owns that key.
    expect(await read('../ui/pixelUi.ts')).toContain("describeKey('item', placement.itemId)");
  });
});

describe('the raid party', () => {
  it('draws one Pokemon through the same dossier the stash does', async () => {
    const party = await read('./PartyScene.ts');
    const hub = await read('./HubScene.ts');
    for (const source of [party, hub]) {
      expect(source).toContain("from '../ui/pokemonDossier'");
      expect(source).toContain('pokemonDossier({');
    }
    // And has no detail column, gear list or summary view of its own.
    expect(party).not.toMatch(/(?<![\w-])(party-detail|party-layout|party-list|detail-hero|stats-grid|move-list)(?![\w-])/);
  });

  it('can still set the order Pokemon are sent out in', async () => {
    const source = await read('./PartyScene.ts');
    // The canvas screen could and its DOM replacement quietly could not, while
    // its own footer still said `ENTER: MOVE`.
    expect(source).toContain('this.party.movePokemon(from, index)');
    expect(source).toContain('pixelTag(\'Leads\'');
  });
});
