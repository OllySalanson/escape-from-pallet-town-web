/**
 * YOUR THINGS: everything the player owns between raids, read anywhere in the
 * harbour on B (`scenes/ThingsScene.ts`).
 *
 * There is one store, the vault (the overnight plan's first decision): two would
 * mean carrying things between them, and re-kitting must never become a walk.
 * So this is a *look* at the vault rather than a second place - the next raid's
 * pack as the rack holds it, then storage in pockets - and nothing on it can be
 * dropped, because nothing at home is in anybody's way.
 *
 * Two kinds of thing can be used here: a disc, read to one of the player's
 * Pokémon, and an evolution stone. The risk in either was always in carrying it
 * out of a raid; one already home has paid it (the bag plan's pick C1). Every
 * other row says where the thing is used, because "what is this for" is the
 * question a list of ninety rows is opened with.
 *
 * Phaser-free, so the pockets and the words are tested without a browser.
 */
import {
  getItemById,
  isCurrency,
  itemCountTag,
  ItemCategory,
  machineForItem,
  type GridPacking,
  type ItemDefinition,
} from '../items';
import { canLearnFromMachine } from '../pokemon/machines';
import { evolutionByStone, type Pokemon } from '../pokemon';
import { itemIcon } from './icons';
import { escapeAttribute, pixelColumns, pixelGrid, pixelTag, pixelWindow, COLUMN_MEASURES } from './pixelUi';

/** The pockets storage is read in, in the order they are read. */
export const THINGS_POCKETS = [
  'medicine',
  'balls',
  'discs',
  'stones',
  'held',
  'tools',
  'packs',
  'found',
  'furniture',
  'clothes',
] as const;

export type ThingsPocket = (typeof THINGS_POCKETS)[number];

export const THINGS_POCKET_LABELS: Readonly<Record<ThingsPocket, string>> = {
  medicine: 'Medicine',
  balls: 'Poké Balls',
  discs: 'Discs',
  stones: 'Stones',
  held: 'Held items',
  tools: 'Tools',
  packs: 'Packs',
  found: 'Found goods',
  furniture: 'Furniture',
  clothes: 'Clothes',
};

/** Tools are things a raid is worked with by facing something: they are not found goods. */
const TOOL_EFFECTS = new Set(['rod', 'pickaxe', 'lockpick', 'bike', 'key']);

/** Which pocket a thing is kept in. A disc and a stone are pockets of their own: they are the two used here. */
export function pocketOf(item: ItemDefinition): ThingsPocket {
  if (item.effect.type === 'machine') return 'discs';
  if (item.effect.type === 'evolution-stone') return 'stones';
  if (TOOL_EFFECTS.has(item.effect.type)) return 'tools';
  switch (item.category) {
    case ItemCategory.Medicine:
      return 'medicine';
    case ItemCategory.PokeBall:
      return 'balls';
    case ItemCategory.Held:
      return 'held';
    case ItemCategory.Pack:
      return 'packs';
    case ItemCategory.Furniture:
      return 'furniture';
    case ItemCategory.Wearable:
      return 'clothes';
    default:
      return 'found';
  }
}

/** What a row's ENTER does here: read a disc, use a stone, or nothing but say where it is used. */
export type HomeUse = 'teach' | 'evolve' | null;

export function homeUseOf(item: ItemDefinition): HomeUse {
  if (machineForItem(item)) return 'teach';
  return item.effect.type === 'evolution-stone' ? 'evolve' : null;
}

/**
 * Where a thing is used, in one sentence, for every thing that is not used here.
 * Each names the place in the harbour or the raid it goes to, because the
 * vault is read most by somebody who has found a thing and does not know yet
 * what it is for.
 */
export function whereItIsUsed(item: ItemDefinition): string {
  switch (item.effect.type) {
    case 'machine':
      return 'Press ENTER to read it to one of your Pokémon, here or in a raid.';
    case 'evolution-stone':
      return 'Press ENTER to use it on one of your Pokémon it would evolve.';
    case 'capture-modifier':
      return 'Pack it at the rack in THE RAID ARENA to throw it in a raid.';
    case 'material':
      return 'Brock takes it at his workshop, for the rungs of his ladder.';
    case 'currency':
      return "Spent at Bill's shelf and his berth, and at the boutique.";
    case 'rod':
      return 'Pack it to fish in a raid. In the harbour, face the sea and press SPACE.';
    case 'pickaxe':
      return 'Pack it to dig out a buried exit in a raid.';
    case 'lockpick':
      return 'Pack it to open a locked crate in a raid.';
    case 'key':
      return 'Pack it: it turns its own locked gate in a raid.';
    case 'bike':
      return 'Pack it at the rack and ride it in a raid.';
    case 'pack':
      return 'Wear it into a raid: the pack is chosen at the rack in THE RAID ARENA.';
    case 'errand':
      return 'Take it to whoever asked for it.';
    case 'furniture':
      return 'Put it out in THE BOLTHOLE: press H at home to decorate.';
    case 'wearable':
      return 'Worn from YOUR WARDROBE, upstairs in THE BOLTHOLE.';
    default:
      if (item.category === ItemCategory.Held) {
        return "Give it to a Pokémon on MY PC at home, or BILL'S PC at the Pokémon Center.";
      }
      return 'Pack it at the rack in THE RAID ARENA to use it in a raid.';
  }
}

