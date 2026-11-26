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
  EMPTY_ARRANGEMENT,
  footprintOf,
  getItemById,
  ItemCategory,
  machineForItem,
  packContents,
  type GridArrangement,
  type GridCargo,
  type GridPacking,
  type ItemDefinition,
} from '../items';
import { canLearnFromMachine } from '../pokemon/machines';
import { evolutionByStone, stoneUsers, type Pokemon } from '../pokemon';
import { iconMarkup, itemIcon } from './icons';
import { escapeAttribute, pixelColumns, pixelGrid, pixelPortrait, pixelWindow, COLUMN_MEASURES, type PixelGridGhost } from './pixelUi';

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
 * Where a medicine is given at base: THE BENCH's care chips are the one place
 * (`HubScene.careChips`). This screen said 'nothing to use it on here' with a
 * Pokémon on 2 HP, and players paid Nurse Joy raid time for what a Potion they
 * owned would have done (AI playtest, 22 Nov 2026).
 */
export const MEDICINE_AT_BASE = 'THE BENCH in THE RAID ARENA';

/**
 * Where a thing is used, in one sentence, for every thing that is not used here.
 * Each names the place in the harbour or the raid it goes to, because the
 * vault is read most by somebody who has found a thing and does not know yet
 * what it is for.
 */
