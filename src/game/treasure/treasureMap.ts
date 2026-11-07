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
 *    to finish: they and their Pokémon are the mighty sort.
 * 4. **The torn charts** are the vale's three chart secrets
 *    (`../world/secrets.ts`), found under their own skies and carried home at
 *    risk as every secret is. Each pinned is out of the vault for good and
 *    stays on the wall.
 * 5. **X marks the spot.** With every piece up the chart is whole, and a raid
 *    that sets out with it whole opens the last secret, `TREASURE_SECRET_ID`:
 *    a hidden spot in SMUGGLERS' COVE that holds the SEA CHEST. It is found,
 *    carried home and lost with the pack like any other secret's reward.
 * 6. **The chest** is carried to MARLOW, who opens it (`CHEST_CONTENTS`) and
 *    keeps the empty chest on show in his room.
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
    pinnedLines: [
      'MARLOW: The open sea, a compass rose and a ship, sailing in. That is where this chart starts.',
    ],
  },
  {
    id: 'moor',
    itemId: 'chart-piece-1',
    slot: { column: 1, row: 0 },
    from: { kind: 'secret', secretId: 'the-long-shadow' },
    pinnedLines: [
      'MARLOW: The tor on HIGH MOOR! Drawn by somebody standing on it in a gale, by the wobble.',
      'See the dotted line? It comes ashore and goes straight up onto the moor.',
    ],
  },
  {
    id: 'hollow',
    itemId: 'chart-piece-2',
    slot: { column: 0, row: 1 },
    from: { kind: 'secret', secretId: 'the-tappers-sunday' },
    pinnedLines: [
      'MARLOW: Pines, and a camp in them. PINE HOLLOW. The line comes down off the moor and through the trees.',
      'Whoever drew this did not like the smell of resin. There is a little drawing of a nose.',
    ],
  },
  {
    id: 'fold',
    itemId: 'chart-piece-3',
    slot: { column: 1, row: 1 },
    from: { kind: 'secret', secretId: 'the-lost-fold' },
    pinnedLines: [
      'MARLOW: Cliffs, a cove under them, a little boat shed... and the line ends at a mark.',
      'An X. Of course it is an X. It is always an X.',
    ],
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
  `That board has waited sixty years for one chart, torn in ${NUMBER_WORDS[CHART_PIECES.length]}. Pin yours up and let us have a proper look.`,
];

/** What the bookcase says once it stands open. */
export const OPEN_BOOKCASE_NOTE = 'Open: THE CHART ROOM is through it';

/**
 * What is said as a piece goes up: that it was pinned, then MARLOW. The first
 * piece pinned is the bottle's, and it is the one he decides about: by rights
 * a chart like this belongs to the library, but the sea gave it to the player,
 * and they and their Pokémon look like the sort who go where charts point.
 */
export function pinnedLines(piece: ChartPiece, after: TreasureHunt, itemName: string, partnerName?: string): readonly string[] {
  const first = after.pinned.length === 1;
  const left = CHART_PIECES.length - after.pinned.length;
  const company = partnerName ? `you and ${partnerName}` : 'you and your POKéMON';
  const lines = [`You pinned the ${itemName.toUpperCase()} on the board.`, ...piece.pinnedLines];
  if (first) {
    lines.push(
      'MARLOW: Hmm. Hmm! (He looks at it through a glass. Then through a bigger glass. Then he sniffs it.)',
      'By rights a chart like this belongs to the library. Scholars would fight over it. With umbrellas.',
      'But the sea did not give it to a scholar. It gave it to you.',
      `And look at ${company}. Mighty, the pair of you.`,
      'Mighty is what this chart wants. It is yours. It stays on my board where it is safe, and you finish it.',
      `${piecesLeftWords(left)[0].toUpperCase()}${piecesLeftWords(left).slice(1)} are out in GREYSTONE VALE. Listen to the harbour: the board, the sailors and BILL talk of little else.`,
    );
    return lines;
  }
  if (left > 0) {
    lines.push(`MARLOW: ${piecesLeftWords(left)[0].toUpperCase()}${piecesLeftWords(left).slice(1)} to go.`);
    return lines;
  }
  return [...lines, ...WHOLE_CHART_LINES];
}

/** What MARLOW says the moment the chart is whole. */
export const WHOLE_CHART_LINES: readonly string[] = [
  'MARLOW: There. Whole, for the first time in sixty years.',
  `Follow the line: off the sea, up over the moor, down through the pines, along the cliffs... to ${TREASURE_PLACE}.`,
  'Where the sand runs out under the cliff, past the boat shed. X marks the spot. It always does.',
  'Mind: the cove is behind MISTY\'s sandbags. And the chest will not be light. Bring back what is under that X.',
];

/** What MARLOW says in his room, faced, by where the hunt has got to. */
export function marlowRoomLines(stage: HuntStage, hunt: TreasureHunt): readonly string[] {
  switch (stage) {
    case 'no-chart':
    case 'first-chart':
    case 'pinning': {
      const left = CHART_PIECES.length - hunt.pinned.length;
      return [
        `MARLOW: ${piecesLeftWords(left)[0].toUpperCase()}${piecesLeftWords(left).slice(1)}, and the chart is whole. Torn charts turn up in GREYSTONE VALE, under the right sky.`,
        'Bring me what you find and pin it on the board. I will do the squinting.',
      ];
    }
    case 'whole':
      return [
        `MARLOW: ${TREASURE_PLACE}, where the sand runs out under the cliff past the boat shed.`,
        'The chart is whole, so whatever is under that X is waiting for you. Go on. I will put the kettle on.',
      ];
    case 'chest':
      return ['MARLOW: Is that- it is! Put it down. Gently! GENTLY!'];
    case 'done':
      return [
        'MARLOW: A whole chart and an empty chest. Best day this library has had in sixty years.',
        'If the sea sends me another chart, you will be the first to hear of it.',
      ];
  }
}

/** What is said as the chest is opened and its contents handed over. */
export function chestOpenedLines(names: (itemId: ItemId) => string, partnerName?: string): readonly string[] {
  const handed = CHEST_CONTENTS.map(({ itemId, quantity }) =>
    itemId === 'money' ? formatMoney(quantity) : quantity === 1 ? `a ${names(itemId).toUpperCase()}` : `${quantity} ${names(itemId).toUpperCase()}S`,
  );
  const list = `${handed.slice(0, -1).join(', ')} and ${handed[handed.length - 1]}`;
  return [
    'MARLOW: Is that- it is! Put it down. Gently! GENTLY!',
    'He works the old lock with a hairpin, a bookmark and a word nobody should say in a library. The lid creaks up.',
    `Inside: ${list}.`,
    'MARLOW: Not gold. Better: the smugglers\' own kit. They meant to come back for it. They never did.',
    `The chest stays here with the chart, where people can gasp at it. What was in it is yours. ${partnerName ? `You and ${partnerName}` : 'You and your POKéMON'} earned every bit of it.`,
    `It has gone into your things on BILL'S PC.`,
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