/** How many of the player's Pokémon a disc or a stone would do something for. */
export function ableCount(item: ItemDefinition, pokemon: readonly Pokemon[]): number {
  const machine = machineForItem(item);
  if (machine) {
    return pokemon.filter(
      (one) => canLearnFromMachine(one.base.id, machine.move) && !one.moves.some((known) => known.base === machine.move),
    ).length;
  }
  if (item.effect.type === 'evolution-stone') {
    return pokemon.filter((one) => evolutionByStone(one.base.id, item.id) !== undefined).length;
  }
  return 0;
}

/** One kind of thing in storage. */
export interface StoredThing {
  readonly item: ItemDefinition;
  readonly count: number;
}

/** The vault's contents, sorted into pockets, emptied pockets left out. Unknown ids are left out too. */
export function storedPockets(
  contents: Readonly<Record<string, number>>,
): readonly { readonly pocket: ThingsPocket; readonly things: readonly StoredThing[] }[] {
  const byPocket = new Map<ThingsPocket, StoredThing[]>();
  for (const [itemId, count] of Object.entries(contents)) {
    const item = getItemById(itemId);
    if (!item || count <= 0) continue;
    const pocket = pocketOf(item);
    byPocket.set(pocket, [...(byPocket.get(pocket) ?? []), { item, count }]);
  }
  return THINGS_POCKETS.flatMap((pocket) => {
    const things = byPocket.get(pocket);
    return things ? [{ pocket, things }] : [];
  });
}

/** What the screen is told: storage, the next raid's pack, and the Pokémon a disc or stone could go to. */
export interface ThingsView {
  readonly contents: Readonly<Record<string, number>>;
  readonly pokemon: readonly Pokemon[];
  /** How many of a thing are packed for the next raid. */
  readonly packed: (itemId: string) => number;
  readonly pack: {
    readonly name: string;
    readonly layout: GridPacking;
    readonly used: number;
    readonly total: number;
  };
}

/**
 * Where a pocket jump lands: the first row of the pocket after (`1`) or before
 * (`-1`) the one the cursor is in, or the first row of the first or last
 * pocket. `pockets` is the pocket of every row, in list order. Storage holds
 * ninety-odd kinds in a playtest's vault, and a row at a time that was ninety
 * presses from MEDICINE to CLOTHES (wave 1's playtest, item 6). Returns the
 * index of the row to move to, or `current` when there is nowhere further.
 */
export function pocketJump(pockets: readonly string[], current: number, step: 1 | -1 | 'first' | 'last'): number {
  const starts = pockets.flatMap((pocket, index) => (index === 0 || pockets[index - 1] !== pocket ? [index] : []));
  if (starts.length === 0) {
    return current;
  }
  if (step === 'first') return starts[0];
  if (step === 'last') return starts[starts.length - 1];
  const here = Math.max(0, starts.filter((start) => start <= current).length - 1);
  if (step === -1 && current > starts[here]) {
    // Partway down a pocket, back goes to its own first row first.
    return starts[here];
  }
  return starts[Math.min(starts.length - 1, Math.max(0, here + step))];
}

function thingRow(view: ThingsView, thing: StoredThing, startsPocket: boolean): string {
  const { item, count } = thing;
  const use = homeUseOf(item);
  // The pane under the list already says what it is and where it is used, so
  // the help bar says only what the keys do here (wave 1's playtest: the same
  // sentence twice on one screen).
  const help = `${item.displayName}: ${
    use === 'teach' ? 'ENTER chooses who learns it.' : use === 'evolve' ? 'ENTER chooses who it evolves.' : 'nothing to use it on here.'
  } LEFT and RIGHT go a pocket at a time.`;
  const packed = view.packed(item.id);
  const tag = packed > 0 ? pixelTag('Packed', 'plain') : '';
  return `<button class="px-row has-icon${startsPocket ? ' starts-pocket' : ''}" data-thing="${item.id}" data-pocket="${pocketOf(item)}" data-shows="${item.id}"${
    use ? ` data-use="${use}"` : ''
  } data-help="${escapeAttribute(help)}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${item.displayName}</strong>${tag}</span></span><span class="px-tag">${itemCountTag(item.id, count)}</span></button>`;
}