export function whereItIsUsed(item: ItemDefinition): string {
  if (item.category === ItemCategory.Medicine) {
    return `Give it to a hurt Pokémon at ${MEDICINE_AT_BASE}, or pack it for a raid.`;
  }
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

/** The stash is this many squares across; it grows downwards, never sideways. */
export const STASH_COLUMNS = 8;
/** However little is kept, the stash shows at least this many rows. */
export const STASH_MIN_ROWS = 7;
/** How far down a stash may be laid out before it is trimmed to what it holds. */
const STASH_DEPTH = 400;

/** The pocket tab that shows every pocket at once. */
export const ALL_POCKETS = 'all';
export type PocketTab = ThingsPocket | typeof ALL_POCKETS;

/** A pocket's name on its tab: one short word, as the mock-up's strip has them. */
export const POCKET_TAB_WORDS: Readonly<Record<PocketTab, string>> = {
  all: 'All',
  medicine: 'Medicine',
  balls: 'Balls',
  discs: 'Discs',
  stones: 'Stones',
  held: 'Held',
  tools: 'Tools',
  packs: 'Packs',
  found: 'Found',
  furniture: 'Furniture',
  clothes: 'Clothes',
};

/**
 * Every kind of thing at base as one piece of the stash grid: its own
 * footprint (`items.ts`), and the kind as its id, because the stash draws a
 * kind once with how many there are rather than a block a stack as the pack
 * does. In pocket order, then name, so an unarranged stash reads medicine
 * first and clothes last.
 */
export function stashCargo(contents: Readonly<Record<string, number>>): GridCargo[] {
  return storedPockets(contents).flatMap(({ things }) =>
    [...things]
      .sort((a, b) => a.item.displayName.localeCompare(b.item.displayName))
      .map(({ item }) => {
        const footprint = footprintOf(item.id);
        return { cargoId: item.id, name: item.displayName, width: footprint.width, height: footprint.height };
      }),
  );
}

/**
 * The stash as squares (the captain, 25 Nov 2026: "how you can drag things
 * around, just like Tarkov"): every kind seated where the player put it
 * (`raidProgress.stashArrangement`) and the rest laid in after, then cut to
 * what it holds and one spare row under that, so there is always a row to put
 * a thing down in and the grid grows as it fills.
 */
export function stashLayout(contents: Readonly<Record<string, number>>, arrangement: GridArrangement = EMPTY_ARRANGEMENT): GridPacking {
  const laid = packContents({}, { width: STASH_COLUMNS, height: STASH_DEPTH }, stashCargo(contents), arrangement);
  const bottom = laid.cargo.reduce((deepest, piece) => Math.max(deepest, piece.y + piece.height), 0);
  const height = Math.max(STASH_MIN_ROWS, bottom + 1);
  return { ...laid, size: { width: STASH_COLUMNS, height }, cellsTotal: STASH_COLUMNS * height };
}

/** The pockets the stash has something in, after ALL, for its tabs. */
export function pocketTabs(contents: Readonly<Record<string, number>>): readonly PocketTab[] {
  return [ALL_POCKETS, ...storedPockets(contents).map(({ pocket }) => pocket)];
}

/** One Pokémon in the locker: the partner's own place, or one held in the container's squares. */
export interface LockerPokemon {
  readonly name: string;
  readonly dexId: number;
  readonly shiny: boolean;
  /** Squares it takes in the container; absent for the partner, who has a place of its own. */
  readonly squares?: number;
}

/** What YOUR THINGS draws. */
export interface ThingsScreen {
  /** What is at base and not packed, by id. */
  readonly stash: Readonly<Record<string, number>>;
  readonly stashArrangement: GridArrangement;
  readonly pocket: PocketTab;
  readonly pack: {
    readonly name: string;
    readonly itemId?: string;
    readonly layout: GridPacking;
    readonly used: number;
    readonly total: number;
  };
  readonly locker: {
    readonly layout: GridPacking;
    readonly partner?: LockerPokemon;
    readonly pokemon: readonly LockerPokemon[];
  };
  /** What is being carried over each grid, if anything. */
  readonly ghosts?: { readonly stash?: PixelGridGhost; readonly pack?: PixelGridGhost };
}

/** The partner's mark: a green rosette, drawn, because the face has no such glyph. */
export function rosette(): string {
  return '<span class="things-rosette" role="img" aria-label="Partner"></span>';
}

function stashCard(view: ThingsScreen): string {
  const tabs = pocketTabs(view.stash);
  const layout = stashLayout(view.stash, view.stashArrangement);
  const grid = pixelGrid(layout, (itemId) => itemIcon(itemId), {
    className: 'things-stash-grid',
    label: 'At base',
    arrange: { name: 'stash', ghost: view.ghosts?.stash, help: 'ENTER puts one in the pack · R turns it · drag it anywhere' },
    cargoBody: (piece) => {
      const count = view.stash[piece.cargoId] ?? 0;
      return `${itemIcon(piece.cargoId, piece.name)}${count > 1 ? `<b>×${count}</b>` : ''}`;
    },
    cargoClass: (piece) => {
      const item = getItemById(piece.cargoId);
      return view.pocket !== ALL_POCKETS && item && pocketOf(item) !== view.pocket ? 'is-dim' : '';
    },
  });
  const strip = tabs
    .map(
      (tab) =>
        `<button type="button" class="things-tab${tab === view.pocket ? ' is-here' : ''}" data-pocket-tab="${tab}" tabindex="-1">${POCKET_TAB_WORDS[tab]}</button>`,
    )
    .join('');
  const empty =
    Object.keys(view.stash).length === 0 ? '<p class="px-empty things-empty">Nothing at base.</p>' : '';
  return `<section class="px-window things-stash"><header class="px-heading things-tabs"><span class="things-tab-strip">${strip}</span><small>At base</small></header><div class="px-scroll things-stash-scroll">${grid}${empty}</div></section>`;
}

function packCard(view: ThingsScreen): string {
  const grid = pixelGrid(view.pack.layout, (itemId) => itemIcon(itemId), {
    className: 'things-pack-grid',
    label: `The next raid's ${view.pack.name}`,
    arrange: { name: 'pack', ghost: view.ghosts?.pack, help: 'ENTER picks it up · BACKSPACE takes one out · R turns it' },
  });
  const pack = view.pack.itemId ? itemIcon(view.pack.itemId, view.pack.name) : '';
  return `<section class="px-window px-tone-risk things-pack"><header class="px-heading"><span class="things-pack-name">${pack}${escapeAttribute(view.pack.name)}</span><small>At risk</small></header><div class="things-pack-body">${grid}<p class="things-count" aria-label="${view.pack.used} of ${view.pack.total} squares"><b>${view.pack.used}</b><small>of</small><b>${view.pack.total}</b></p></div></section>`;
}

function lockerPlace(one: LockerPokemon, partner: boolean): string {
  return `<div class="things-locker-place${partner ? ' is-partner' : ''}">${pixelPortrait(one.dexId, one.name, one.shiny)}<span class="things-locker-name">${partner ? rosette() : ''}${escapeAttribute(one.name)}</span><small>${partner ? 'Its own place' : `${one.squares ?? 0} squares`}</small></div>`;
}

function lockerCard(view: ThingsScreen): string {
  const places = [
    ...view.locker.pokemon.map((one) => lockerPlace(one, false)),
    ...(view.locker.partner ? [lockerPlace(view.locker.partner, true)] : []),
  ];
  const items =
    view.locker.layout.placements.length > 0
      ? pixelGrid(view.locker.layout, (itemId) => itemIcon(itemId), { className: 'is-secure things-locker-grid', label: 'In the locker' })
      : '';
  const body = places.length > 0 || items ? `${places.join('')}${items}` : '<p class="px-empty">Empty</p>';
  return `<section class="px-window px-tone-secure things-locker"><header class="px-heading"><span class="things-lock-name">${iconMarkup('padlock', '')}The locker</span><small>Safe</small></header><div class="things-locker-body">${body}</div></section>`;
}

/** Where the thing in hand is: still in the stash, in the pack, or being carried. */
export type HandPlace = 'stash' | 'pack' | 'carrying';

/** A button with its key inside it, as every button on these screens says what it does. */
function keyButton(key: string, words: string, attribute: string, tone: '' | 'is-primary' | 'is-danger' = '', disabled = false): string {
  return `<button type="button" class="px-window px-button things-key${tone ? ` ${tone}` : ''}" ${attribute} tabindex="-1"${disabled ? ' aria-disabled="true"' : ''}><span class="things-cap">${key}</span>${words}</button>`;
}

/**
 * The card under the stash: the thing the cursor is on, in hand - its picture,
 * what it does in a few words, how many squares it takes - and what the keys do
 * to it now, each a button with the key in it.
 */
export function handCard(item: ItemDefinition | undefined, place: HandPlace, canPack: boolean): string {
  if (!item) {
    return '<div class="things-hand-thing"><div class="things-hand-words"><small>In hand</small><span>Nothing</span></div></div>';
  }
  const { width, height } = footprintOf(item.id);
  const squares = width * height;
  const use = homeUseOf(item);
  const buttons =
    place === 'carrying'
      ? [
          keyButton('ENTER', 'Put down', 'data-hand="drop"', 'is-primary'),
          keyButton('R', 'Turn', 'data-hand="turn"'),
          keyButton('ESC', 'Put back', 'data-hand="cancel"'),
        ]
      : place === 'pack'
        ? [
            keyButton('ENTER', 'Pick up', 'data-hand="take"'),
            keyButton('BKSP', 'Take one out', 'data-hand="out"', 'is-danger'),
            keyButton('R', 'Turn', 'data-hand="turn"'),
          ]
        : [
            keyButton('ENTER', 'Put in the pack', 'data-hand="pack"', 'is-primary', !canPack),
            ...(use ? [keyButton('U', use === 'teach' ? 'Teach' : 'Use', 'data-hand="use"')] : []),
            keyButton('R', 'Turn', 'data-hand="turn"'),
          ];
  return `<div class="things-hand-thing">${itemIcon(item.id, item.displayName)}<div class="things-hand-words"><span><small>${
    place === 'carrying' ? 'Carrying' : 'In hand'
  }</small> ${escapeAttribute(item.displayName)}</span><small>${squares} ${squares === 1 ? 'square' : 'squares'} · ${escapeAttribute(
    item.description,
  )}</small></div></div><div class="things-hand-keys">${buttons.join('')}</div>`;
}

/** The whole screen: the stash, the raid pack and the locker, and what is in hand. */
export function thingsScreen(view: ThingsScreen, hand: string): string {
  return `<main class="px-body things-layout">${stashCard(view)}${packCard(view)}${lockerCard(view)}<section class="px-window things-hand" data-hand-card>${hand}</section></main>`;
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
  // With nobody able the cursor has no row to stand on, so no row's help is
  // ever shown and the list just said NOT ABLE twice with no reason (a Fire
  // Stone with a Charmander and a Raichu, scenario loop, 23 Nov 2026).
  const users = stoneUsers(item.id).map((species) => species.name.toUpperCase());
  const whoFor =
    able === 0 && pokemon.length > 0 && users.length > 0
      ? `<p class="px-wrap px-empty">Nobody you have can use a ${escapeAttribute(item.displayName)}. It evolves ${
          users.length === 1 ? users[0] : `${users.slice(0, -1).join(', ')} and ${users[users.length - 1]}`
        }.</p>`
      : '';
  return `<main class="px-body raid-party-layout">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${rows || '<p class="px-empty">You have no Pokémon.</p>'}</div>${whoFor}`,
    { className: 'raid-pockets', heading: `Use ${item.displayName} on`, note: `${able} able` },
  )}</main>`;
}
