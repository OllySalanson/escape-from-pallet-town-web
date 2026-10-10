import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import type { PaintedPicture } from '../world/minimap';
import { TILE_SIZE } from '../worldMap';

/**
 * THE BADGE CASE: a glass-fronted case on the wall of THE BOLTHOLE's front
 * room with a slot for every keeper in the game, and in each slot that keeper's
 * badge once they are beaten.
 *
 * FireRed keeps its badges in a case on the trainer card, and a badge is the one
 * thing every one of those games has always used to say how far you have come.
 * This game's keepers are not gym leaders - they hold doors, and beating one
 * opens two - but beating one is exactly as much of an event, and until now the
 * only place it showed was a small sign on Oak's wall map. So every keeper has a
 * badge of their own here, named for what they hold, drawn in the hand of
 * FireRed's own: a little enamelled shape with a dark rim and one bright edge.
 *
 * The slots are in the order the game is played: `trainerLadder.test.ts` holds
 * the keepers in the order a player meets them, and the case fills along it, so
 * a half-full case reads as how far along the ladder you are. An empty slot is
 * not blank - its badge's shape is pressed into the velvet, a shade darker -
 * because a case that shows what is missing is a case that asks to be filled.
 *
 * Like everything else in the base, nothing is stored: a badge shines because
 * `raidProgress.defeatedBosses` names its keeper.
 */

export interface Badge {
  /** The keeper whose badge it is: `trainers.ts`' `bossId`. */
  readonly bossId: string;
  /** What the badge is called. */
  readonly name: string;
  /** Who it was won from, as the dialogue names them. */
  readonly keeper: string;
  /** What they held, in a few words. */
  readonly held: string;
  /**
   * The badge, eight pixels square: `o` its rim, `a` its colour, `b` the
   * bright edge, `c` its shade, `g` a second colour, `.` nothing.
   */
  readonly art: readonly string[];
  readonly ink: Readonly<Record<'o' | 'a' | 'b' | 'c' | 'g', string>>;
}

const RIM = '#2b2228';

