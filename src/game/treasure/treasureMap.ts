import type { ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { formatMoney } from '../items/items';

/**
 * THE TREASURE MAP: an old sea chart, torn in four, that leads to a
 * smugglers' chest in Greystone Vale. Everything about it is here as data -
 * the pieces, the wall's slots, what MARLOW says - so a fifth piece is a row
 * in `CHART_PIECES` and a bigger `CHART_GRID`, and nothing else.
 *
 * The story, in the order a player meets it:
 *
 * 1. **A bottle on THE BEACH.** The first piece washes up in the harbour, on
 *    the sand past the pleasure pier (`BEACH_BOTTLE`), and is picked up into
 *    the vault: no raid, nothing at risk. It lies there until the vault holds
 *    it or the wall does.
 * 2. **MARLOW, at THE GREAT LIBRARY.** An old keeper of charts by the end
 *    bookcase. Shown the bottled chart he opens that bookcase for good
 *    (`TreasureHunt.roomOpen`) and takes the player through into THE CHART
 *    ROOM, a room of its own behind the library.
 * 3. **The wall.** A board with a slot for every piece (`CHART_GRID`). A piece
 *    the vault holds is pinned up by facing the wall; MARLOW looks it over and
 *    says what he sees. The first time, he decides the chart is the player's
 *    to finish: they and their Pokémon are the mighty sort. The chart is
 *    SMUGGLERS' COVE itself, drawn off the vale's own map (`chartWall.ts`), so
 *    each piece shows a real part of the place the X is in.
 * 4. **The torn charts** are the vale's three chart secrets
 *    (`../world/secrets.ts`), found under their own skies and carried home at
 *    risk as every secret is. Each pinned is out of the vault for good and
 *    stays on the wall.
 * 5. **X marks the spot.** With every piece up the chart is whole, and a raid
 *    that sets out with it whole opens the last secret, `TREASURE_SECRET_ID`:
 *    a hidden spot in SMUGGLERS' COVE that holds the SEA CHEST. It is found,
 *    carried home and lost with the pack like any other secret's reward.
 *    **From then the hunt is said as one goal, in the same few words wherever
 *    a player looks** (`TREASURE_GOAL`, `treasureGoalLines`): MARLOW and the
 *    board, Oak's chart table, a red X on THE RAID ARENA's telescope, and in
 *    the raid the field guide, Oak's radio and an X on the sand itself.
 * 6. **The chest** is carried to MARLOW, who opens it (`CHEST_CONTENTS`, and
 *    `CHEST_POKEMON` in an old POKé BALL packed among them) and keeps the
 *    empty chest on show in his room.
 *
 * What the save holds is `TreasureHunt`: whether the room is open, which
 * pieces are pinned and whether the chest has been opened. Everything else -
 * which pieces are in hand, whether the bottle is still on the sand, what
 * MARLOW says next - is derived from that and the vault (`huntStage`).
 */

export interface TreasureHunt {
  /** MARLOW has opened the bookcase into THE CHART ROOM: it stands open for good. */
  readonly roomOpen: boolean;
  /** The pieces pinned on THE CHART ROOM's wall, by piece id, in the order they went up. */
  readonly pinned: readonly string[];
  /** The SEA CHEST has been opened, and what was in it handed over. */
  readonly chestOpened: boolean;
}

export const NO_TREASURE_HUNT: TreasureHunt = { roomOpen: false, pinned: [], chestOpened: false };

/** Where a piece is found. */
export type ChartPieceSource =
  /** Washed up in the harbour, lying at `BEACH_BOTTLE` until picked up. */
  | { readonly kind: 'beach' }
  /** One of the vale's secrets (`../world/secrets.ts`), whose reward it is. */
  | { readonly kind: 'secret'; readonly secretId: string };

export interface ChartPiece {
  readonly id: string;
  /** The item it is while it is carried: found-only, a relic for the library. */
  readonly itemId: ItemId;
  /** Where on the wall's grid it goes, in slots. */
  readonly slot: { readonly column: number; readonly row: number };
  readonly from: ChartPieceSource;
  /** What MARLOW says as it goes up, after the line saying it was pinned. */
  readonly pinnedLines: readonly string[];
}

/** The wall's slots: the chart is this many pieces across and down. */
export const CHART_GRID = { columns: 2, rows: 2 } as const;

export const CHART_PIECES: readonly ChartPiece[] = [
  {
    id: 'shore',
    itemId: 'bottled-chart',
    slot: { column: 0, row: 0 },
    from: { kind: 'beach' },
    pinnedLines: ['MARLOW: Open sea, and a ship coming in. Coming in to where?'],
  },
  {
    id: 'moor',
    itemId: 'chart-piece-1',
    slot: { column: 1, row: 0 },
    from: { kind: 'secret', secretId: 'the-long-shadow' },
    pinnedLines: ['MARLOW: A cliff top, and steps going down. The red line starts here!'],
  },
  {
    id: 'hollow',
    itemId: 'chart-piece-2',
    slot: { column: 0, row: 1 },
    from: { kind: 'secret', secretId: 'the-tappers-sunday' },
    pinnedLines: ["MARLOW: A long jetty, and a name on the water! SMUGGLERS' COVE."],
  },
  {
    id: 'fold',
    itemId: 'chart-piece-3',
    slot: { column: 1, row: 1 },
    from: { kind: 'secret', secretId: 'the-lost-fold' },
    pinnedLines: ['MARLOW: A boat shed under a cliff... and an X. It is always an X.'],
  },
];

/** The secret the whole chart opens: the chest's hidden spot in SMUGGLERS' COVE. */
export const TREASURE_SECRET_ID = 'x-marks-the-spot';
/** Where that secret is, as the vale's districts name it. */
export const TREASURE_PLACE = "SMUGGLERS' COVE";
/** What the hidden spot holds: carried home to MARLOW, who opens it. */
export const CHEST_ITEM_ID = 'sea-chest' satisfies ItemId;

/**
 * What is in the chest, handed over as MARLOW opens it. It is the hunt's one
 * reward and it is held to the game (`treasureMap.test.ts`): the money is a
 * few raids' worth of the most a raid's trail can pay, and the pack is the
 * Hauler frame a raid can already find as a prize - the biggest thing anybody
 * carries, and lost with everything in it on a wipe, like every pack.
 */
export const CHEST_CONTENTS: readonly { readonly itemId: ItemId; readonly quantity: number }[] = [
  { itemId: 'money', quantity: 600 },
  { itemId: 'hauler-frame', quantity: 1 },
  { itemId: 'great-ball', quantity: 5 },
];

/**
 * And the rare find packed among the kit: an old POKé BALL with something
 * still in it, and what is in it is **shiny**. The vale's other certain
 * shinies are fought for under a sky (THE RED ONE, the pink Butterfree); this
 * one is handed over, at the end of the longest hunt the vale has. An EEVEE
 * because FireRed keeps its own in a ball on a table in a back room, behind a
 * door nobody shows you, and because of all the kinds it is the one whose
 * owner still gets to choose what it becomes. Lv 25 is FireRed's. BILL gives
 * an ordinary one for his Old Amber (`hub/errands.ts`); the Pokédex lists the
 * chest beside him (`hub/pokedexSources.ts`).
 */
export const CHEST_POKEMON = { speciesId: 'eevee', level: 25, shiny: true } as const;

/**
 * The hunt's goal once the chart is whole, in the words every screen that
 * names it uses: where the X is, what is under it and who it is carried to.
 * Few and plain, because it is read at a glance.
 */
export const TREASURE_GOAL = {
  title: 'X MARKS THE SPOT',
  /** What is under the X. */
  prize: 'SEA CHEST',
  /** Where in the cove, as somebody standing in it would be told. */
  spot: 'under the cliff, past the boat shed',
} as const;

/**
 * Where the bottle lies on THE BEACH: past the pleasure pier, in the far
 * corner where the sand runs out against the rocks and nobody walks, at the
 * tide line. It is not solid, so nothing about the harbour's walks moves.
 */
export const BEACH_BOTTLE: GridPosition = { x: 84, y: 22 };

/** What is said as the bottle is picked up off the sand. */
export const BOTTLE_FOUND_LINES: readonly string[] = [
  'Something glints at the tide line: a bottle, corked and sealed with wax.',
  'There is a chart rolled up inside it! You put the BOTTLED CHART in YOUR THINGS.',
  'It is torn, and old. Somebody at THE GREAT LIBRARY would know what it is.',
];

/** MARLOW himself: an old keeper of charts. */
export const MARLOW = { id: 'marlow', name: 'MARLOW', note: 'Keeper of old charts', design: 'old-man' } as const;

/** THE CHART ROOM, the room behind the library's end bookcase. */
export const CHART_ROOM_NAME = 'THE CHART ROOM';

export function pieceById(id: string): ChartPiece | undefined {
  return CHART_PIECES.find((piece) => piece.id === id);
}

export function pieceForItem(itemId: string): ChartPiece | undefined {
  return CHART_PIECES.find((piece) => piece.itemId === itemId);
}

/** Whether a string names a piece: what a saved `pinned` entry must be. */
export function isChartPieceId(id: string): boolean {
  return pieceById(id) !== undefined;
}

/** Whether every piece is on the wall: the chart is whole, and the chest's spot is open. */
export function chartWhole(hunt: TreasureHunt): boolean {
  return CHART_PIECES.every((piece) => hunt.pinned.includes(piece.id));
}

/** The pieces the vault holds that are not yet on the wall, in the chart's own order. */
export function piecesToPin(hunt: TreasureHunt, held: (itemId: string) => number): readonly ChartPiece[] {
  return CHART_PIECES.filter((piece) => !hunt.pinned.includes(piece.id) && held(piece.itemId) > 0);
}

/** Whether the bottle still lies on THE BEACH: nobody has picked it up, and its piece is not on the wall. */
export function bottleOnTheBeach(hunt: TreasureHunt, held: (itemId: string) => number): boolean {
  const shore = CHART_PIECES.find((piece) => piece.from.kind === 'beach');
  return shore !== undefined && !hunt.pinned.includes(shore.id) && held(shore.itemId) === 0;
}

/** Where the hunt has got to, which is what MARLOW talks about. */
export type HuntStage =
  /** Nothing yet: MARLOW talks about the sea, and bottles. */
  | 'no-chart'
  /** A piece in hand and the room still shut: he takes the player through. */
  | 'first-chart'
  /** The room is open and pieces are still to find or to pin. */
  | 'pinning'
  /** Every piece is up: go and dig. */
  | 'whole'
  /** The chest is home and not yet opened. */
  | 'chest'
  /** All of it done. */
  | 'done';

export function huntStage(hunt: TreasureHunt, held: (itemId: string) => number): HuntStage {
  if (hunt.chestOpened) {
    return 'done';
  }
  if (!hunt.roomOpen) {
    return piecesToPin(hunt, held).length > 0 ? 'first-chart' : 'no-chart';
  }
  if (!chartWhole(hunt)) {
    return 'pinning';
  }
  return held(CHEST_ITEM_ID) > 0 ? 'chest' : 'whole';
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function piecesLeftWords(count: number): string {
  return `${NUMBER_WORDS[count] ?? count} more piece${count === 1 ? '' : 's'}`;
}

/** What MARLOW says in the library, by the end bookcase, before he has opened it. */
export function marlowLibraryLines(stage: HuntStage): readonly string[] {
  if (stage === 'first-chart') {
    return [
      'MARLOW: Is that... a chart? Out of a bottle? Let me see it. Closer. CLOSER.',
      'Salt-stained, sea-chewed and torn on two sides. And that is the GREYSTONE VALE coast, or I am a MAGIKARP.',
      'Nobody has seen a chart like this in sixty years. Not out here. Come with me.',
      'Mind the bookcase. It sticks.',
    ];
  }
  return [
    'MARLOW: Charts, young one. Fifty years I have kept the library\'s charts, and every one of them has been somewhere.',
    'The sea sends old ones back, now and then. A bottle washes up on THE BEACH past the pier, and nobody looks at it.',
    'Somebody ought to.',
  ];
}

/** What MARLOW says as he leads the player into THE CHART ROOM for the first time. */
export const CHART_ROOM_ARRIVAL_LINES: readonly string[] = [
  'The bookcase swings open on a room nobody has been into for years.',
  `MARLOW: ${CHART_ROOM_NAME}. Nobody knows it is here, which is how I like it.`,
  `That board has waited sixty years for one chart, torn in ${NUMBER_WORDS[CHART_PIECES.length]}.`,
  'Pin your piece on it. It will show us where the treasure is.',
];

/**
 * What THE CHART ROOM's board asks, once the piece has been named on a line of
 * its own: a question in the box must fit one line or it lies over its answers
 * (`treasureMap.test.ts`), and a piece's name does not leave room for one.
 */
export const PIN_QUESTION = 'PIN IT ON THE BOARD?';

/** What the bookcase says once it stands open. */
export const OPEN_BOOKCASE_NOTE = 'Open: THE CHART ROOM is through it';

/** A count of pieces still to find, as a sentence starts with it: "Three more pieces". */
function piecesLeftSentence(count: number): string {
  const words = piecesLeftWords(count);
  return `${words[0].toUpperCase()}${words.slice(1)}`;
}

/**
 * What is said as a piece goes up: that it was pinned, then MARLOW, a box a
 * line. The first piece pinned is the one he decides about: by rights a chart
 * like this belongs to the library, but the sea gave it to the player, and
 * they and their Pokémon look like the sort who go where charts point. The
 * last turns the chart into the goal (`wholeChartLines`). `coastOpen` is
 * whether the save can walk into the cove yet: MISTY holds THE COAST.
 */
export function pinnedLines(
  piece: ChartPiece,
  after: TreasureHunt,
  itemName: string,
  partnerName?: string,
  coastOpen = true,
): readonly string[] {
  const first = after.pinned.length === 1;
  const left = CHART_PIECES.length - after.pinned.length;
  const company = partnerName ? `you and ${partnerName}` : 'you and your POKéMON';
  const lines = [`You pinned the ${itemName.toUpperCase()} on the board.`, ...piece.pinnedLines];
  if (left === 0) {
    return [...lines, ...wholeChartLines(coastOpen)];
  }
  if (first) {
    lines.push(
      'By rights this belongs to the library. But the sea gave it to you.',
      `And look at ${company}. Mighty! It is yours to finish.`,
      // "the vale", not its name in capitals: with it the line ran to a second box.
      `${piecesLeftSentence(left)} are out in the vale. Ask round the harbour.`,
    );
    return lines;
  }
  lines.push(`MARLOW: ${piecesLeftSentence(left)} to go.`);
  return lines;
}

/** What is said of MISTY while she still holds the way into the cove. */
export const COAST_SHUT_LINE = 'The cove is past MISTY. Beat her first.';

/**
 * Where the X is and what to do about it: the goal, as MARLOW, the board and
 * Oak say it. `to` is who the chest is carried home to, as the speaker would
 * put it: MARLOW says "me".
 */
export function treasureGoalLines(coastOpen = true, to: string = MARLOW.name): readonly string[] {
  return [
    `The X is in ${TREASURE_PLACE}: ${TREASURE_GOAL.spot}.`,
    `Dig up the ${TREASURE_GOAL.prize} and carry it home to ${to}.`,
    ...(coastOpen ? [] : [COAST_SHUT_LINE]),
  ];
}

/** What MARLOW says the moment the chart is whole: one cheer, then the goal. */
export function wholeChartLines(coastOpen = true): readonly string[] {
  return ['MARLOW: Whole! After sixty years!', ...treasureGoalLines(coastOpen, 'me')];
}

/** The same with the cove open, for whoever only needs the words. */
export const WHOLE_CHART_LINES: readonly string[] = wholeChartLines();

/** What MARLOW says in his room, faced, by where the hunt has got to. */
export function marlowRoomLines(stage: HuntStage, hunt: TreasureHunt, coastOpen = true): readonly string[] {
  switch (stage) {
    case 'no-chart':
    case 'first-chart':
    case 'pinning': {
      const left = CHART_PIECES.length - hunt.pinned.length;
      return [
        `MARLOW: ${piecesLeftSentence(left)}, and the chart is whole.`,
        'They turn up in GREYSTONE VALE, under the right sky. Ask round the harbour.',
      ];
    }
    case 'whole':
      return [`MARLOW: ${treasureGoalLines(coastOpen, 'me')[0]}`, ...treasureGoalLines(coastOpen, 'me').slice(1)];
    case 'chest':
      return ['MARLOW: Is that- it is! Put it down. Gently! GENTLY!'];
    case 'done':
      return [
        'MARLOW: A whole chart and an empty chest. The best day in sixty years!',
        'If the sea sends me another chart, you will be the first to hear.',
      ];
  }
}

/** What the board says, faced with nothing to pin: how the chart stands, or the goal. */
export function chartBoardLines(hunt: TreasureHunt, coastOpen = true): readonly string[] {
  if (hunt.chestOpened) {
    return [`THE CHART, whole. The ${TREASURE_GOAL.prize} it led to stands open on the floor.`];
  }
  if (chartWhole(hunt)) {
    return [`${TREASURE_GOAL.title}!`, ...treasureGoalLines(coastOpen)];
  }
  const left = CHART_PIECES.length - hunt.pinned.length;
  return [
    `THE CHART: ${hunt.pinned.length} of ${CHART_PIECES.length} pieces pinned.`,
    `${piecesLeftSentence(left)} to find. The whole chart shows where the treasure is.`,
  ];
}

/** The note under the board's name: how many pieces, or the goal in three words. */
export function chartBoardNote(hunt: TreasureHunt): string {
  if (hunt.chestOpened) {
    return 'Whole, and its chest found';
  }
  return chartWhole(hunt) ? `Whole. Dig at the X` : `${hunt.pinned.length} of ${CHART_PIECES.length} pieces pinned`;
}

/**
 * What the explorer run says at the board before its first piece goes up: its
 * kit put every piece in the vault (`dev/playtestKit.ts`), so nobody thinks
 * they found them. Said once, on the way to the question.
 */
export const PLAYTEST_PIECES_LINE = `PLAYTEST: your kit holds all ${NUMBER_WORDS[CHART_PIECES.length]} pieces. Pin each one, then go and dig.`;

/** What is said as the chest is opened and its contents handed over, a box a line. */
export function chestOpenedLines(names: (itemId: ItemId) => string, pokemonName: string = CHEST_POKEMON.speciesId.toUpperCase()): readonly string[] {
  const handed = CHEST_CONTENTS.map(({ itemId, quantity }) =>
    itemId === 'money' ? formatMoney(quantity) : quantity === 1 ? `a ${names(itemId).toUpperCase()}` : `${quantity} ${names(itemId).toUpperCase()}S`,
  );
  const list = `${handed.slice(0, -1).join(', ')} and ${handed[handed.length - 1]}`;
  return [
    'MARLOW: Is that- it is! Put it down. Gently! GENTLY!',
    'He works the lock with a hairpin and a bookmark. The lid creaks up.',
    `Inside: ${list}.`,
    'And an old POKé BALL, packed in straw. Something in it moves!',
    `A shiny ${pokemonName} came out! The smugglers' rarest cargo is yours.`,
    `MARLOW: The chest stays here on show. The rest has gone to BILL'S PC.`,
  ];
}

/** Reads a saved hunt back: anything it does not recognise is dropped, never believed. */
export function readTreasureHunt(value: unknown): TreasureHunt | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const pinned = Array.isArray(record.pinned)
    ? [...new Set(record.pinned.filter((id): id is string => typeof id === 'string' && isChartPieceId(id)))]
    : [];
  return {
    roomOpen: record.roomOpen === true || pinned.length > 0,
    pinned,
    chestOpened: record.chestOpened === true && CHART_PIECES.every((piece) => pinned.includes(piece.id)),
  };
}
