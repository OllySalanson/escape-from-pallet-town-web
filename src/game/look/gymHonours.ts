/**
 * GYM HONOURS: one thing worn for every gym leader beaten, so anybody who sees
 * a player sees how far they have got (the captain, 25 Nov 2026: "when other
 * people see you, they can see how far you've got in the game ... it's also a
 * good way of bragging").
 *
 * An honour is not a wearable from the boutique and is never bought, found or
 * lost: it *is* the badge, worn. So nothing new is stored about having one - a
 * save has a leader's honour exactly while `raidProgress.defeatedBosses` names
 * that leader (`honoursEarned`) - and the one thing a save keeps is which of
 * them the player has chosen to take off (`raidProgress.honoursHidden`, absent
 * for all of them on). Shown is the default, because a brag nobody switched on
 * is a brag nobody sees.
 *
 * Each leader's honour sits on a part of the figure no other honour uses -
 * MISTY's neckerchief at the throat, KOGA's band round the brow - so they stack:
 * a player two gyms in wears both, and is seen from across the harbour to be
 * further in than a player wearing one. Each is drawn as a pack is, pixel by
 * pixel into the figure's own sheet (`wornPack.ts`'s `dressIn`), so it bobs,
 * turns and swings with the walk on every body - the classic figure, any look,
 * the Bicycle's rider - and costs a frame nothing.
 *
 * A gym is a row in `world/valeQuarters.ts`; its honour is a row here, keyed by
 * the leader's boss id, and `gymHonours.test.ts` fails a gym with none.
 */
import type { WornArt } from './wornPack';

export type HonourId = 'cascade' | 'soul';

export interface GymHonour {
  readonly id: HonourId;
  /** The leader whose honour it is: their boss id in `trainers.ts`. */
  readonly bossId: string;
  /** What it is called, as the result card and the wardrobe say it. */
  readonly name: string;
  /** Who gave it, as dialogue names them. */
  readonly leader: string;
  /** What it is, in a line, said where it is shown. */
  readonly note: string;
  readonly art: WornArt;
}

/** A loose end swinging: a pixel out one way on the first step, the other way on the second. */
const SWING = [
  [1, 0],
  [-1, 0],
] as const;

/** Tails hanging down the back, which drop a pixel on every step. */
const BOB = [
  [0, 1],
  [0, 1],
] as const;

/**
 * Every honour, in the order the gyms are beaten (`valeGyms()`), which is also
 * the order they are drawn: a later one's knot over an earlier one's.
 */
export const GYM_HONOURS: readonly GymHonour[] = [
  {
    id: 'cascade',
    bossId: 'vale-gym-misty',
    name: 'CASCADE NECKERCHIEF',
    leader: 'Misty',
    note: "A sailor's neckerchief in Cerulean blue, with a white wave.",
    art: {
      colours: { C: 0x3890f8, c: 0x2058c0, W: 0xf8f8f8 },
      parts: {
        down: [
          {
            layer: 'front',
            y: 20,
            fixed: true,
            rows: ['...oWCCCCCCWo...', '....oCCWWCCo....', '.....oCCCco.....', '......oCco......', '.......oo.......'],
          },
        ],
        side: [
          { layer: 'front', y: 20, fixed: true, rows: ['....occCCCCo....', '.......oCWo.....', '........oo......'] },
          { layer: 'behind', y: 20, sway: SWING, rows: ['..ooo...........', '.oCCco..........', 'oCcoCo..........', 'oWo.oWo.........', '.o...o..........'] },
        ],
        up: [
          {
            // Over the head, so long hair falling down the back never hides it.
            layer: 'over',
            y: 20,
            fixed: true,
            rows: ['...oCCCCCCCCo...', '...oWCCCCCCWo...', '....oWCCCCWo....', '.....oWWWWo.....', '......oooo......'],
          },
        ],
      },
    },
  },
  {
    id: 'soul',
    bossId: 'vale-gym-koga',
    name: 'SOUL BAND',
    leader: 'Koga',
    note: "A ninja's band in poison purple, with a steel plate on the brow.",
    art: {
      colours: { P: 0xa838b0, p: 0x6c2074, S: 0xe8f0ff, s: 0x7c8898 },
      parts: {
        down: [
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['..PPPPPPPPPPPP..', '..pppppppppppp..'] },
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['......sSSs......', '......ssss......'] },
        ],
        side: [
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['.PPPPPPPPPPPPP..', '.ppppppppppppp..'] },
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['..........sSs...', '..........sss...'] },
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['.pp.............', '.pp.............'] },
          { layer: 'over', y: 16, sway: SWING, brow: true, rows: ['.pP.............', 'pP..............', 'P...............'] },
        ],
        up: [
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['..PPPPPPPPPPPP..', '..pppppppppppp..'] },
          { layer: 'over', y: 14, fixed: true, clip: true, brow: true, rows: ['.........pp.....', '.........pp.....'] },
          { layer: 'over', y: 16, sway: BOB, clip: true, brow: true, rows: ['.........Pp.....', '.........P.p....', '........P...p...'] },
        ],
      },
    },
  },
];

const HONOUR_IDS: ReadonlySet<string> = new Set(GYM_HONOURS.map((honour) => honour.id));

export function isHonourId(value: unknown): value is HonourId {
  return typeof value === 'string' && HONOUR_IDS.has(value);
}

export function honourById(id: string): GymHonour | undefined {
  return GYM_HONOURS.find((honour) => honour.id === id);
}

/** The honour a leader gives, if they give one. */
export function honourOf(bossId: string): GymHonour | undefined {
  return GYM_HONOURS.find((honour) => honour.bossId === bossId);
}

/** Every honour a save has earned: one for each leader `defeatedBosses` names, in catalogue order. */
export function honoursEarned(defeatedBosses: readonly string[]): readonly HonourId[] {
  return GYM_HONOURS.filter((honour) => defeatedBosses.includes(honour.bossId)).map((honour) => honour.id);
}

/** What a save wears: every honour earned that the player has not taken off. */
export function honoursWorn(progress: {
  readonly defeatedBosses: readonly string[];
  readonly honoursHidden?: readonly string[];
}): readonly HonourId[] {
  const hidden = new Set(progress.honoursHidden ?? []);
  return honoursEarned(progress.defeatedBosses).filter((id) => !hidden.has(id));
}

/** The longest list of honours believed: room for every gym Kanto has, and to spare. */
const HONOURS_HEARD_MAX = 16;

/**
 * Honours heard from another browser, or none: untrusted, so only a short
 * array of the catalogue's own ids is believed, each once, put back in
 * catalogue order so two players wearing the same honours share one texture.
 */
export function readHonours(value: unknown): readonly HonourId[] {
  if (!Array.isArray(value) || value.length > HONOURS_HEARD_MAX) {
    return [];
  }
  return orderedHonours(value.filter(isHonourId));
}

/** One string that names a set of honours, for a texture key: empty for none. */
export function honoursKey(honours: readonly string[]): string {
  return honours.join('.');
}

/** The catalogue's own honours among these, each once, in catalogue order: the order they are drawn in. */
export function orderedHonours(honours: readonly string[]): readonly HonourId[] {
  return GYM_HONOURS.filter((honour) => honours.includes(honour.id)).map((honour) => honour.id);
}

/** The honours as things worn, in the order they are drawn. */
export function honourArts(honours: readonly string[]): readonly WornArt[] {
  return GYM_HONOURS.filter((honour) => honours.includes(honour.id)).map((honour) => honour.art);
}