/** Every keeper's badge, in the order the ladder meets them. */
export const BADGES: readonly Badge[] = [
  {
    bossId: 'floodplain-toll-keeper',
    name: 'TOLL BADGE',
    keeper: 'Tollman Briggs',
    held: 'the bridge off Market Isle',
    art: ['..oooo..', '.oabbao.', 'oabaaaco', 'oaaccaco', 'oaaccaco', 'oaaaaaco', '.oaccco.', '..oooo..'],
    ink: { o: RIM, a: '#e8b830', b: '#fff2a8', c: '#a07018', g: '#e8b830' },
  },
  {
    bossId: 'overlook-warden',
    name: 'OVERLOOK BADGE',
    keeper: 'Warden Wren',
    held: 'the Overlook on Route 1',
    art: ['...oo...', '..obao..', 'oooaaooo', 'oabaaaco', '.oaaaco.', '.oaoaco.', 'oaco.oco', 'oo....oo'],
    ink: { o: RIM, a: '#f6d24a', b: '#fffbd0', c: '#b48a1c', g: '#f6d24a' },
  },
  {
    bossId: 'pallet-mill-keeper',
    name: 'MILL BADGE',
    keeper: 'Miller Vance',
    held: 'the far bank of the millpond',
    art: ['oo....oo', 'oao..oao', '.oaooao.', '..obbo..', '..obbo..', '.oaooao.', 'oao..oao', 'oo....oo'],
    ink: { o: RIM, a: '#b07848', b: '#f0d0a0', c: '#704828', g: '#b07848' },
  },
  {
    bossId: 'pallet-salt-keeper',
    name: 'SALT BADGE',
    keeper: 'Salter Cobb',
    held: 'the headland and its steps',
    art: ['...oo...', '..obbo..', '.obbaao.', 'obbaaaco', 'oaaaacco', '.oaacco.', '..occo..', '...oo...'],
    ink: { o: RIM, a: '#d8e4ee', b: '#ffffff', c: '#8ca0b4', g: '#d8e4ee' },
  },
  {
    bossId: 'forest-ridge-keeper',
    name: 'RIDGE BADGE',
    keeper: 'Lookout Pell',
    held: 'the rock above Viridian Forest',
    art: ['...o....', '..oao...', '..oaao..', '.oabao..', '.oabbao.', 'oabbbaao', 'oaabbaco', '.oooooo.'],
    ink: { o: RIM, a: '#f08030', b: '#ffe070', c: '#b84818', g: '#f08030' },
  },
  {
    bossId: 'forest-quarry-keeper',
    name: 'QUARRY BADGE',
    keeper: 'Quarryman Mott',
    held: 'the quarry in the deep wood',
    art: ['..ooo...', '.obbao..', 'obbaaao.', 'obaaaaco', 'oaaaacco', 'oaaacco.', '.oocco..', '...oo...'],
    ink: { o: RIM, a: '#9aa0a8', b: '#e0e4e8', c: '#5c6068', g: '#9aa0a8' },
  },
  {
    bossId: 'viridian-league-gatekeeper',
    name: 'GATE BADGE',
    keeper: 'Gatekeeper Ross',
    held: 'the League fence in Viridian City',
    art: ['oooooooo', 'oabbaaco', 'oabaaaco', 'oabaaaco', '.oaaaco.', '.oaaaco.', '..oaco..', '...oo...'],
    ink: { o: RIM, a: '#8860c8', b: '#d0b8f8', c: '#583890', g: '#8860c8' },
  },
  {
    bossId: 'floodplain-sluice-keeper',
    name: 'SLUICE BADGE',
    keeper: 'Sluice Keeper Dane',
    held: 'the sluice in the mill race',
    art: ['...o....', '..oao...', '..obao..', '.obaaao.', '.obaaao.', '.oaaaco.', '..occo..', '...oo...'],
    ink: { o: RIM, a: '#4890e8', b: '#b8e0ff', c: '#2858a8', g: '#4890e8' },
  },
  {
    bossId: 'floodplain-quarry-foreman',
    name: 'FOREMAN BADGE',
    keeper: 'Foreman Rudd',
    held: 'the Floodplain quarry',
    art: ['.oooooo.', 'oabbbaco', 'oacccaco', '.oo..oo.', '...oo...', '...oo...', '...oo...', '...oo...'],
    ink: { o: RIM, a: '#c8a068', b: '#f8e0b0', c: '#7c5a30', g: '#c8a068' },
  },
  {
    bossId: 'floodplain-orchard-warden',
    name: 'ORCHARD BADGE',
    keeper: 'Warden Holt',
    held: 'the orchard and the vault behind it',
    art: ['....g...', '...gg...', '.oooooo.', 'oabaaaco', 'oabaaaco', 'oaaaaaco', '.oaaaco.', '..oooo..'],
    ink: { o: RIM, a: '#e04040', b: '#ffa8a0', c: '#981c20', g: '#58b048' },
  },
  {
    bossId: 'floodplain-sea-wall-keeper',
    name: 'SEA WALL BADGE',
    keeper: 'Banksman Nye',
    held: 'the sea wall at the foot of the Floodplain',
    art: ['...ooo..', '..obbao.', '.obaooo.', '.oao....', 'oaao..oo', 'oaaaooao', '.oaaaaco', '..oooooo'],
    ink: { o: RIM, a: '#30b0a8', b: '#b0f0e8', c: '#18706c', g: '#30b0a8' },
  },
];

/** Badges won, in the case's order. */
export function wonBadges(game: RestoredGame): readonly Badge[] {
  const beaten = new Set(game.raidProgress.defeatedBosses);
  return BADGES.filter((badge) => beaten.has(badge.bossId));
}

/** The caption's second line: how full the case is. */
export function badgeCaseNote(game: RestoredGame): string {
  const won = wonBadges(game).length;
  return won === 0 ? 'Every slot still empty' : `${won} of ${BADGES.length} badges`;
}

