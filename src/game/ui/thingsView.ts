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
  isFoundOnly,
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
import { pixelMonIcon } from './monIcon';
import { escapeAttribute, pixelColumns, pixelGrid, pixelWindow, COLUMN_MEASURES, type PixelGridGhost } from './pixelUi';

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
 * Where a hurt Pokémon is mended at base: the POKÉMON CENTER, for nothing -
 * HP and status are free between raids, and only a faint costs raid time
 * (`hub/recovery.ts`), which no medicine undoes. So a medicine at home is for
 * packing. This used to send a player to THE BENCH's care chips, which went
 * with the bench when it became YOUR TEAM (#919).
 */
export const MEDICINE_AT_BASE = 'the POKÉMON CENTER';

/**
 * Where a thing is used, in one sentence, for every thing that is not used here.
 * Each names the place in the harbour or the raid it goes to, because the
 * vault is read most by somebody who has found a thing and does not know yet
 * what it is for.
 */
export function whereItIsUsed(item: ItemDefinition): string {
  if (item.category === ItemCategory.Medicine) {
    return `Pack it to use in a raid. At home, ${MEDICINE_AT_BASE} heals for nothing.`;
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

/** What a wipe does to one of the next raid's team: always home, kept by the locker, or lost. */
export type TeamFate = 'partner' | 'locked' | 'risk';

/** One of the next raid's team, as its strip draws it. */
export interface TeamMember {
  /** Its stash id, for L to keep it in the locker or let it go. */
  readonly id: string;
  readonly name: string;
  readonly speciesId: string;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly fate: TeamFate;
}

/**
 * Whether a thing can never be carried into a raid: found goods for Brock,
 * clothes, furniture, an errand's parcel. A pack is worn rather than packed,
 * so it is not one of these.
 */
export function staysHome(itemId: string): boolean {
  return isFoundOnly(itemId) && getItemById(itemId)?.effect.type !== 'pack';
}

/** What YOUR THINGS draws. */
export interface ThingsScreen {
  /** What is at base and not packed, by id. */
  readonly stash: Readonly<Record<string, number>>;
  readonly stashArrangement: GridArrangement;
  readonly pocket: PocketTab;
  /** Who goes on the next raid, in order, each with what a wipe would do to them. */
  readonly team: readonly TeamMember[];
  readonly pack: {
    readonly name: string;
    readonly itemId?: string;
    readonly layout: GridPacking;
    readonly used: number;
    readonly total: number;
    /** How many of each kind the locker keeps: the first of that kind's blocks are lined. */
    readonly locked: Readonly<Record<string, number>>;
  };
  /** The locker's own squares: what it keeps, laid out as it holds it. */
  readonly locker: {
    readonly layout: GridPacking;
    readonly used: number;
    readonly total: number;
  };
  /** Whether the locker card offers ROOM FOR A FIND. */
  readonly findRoom?: boolean;
  /** What is being carried over each grid, if anything. */
  readonly ghosts?: { readonly stash?: PixelGridGhost; readonly pack?: PixelGridGhost; readonly locker?: PixelGridGhost };
}

/** The partner's mark: a green rosette, drawn, because the face has no such glyph. */
export function rosette(): string {
  return '<span class="things-rosette" role="img" aria-label="Partner"></span>';
}

const FATE_WORDS: Readonly<Record<TeamFate, string>> = {
  partner: 'always comes home',
  locked: 'kept by the locker',
  risk: 'lost on a wipe',
};

function teamMark(fate: TeamFate): string {
  if (fate === 'partner') {
    return rosette();
  }
  if (fate === 'locked') {
    return iconMarkup('padlock', '');
  }
  return '<span class="things-torn" aria-hidden="true"></span>';
}

/**
 * A thing two squares or more each way is drawn twice as big again, so a
 * parts crate is a crate filling its four squares rather than a small picture
 * adrift in a big white one.
 */
function bigBlock(piece: { readonly width: number; readonly height: number }): string {
  return Math.min(piece.width, piece.height) >= 2 ? 'is-big' : '';
}

function stashCard(view: ThingsScreen): string {
  const tabs = pocketTabs(view.stash);
  const layout = stashLayout(view.stash, view.stashArrangement);
  const grid = pixelGrid(layout, (itemId) => itemIcon(itemId), {
    className: 'things-stash-grid',
    label: 'Home',
    arrange: { name: 'stash', ghost: view.ghosts?.stash },
    cargoBody: (piece) => {
      const count = view.stash[piece.cargoId] ?? 0;
      const home = staysHome(piece.cargoId) ? '<span class="things-house things-home-mark" role="img" aria-label="Stays at home"></span>' : '';
      return `${itemIcon(piece.cargoId, piece.name)}${home}${count > 1 ? `<b>×${count}</b>` : ''}`;
    },
    cargoClass: (piece) => {
      const item = getItemById(piece.cargoId);
      const dim = view.pocket !== ALL_POCKETS && item && pocketOf(item) !== view.pocket ? 'is-dim' : '';
      return [dim, staysHome(piece.cargoId) ? 'is-home-only' : '', bigBlock(piece)].filter(Boolean).join(' ');
    },
  });
  const strip = tabs
    .map(
      (tab) =>
        `<button type="button" class="things-tab${tab === view.pocket ? ' is-here' : ''}" data-pocket-tab="${tab}" tabindex="-1">${POCKET_TAB_WORDS[tab]}</button>`,
    )
    .join('');
  const empty = Object.keys(view.stash).length === 0 ? '<p class="px-empty things-empty">Nothing at home.</p>' : '';
  return `<section class="px-window px-tone-secure things-stash"><header class="px-heading"><span class="things-side-name"><span class="things-house" aria-hidden="true"></span>Home</span><small>Safe</small></header><nav class="things-tab-strip"><span class="things-cap" aria-hidden="true">Q</span>${strip}<span class="things-cap" aria-hidden="true">E</span></nav><div class="px-scroll things-stash-scroll">${grid}${empty}</div></section>`;
}

/** How many go on a raid at most: the strip always shows this many places. */
const TEAM_PLACES = 6;

function teamCard(view: ThingsScreen): string {
  // Each of the team is a control the cursor lands on, so L can keep it in the locker.
  const members = view.team
    .map(
      (one) =>
        `<span class="things-place"><button type="button" class="things-member is-${one.fate}" data-team-member="${escapeAttribute(
          one.id,
        )}" tabindex="-1" aria-label="${escapeAttribute(`${one.name}: ${FATE_WORDS[one.fate]}`)}">${pixelMonIcon({
          name: one.name,
          currentHp: one.currentHp,
          maxHp: one.maxHp,
          base: { id: one.speciesId },
        })}<span class="things-member-mark">${teamMark(one.fate)}</span></button><small class="things-tag">${
          one.fate === 'risk' ? 'At risk' : one.fate === 'partner' ? 'Partner' : 'Safe'
        }</small></span>`,
    )
    .join('');
  // An empty place is YOUR TEAM's door: clicked, it opens the screen where who goes is chosen.
  const free = '<span class="things-place"><button type="button" class="things-member is-free" data-team-open tabindex="-1" aria-label="Your team"></button><small class="things-tag"></small></span>'.repeat(
    Math.max(0, TEAM_PLACES - view.team.length),
  );
  const worn = view.pack.itemId
    ? `<span class="things-place things-worn-place"><span class="things-worn" role="img" aria-label="Wearing the ${escapeAttribute(
        view.pack.name,
      )}">${itemIcon(view.pack.itemId, view.pack.name)}</span><small class="things-tag">Worn</small></span>`
    : '';
  return `<section class="px-window things-team"><header class="px-heading"><span class="things-side-name">Next raid</span><small>Team ${view.team.length} of ${TEAM_PLACES}</small></header><div class="things-team-strip">${members}${free}${worn}</div></section>`;
}

function packCard(view: ThingsScreen): string {
  const lined = new Map(Object.entries(view.pack.locked));
  const grid = pixelGrid(view.pack.layout, (itemId) => itemIcon(itemId), {
    className: 'things-pack-grid',
    label: `The next raid's ${view.pack.name}`,
    arrange: { name: 'pack', ghost: view.ghosts?.pack },
    // The locker keeps so many of a kind, and those are the first blocks of it.
    blockClass: (placement) => {
      const left = lined.get(placement.itemId) ?? 0;
      lined.set(placement.itemId, left - placement.quantity);
      return [left > 0 ? 'is-locked' : '', bigBlock(placement)].filter(Boolean).join(' ');
    },
  });
  return `<section class="px-window px-tone-risk things-pack"><header class="px-heading"><span class="things-pack-name">${escapeAttribute(
    view.pack.name,
  )}<b class="things-count" aria-label="${view.pack.used} of ${view.pack.total} squares">${view.pack.used}/${view.pack.total}</b></span><small>Lost on a wipe</small></header><div class="things-pack-body">${grid}</div></section>`;
}

function lockerCard(view: ThingsScreen): string {
  // What it keeps of the pack is drawn as it is drawn in the pack - the thing,
  // lined, with the padlock on its corner - so the two read as one thing kept,
  // never two; room kept for a find is that find's shape, faded.
  const grid = pixelGrid(view.locker.layout, (itemId) => itemIcon(itemId), {
    className: 'is-secure things-locker-grid',
    label: 'What the locker keeps',
    arrange: { name: 'locker', ghost: view.ghosts?.locker },
    blockClass: (placement) => [isFoundOnly(placement.itemId) ? 'is-kept-free' : 'is-locked', bigBlock(placement)].filter(Boolean).join(' '),
  });
  return `<section class="px-window px-tone-secure things-locker"><header class="px-heading"><span class="things-lock-name">${iconMarkup(
    'padlock',
    '',
  )}Locker</span></header><div class="things-locker-body">${grid}<p class="things-kept"><b class="things-count" aria-label="${view.locker.used} of ${
    view.locker.total
  } squares">${view.locker.used}/${view.locker.total}</b> Kept on a wipe</p>${
    view.findRoom ? '<button type="button" class="px-window px-button things-find-open" data-find-open tabindex="-1">Room for a find</button>' : ''
  }</div></section>`;
}

/** Where the thing under the cursor is: still at home, in the pack, in the locker, or being carried. */
export type HandPlace = 'stash' | 'pack' | 'locker' | 'carrying';

/** A button with its key inside it, as every button on these screens says what it does. */
function keyButton(key: string, words: string, attribute: string, tone: '' | 'is-primary' | 'is-danger' = '', disabled = false): string {
  return `<button type="button" class="px-window px-button things-key${tone ? ` ${tone}` : ''}" ${attribute} tabindex="-1"${disabled ? ' aria-disabled="true"' : ''}><span class="things-cap">${key}</span>${words}</button>`;
}

/** What the card offers for the thing the cursor is on. */
export interface HandOptions {
  /** There is room in the pack for one more of it. */
  readonly canPack: boolean;
  /** For a thing in the pack: the locker already keeps this one. */
  readonly locked?: boolean;
  /** For a thing in the pack: the locker has room to keep one more of it. */
  readonly canLock?: boolean;
  /** For a find at home: the locker already keeps room for one. */
  readonly roomKept?: boolean;
}

/**
 * The card under the stash: the thing the cursor is on - its picture, what it
 * does in a few words, how many squares it takes - and what the keys do to it
 * now, each a button with the key in it. CARRYING heads it only while it is
 * picked up; otherwise it is just the thing's name.
 */
export function handCard(item: ItemDefinition | undefined, place: HandPlace, options: HandOptions): string {
  if (!item) {
    return '<div class="things-hand-thing"><div class="things-hand-words"><span>Nothing here</span></div></div>';
  }
  const { width, height } = footprintOf(item.id);
  const squares = width * height;
  const use = homeUseOf(item);
  const home = staysHome(item.id);
  const buttons =
    place === 'carrying'
      ? [
          keyButton('ENTER', 'Put down', 'data-hand="drop"', 'is-primary'),
          keyButton('R', 'Turn', 'data-hand="turn"'),
          keyButton('ESC', 'Put back', 'data-hand="cancel"'),
        ]
      : place === 'pack'
        ? [
            keyButton(
              'L',
              options.locked ? 'Unlock' : options.canLock === false ? 'Locker full' : 'Lock',
              'data-hand="lock"',
              options.locked ? '' : 'is-primary',
              !options.locked && options.canLock === false,
            ),
            keyButton('BKSP', 'Take one out', 'data-hand="out"', 'is-danger'),
            keyButton('R', 'Turn', 'data-hand="turn"'),
          ]
        : place === 'locker'
          ? [keyButton('BKSP', 'Unlock', 'data-hand="out"', 'is-danger')]
          : [
              ...(home
                ? isFoundOnly(item.id)
                  ? [
                      options.roomKept
                        ? keyButton('L', 'Room kept', 'data-hand="lock"', '', options.canLock === false)
                        : keyButton('L', options.canLock === false ? 'Locker full' : 'Keep room', 'data-hand="lock"', '', options.canLock === false),
                    ]
                  : []
                : [
                    keyButton(
                      'ENTER',
                      item.effect.type === 'pack' ? 'Wear it' : 'Put in the pack',
                      'data-hand="pack"',
                      'is-primary',
                      !options.canPack,
                    ),
                  ]),
              ...(use ? [keyButton('U', use === 'teach' ? 'Teach' : 'Use', 'data-hand="use"')] : []),
              keyButton('R', 'Turn', 'data-hand="turn"'),
            ];
  const size = `${squares} ${squares === 1 ? 'square' : 'squares'}`;
  const tag = home && place === 'stash' ? ' <span class="things-home-tag"><span class="things-house" aria-hidden="true"></span>Home only</span>' : '';
  return `<div class="things-hand-thing">${itemIcon(item.id, item.displayName)}<div class="things-hand-words"><span>${
    place === 'carrying' ? '<small>Carrying</small> ' : ''
  }${escapeAttribute(item.displayName)}${tag}</span><small>${size} · ${escapeAttribute(item.description)}</small></div></div><div class="things-hand-keys">${buttons.join('')}</div>`;
}

/** What the card says of one of the team: who, how much of the locker it would take, and L. */
export function memberCard(
  pokemon: { readonly name: string; readonly level: number; readonly currentHp: number; readonly maxHp: number; readonly base: { readonly id: string } },
  options: {
    readonly fate: TeamFate;
    readonly squares: number;
    readonly canLock: boolean;
    /** Who the locker would let go to keep this one, when it has no place left. */
    readonly swapsOut?: string;
  },
): string {
  const button =
    options.fate === 'partner'
      ? ''
      : keyButton(
          'L',
          options.fate === 'locked'
            ? 'Unlock'
            : !options.canLock
              ? 'Too big'
              : options.swapsOut
                ? `Lock · ${escapeAttribute(options.swapsOut)} out`
                : 'Lock',
          'data-hand="lock"',
          options.fate === 'locked' ? '' : 'is-primary',
          options.fate !== 'locked' && !options.canLock,
        );
  const said = options.fate === 'partner' ? `Partner · ${FATE_WORDS.partner}` : `${options.squares} squares · ${FATE_WORDS[options.fate]}`;
  return `<div class="things-hand-thing">${pixelMonIcon(pokemon)}<div class="things-hand-words"><span>${escapeAttribute(
    pokemon.name,
  )} <small>Lv${pokemon.level}</small></span><small>${escapeAttribute(said)}</small></div></div><div class="things-hand-keys">${button}</div>`;
}

/** What the card says on the locker's ROOM FOR A FIND button. */
export function findDoorCard(): string {
  return `<div class="things-hand-thing">${iconMarkup('padlock', '')}<div class="things-hand-words"><span>Room for a find</span><small>Squares the locker keeps open for something found on the raid.</small></div></div><div class="things-hand-keys">${keyButton(
    'ENTER',
    'Open',
    'data-hand="finds"',
    'is-primary',
  )}</div>`;
}

/** What the card says on an empty place of the team: P is YOUR TEAM, where who goes is chosen. */
export function teamDoorCard(): string {
  return `<div class="things-hand-thing"><div class="things-hand-words"><span>A free place</span></div></div><div class="things-hand-keys">${keyButton(
    'P',
    'Your team',
    'data-hand="team"',
    'is-primary',
  )}</div>`;
}

/** One find the locker can keep room for, as its list draws it. */
export interface FindRoomRow {
  readonly itemId: string;
  readonly name: string;
  /** Squares one of it takes. */
  readonly squares: number;
  /** How many of it the locker keeps room for now. */
  readonly kept: number;
  /** Whether the locker has room for one more. */
  readonly canKeep: boolean;
}

/**
 * ROOM FOR A FIND: every found kind the locker can hold squares open for, with
 * how many it keeps room for now. ENTER keeps room for one more, BACKSPACE
 * lets one go; the locker's own squares stand beside the list.
 */
export function findRoomBody(rows: readonly FindRoomRow[], locker: ThingsScreen['locker']): string {
  const list = rows
    .map(
      (row, index) =>
        `<button type="button" class="px-row has-icon things-find${row.kept > 0 ? ' is-kept' : ''}" data-find="${escapeAttribute(row.itemId)}" data-find-index="${index}"${
          row.canKeep || row.kept > 0 ? '' : ' aria-disabled="true"'
        }>${itemIcon(row.itemId, row.name)}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeAttribute(
          row.name,
        )}</strong><small>${row.squares} ${row.squares === 1 ? 'square' : 'squares'}</small></span></span><span class="px-tag${row.kept > 0 ? ' px-tag-good' : ''}">${
          row.kept > 0 ? `Kept ×${row.kept}` : row.canKeep ? 'Keep room' : 'No room'
        }</span></button>`,
    )
    .join('');
  return `<main class="px-body things-finds">${pixelWindow(`<div class="px-list px-scroll">${list || '<p class="px-empty">Nothing to keep room for.</p>'}</div>`, {
    className: 'things-find-list',
    heading: 'Room for a find',
  })}${lockerCard({ ...emptyScreen, locker })}</main>`;
}

const emptyScreen: ThingsScreen = {
  stash: {},
  stashArrangement: EMPTY_ARRANGEMENT,
  pocket: ALL_POCKETS,
  team: [],
  pack: { name: '', layout: packContents({}, { width: 0, height: 0 }), used: 0, total: 0, locked: {} },
  locker: { layout: packContents({}, { width: 0, height: 0 }), used: 0, total: 0 },
};

/** The whole screen: home on the left; the next raid's team, pack and locker on the right; what the cursor is on underneath. */
export function thingsScreen(view: ThingsScreen, hand: string): string {
  return `<main class="px-body things-layout">${stashCard(view)}${teamCard(view)}${packCard(view)}${lockerCard(view)}<section class="px-window things-hand" data-hand-card>${hand}</section></main>`;
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