function thingDetail(view: ThingsView, thing: StoredThing, first: boolean): string {
  const { item, count } = thing;
  const packed = view.packed(item.id);
  const facts = [`${isCurrency(item.id) ? itemCountTag(item.id, count) : count} in storage`];
  if (packed > 0) {
    facts.push(`${packed} packed for the next raid`);
  }
  const use = homeUseOf(item);
  if (use) {
    const able = ableCount(item, view.pokemon);
    facts.push(`${able} of yours ${use === 'teach' ? 'can learn it' : 'it would evolve'}`);
  }
  return `<div class="px-detail" data-shown-by="${item.id}"${first ? '' : ' hidden'}><span class="px-wrap">${item.description} ${whereItIsUsed(item)}</span><div class="care-options"><small class="px-label">${facts.join(' · ')}</small></div></div>`;
}

/**
 * The pockets as HeartGold's bag stands them: a strip across the top, one icon a
 * pocket - the first thing in it - with the cursor's own pocket lit
 * (`ThingsScene` toggles `is-here` as the cursor moves; nothing is redrawn). It
 * is a picture of where LEFT and RIGHT go, which jump a pocket at a time, so a
 * player sees how many pockets there are and which one they are in without
 * reading a band.
 */
export function pocketStrip(pockets: readonly { readonly pocket: ThingsPocket; readonly things: readonly StoredThing[] }[]): string {
  if (pockets.length < 2) {
    return '';
  }
  // The icons, then every pocket's name, of which only the lit pocket's shows.
  return `<div class="things-pockets" aria-hidden="true">${pockets
    .map(({ pocket, things }, index) => `<span class="things-pocket${index === 0 ? ' is-here' : ''}" data-pocket-tab="${pocket}" title="${escapeAttribute(THINGS_POCKET_LABELS[pocket])}">${itemIcon(things[0].item.id)}</span>`)
    .join('')}${pockets
    .map(({ pocket }, index) => `<span class="things-pocket-name${index === 0 ? ' is-here' : ''}" data-pocket-tab="${pocket}">${THINGS_POCKET_LABELS[pocket]}</span>`)
    .join('')}</div>`;
}

/** The whole body: storage in pockets, and the next raid's pack beneath it as the squares it is. */
export function thingsBody(view: ThingsView): string {
  const pockets = storedPockets(view.contents);
  const strip = pocketStrip(pockets);
  // With the strip over the list, a pocket is named there (and lit while the
  // cursor is in it); in the list a pocket starts on a one-pixel rule rather
  // than a band, because the bands cost two rows of the list at 1280x800. With
  // one pocket there is no strip, and its band names it.
  const rows = pockets
    .flatMap(({ pocket, things }, index) =>
      strip
        ? things.map((thing, at) => thingRow(view, thing, index > 0 && at === 0))
        : [`<h3 class="px-subheading">${THINGS_POCKET_LABELS[pocket]}</h3>`, ...things.map((thing) => thingRow(view, thing, false))],
    )
    .join('');
  const details = pockets
    .flatMap(({ things }) => things)
    .map((thing, index) => thingDetail(view, thing, index === 0))
    .join('');
  const kinds = pockets.reduce((sum, { things }) => sum + things.length, 0);
  const stored = pixelWindow(
    `${strip}<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.supply)}>${
      rows || '<p class="px-empty">Storage is empty. Whatever a raid brings home is kept here.</p>'
    }</div>${details}`,
    { className: 'raid-pockets things-storage', heading: 'In storage', note: `${kinds} ${kinds === 1 ? 'kind' : 'kinds'}` },
  );
  const grid = pixelGrid(view.pack.layout, (itemId) => itemIcon(itemId), { label: 'The next raid pack' });
  const pack = pixelWindow(grid, {
    className: 'pack-window things-pack',
    heading: `Next raid: ${view.pack.name}`,
    note: `${view.pack.used}/${view.pack.total} squares`,
  });
  return `<main class="px-body raid-bag-layout things-layout">${stored}<div class="raid-bag-side">${pack}</div></main>`;
}

/** Who a stone would go to: every Pokémon the player has, with whether it would work, best first. */
export function stoneTargetsBody(item: ItemDefinition, pokemon: readonly { readonly pokemon: Pokemon; readonly box: string }[]): string {
  const rows = pokemon
    .map(({ pokemon: one, box }, index) => {
      const species = evolutionByStone(one.base.id, item.id);
      const help = species
        ? `Use ${item.displayName} on ${one.name}: it would evolve into ${species.name}.`
        : `${one.name}: it won't have any effect.`;
      return `<button class="px-row" data-target="${index}"${species ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${one.name}</strong><small>Lv${one.level}</small></span><small>${box}</small></span><span class="px-tag">${species ? 'Able' : 'Not able'}</span></button>`;
    })
    .join('');
  const able = pokemon.filter(({ pokemon: one }) => evolutionByStone(one.base.id, item.id) !== undefined).length;
  return `<main class="px-body raid-party-layout">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${rows || '<p class="px-empty">You have no Pokémon.</p>'}</div>`,
    { className: 'raid-pockets', heading: `Use ${item.displayName} on`, note: `${able} able` },
  )}</main>`;
}