/** What the case says when it is faced: how full it is, then every badge in it. */
export function badgeCaseLines(game: RestoredGame): readonly string[] {
  const won = wonBadges(game);
  if (won.length === 0) {
    return [
      `THE BADGE CASE. ${BADGES.length} slots, every one of them empty.`,
      'Every keeper out there holds a door, and every one of them has a badge for whoever beats them.',
    ];
  }
  const left = BADGES.length - won.length;
  return [
    left === 0
      ? `THE BADGE CASE. All ${BADGES.length} badges. Every keeper in Kanto has been beaten.`
      : `THE BADGE CASE. ${won.length} of ${BADGES.length} badges, and ${left} slot${left === 1 ? '' : 's'} still empty.`,
    ...won.map((badge) => `${badge.name}: from ${badge.keeper}, who held ${badge.held}.`),
  ];
}

/** Where a slot's badge sits in the case, in pixels from its top-left. */
export interface BadgeSeat {
  readonly badge: Badge;
  readonly x: number;
  readonly y: number;
}

const BADGE_SIZE = 8;
const CASE = {
  outline: '#2a1a0c',
  frame: '#946230',
  frameLight: '#cd9c52',
  frameShade: '#5e3c18',
  velvet: '#5a2840',
  velvetShade: '#46203a',
  pressed: '#3e1a32',
} as const;

/**
 * The case on its stretch of wall: a wooden frame round a velvet back, two rows
 * of slots - six over five, so eleven fill it - centred in the frame.
 */
export function badgeSeats(area: Rect): { readonly frame: Rect; readonly seats: readonly BadgeSeat[] } {
  const width = area.width * TILE_SIZE;
  const height = area.height * TILE_SIZE;
  const frame = { x: 2, y: 4, width: width - 4, height: height - 8 };
  const rows = [BADGES.slice(0, 6), BADGES.slice(6)];
  const rowHeight = BADGE_SIZE + 1;
  const top = frame.y + Math.floor((frame.height - (rows.length * rowHeight - 1)) / 2);
  const seats = rows.flatMap((row, rowIndex) => {
    const rowWidth = row.length * (BADGE_SIZE + 1) - 1;
    const left = frame.x + Math.floor((frame.width - rowWidth) / 2);
    return row.map((badge, index) => ({
      badge,
      x: left + index * (BADGE_SIZE + 1),
      y: top + rowIndex * rowHeight,
    }));
  });
  return { frame, seats };
}

/**
 * The case, painted from the save: every badge won in its own colours, every
 * slot still empty pressed into the velvet in its badge's shape. Transparent
 * outside the frame, so the wall it hangs on shows round it.
 */
export function badgeCasePoster(game: RestoredGame, area: Rect): PaintedPicture {
  const width = area.width * TILE_SIZE;
  const height = area.height * TILE_SIZE;
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: string): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
  };
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) plot(px, py, ink);
  };
  const { frame, seats } = badgeSeats(area);
  // The frame: an outline, wood lit along its top and left and shaded along
  // its foot and right, and the velvet a pixel in under its lip.
  fill(frame.x, frame.y, frame.width, frame.height, CASE.outline);
  fill(frame.x + 1, frame.y + 1, frame.width - 2, frame.height - 2, CASE.frame);
  fill(frame.x + 1, frame.y + 1, frame.width - 2, 1, CASE.frameLight);
  fill(frame.x + 1, frame.y + 1, 1, frame.height - 2, CASE.frameLight);
  fill(frame.x + 1, frame.y + frame.height - 2, frame.width - 2, 1, CASE.frameShade);
  fill(frame.x + frame.width - 2, frame.y + 1, 1, frame.height - 2, CASE.frameShade);
  fill(frame.x + 2, frame.y + 2, frame.width - 4, frame.height - 4, CASE.velvet);
  fill(frame.x + 2, frame.y + 2, frame.width - 4, 1, CASE.velvetShade);
  fill(frame.x + 2, frame.y + 2, 1, frame.height - 4, CASE.velvetShade);
  const beaten = new Set(game.raidProgress.defeatedBosses);
  for (const seat of seats) {
    const won = beaten.has(seat.badge.bossId);
    seat.badge.art.forEach((row, y) =>
      [...row].forEach((mark, x) => {
        if (mark === '.') return;
        const ink = won ? seat.badge.ink[mark as keyof Badge['ink']] : CASE.pressed;
        plot(seat.x + x, seat.y + y, ink);
      }),
    );
  }
  return { width, height, data };
}
