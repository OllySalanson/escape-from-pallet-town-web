import type Phaser from 'phaser';
import { pokemonSoleDrop, type FigureSpeciesId } from '../world/pokemonFigures';

/**
 * A shiny Pokemon looks like one wherever it walks.
 *
 * A shiny was shiny in a fight and on every list (`pokemon/shiny.ts`), and
 * nowhere else: out in THE BOLTHOLE's garden, in the Day-Care pen and at the
 * player's heel on a raid it leads, it was drawn from the one sheet of
 * following sprites and party icons there is, in its ordinary colours. The
 * rarest thing a save can own walked about looking like any other of its
 * kind.
 *
 * There is no second sheet to draw it from, and a tint would be a lie about
 * which colours FireRed gives it. So it gives off what FireRed gives a shiny
 * as it lands in a fight - gold stars - small, round its head, every few
 * seconds: three glints, each coming out a beat after the last, each a spark
 * that opens into a four-pointed star and closes again.
 *
 * They are drawn here, a pixel at a time (`GLINT_ART`), rather than taken
 * from the fight's sheet (`ui/shinySparkle.ts`): FireRed's stars are pale
 * gold with no outline, made for the flat ground of a battle, and out of
 * doors they stood on grass, sand, snow and a yellow Pikachu and could not be
 * told from any of them. These have a dark rim, as everything else that must
 * read on any ground has.
 *
 * `glintAt` is the whole choreography, a pure function of the time the
 * figure has been out; `ShinyGlints` only draws it.
 */

/** The two pictures of a glint, in `GLINT_INKS`: `.` is nothing. Each is square and odd, so it has a middle pixel. */
export const GLINT_ART = {
  spark: [
    '..k..',
    '.kgk.',
    'kgwgk',
    '.kgk.',
    '..k..',
  ],
  star: [
    '....k....',
    '...kgk...',
    '...kgk...',
    '.kkgwgkk.',
    'kggwwwggk',
    '.kkgwgkk.',
    '...kgk...',
    '...kgk...',
    '....k....',
  ],
} as const satisfies Record<string, readonly string[]>;

export type GlintFrame = keyof typeof GLINT_ART;

/** A deep amber rim, FireRed's star gold, and a white heart. */
export const GLINT_INKS: Record<string, number> = {
  k: 0x6b4208,
  g: 0xf8d030,
  w: 0xffffff,
};

/** A burst begins this often. */
export const GLINT_EVERY_MS = 3_600;
/** The first one, this long after the figure comes out: soon enough to be seen by somebody who has just walked in. */
export const GLINT_FIRST_MS = 700;
/** How long one glint lives: a spark, a star, a spark, a third of it each. */
export const GLINT_LIFE_MS = 420;

/**
 * The three glints of a burst: when each comes out, and where, in pixels from
 * the middle of the figure's head. All of every star is within a tile of
 * that, so a figure standing beside somebody never glints on their face.
 */
export const GLINT_MOTES: readonly { readonly fromMs: number; readonly dx: number; readonly dy: number }[] = [
  { fromMs: 0, dx: -9, dy: 2 },
  { fromMs: 150, dx: 9, dy: -3 },
  { fromMs: 300, dx: -1, dy: -12 },
];

/**
 * How far above its soles the middle of a party icon's body is: the garden's
 * and the Day-Care pen's Pokemon are FireRed's party icons, a tile or so tall.
 */
export const ICON_GLINT_RISE = 9;

/**
 * How far out of step each further shiny figure of a place is with the last:
 * the partner is the first, the Day-Care pen's the second, the garden's after
 * them. No whole fraction of the time between bursts, so the first eight - a
 * partner, a pen and a full garden, every one of them shiny - each begin at a
 * moment of their own, and a yard of them twinkles here and there rather
 * than all at once.
 */
export const GLINT_OUT_OF_STEP_MS = 1_300;
export const PEN_GLINT_PLACE = 1;
export const GARDEN_GLINT_PLACE = 2;

/** How long the `place`th shiny figure of a scene counts as having been out already when it is drawn. */
export function glintHeadStart(place: number): number {
  return (place * GLINT_OUT_OF_STEP_MS) % GLINT_EVERY_MS;
}

/** How long a whole burst lasts. */
export const GLINT_BURST_MS = GLINT_MOTES[GLINT_MOTES.length - 1].fromMs + GLINT_LIFE_MS;

/** How far over its figure a glint is drawn: over it, and under whoever stands a row nearer. */
export const GLINT_OVER = 0.00002;

export interface GlintMote {
  /** Which of the burst's three: stable for its whole life. */
  readonly index: number;
  readonly frame: GlintFrame;
  readonly dx: number;
  readonly dy: number;
}

/** What is drawn round a shiny figure that has been out for `ms`: nothing, most of the time. */
export function glintAt(ms: number): readonly GlintMote[] {
  if (ms < GLINT_FIRST_MS) {
    return [];
  }
  const into = (ms - GLINT_FIRST_MS) % GLINT_EVERY_MS;
  return GLINT_MOTES.flatMap((mote, index) => {
    const age = into - mote.fromMs;
    if (age < 0 || age >= GLINT_LIFE_MS) {
      return [];
    }
    const third = Math.floor((age * 3) / GLINT_LIFE_MS);
    return [{ index, frame: third === 1 ? ('star' as const) : ('spark' as const), dx: mote.dx, dy: mote.dy }];
  });
}

/**
 * The glints of one shiny figure, drawn. Its owner tells it every frame where
 * the middle of the figure's head is and how the figure is drawn (`place`),
 * or that it is not to be seen (`hide`).
 */
export class ShinyGlints {
  private readonly drawn: ({ readonly graphics: Phaser.GameObjects.Graphics; frame: GlintFrame | null } | undefined)[] = [];
  private readonly scene: Phaser.Scene;
  private outMs: number;

  /** `outMs` is how long it counts as having been out already (`glintHeadStart`). */
  public constructor(scene: Phaser.Scene, outMs = 0) {
    this.scene = scene;
    this.outMs = outMs;
  }

  public update(deltaMs: number): void {
    this.outMs += deltaMs;
  }

  /** Draws this moment's glints round a head at `x`, `y`, over the figure and as faint as it is. */
  public place(x: number, y: number, depth: number, alpha = 1): void {
    const motes = glintAt(this.outMs);
    for (let index = 0; index < GLINT_MOTES.length; index += 1) {
      const mote = motes.find((each) => each.index === index);
      if (!mote || alpha <= 0) {
        this.drawn[index]?.graphics.setVisible(false);
        continue;
      }
      const glint = this.drawn[index] ?? (this.drawn[index] = { graphics: this.scene.add.graphics(), frame: null });
      if (glint.frame !== mote.frame) {
        glint.frame = mote.frame;
        paintGlint(glint.graphics, mote.frame);
      }
      glint.graphics
        .setPosition(Math.round(x + mote.dx), Math.round(y + mote.dy))
        .setDepth(depth)
        .setAlpha(alpha)
        .setVisible(true);
    }
  }

  /**
   * Round a party icon standing on the ground, as the garden and the pen
   * stand theirs: bottom-centre origin, its soles let down onto the tile.
   */
  public placeOverIcon(sprite: Phaser.GameObjects.Sprite, species: FigureSpeciesId): void {
    this.place(sprite.x, sprite.y - pokemonSoleDrop(species) - ICON_GLINT_RISE, sprite.depth + GLINT_OVER, sprite.alpha);
  }

  /** What is lit this frame and where its middle is, for a playtest driver. */
  public get lit(): readonly { readonly x: number; readonly y: number; readonly frame: GlintFrame }[] {
    return this.drawn.flatMap((glint) =>
      glint?.graphics.visible && glint.frame ? [{ x: glint.graphics.x, y: glint.graphics.y, frame: glint.frame }] : [],
    );
  }

  public hide(): void {
    for (const glint of this.drawn) {
      glint?.graphics.setVisible(false);
    }
  }

  public destroy(): void {
    for (const glint of this.drawn) {
      glint?.graphics.destroy();
    }
    this.drawn.length = 0;
  }
}

/** One picture of a glint, its middle pixel on the graphics' own origin. */
function paintGlint(graphics: Phaser.GameObjects.Graphics, frame: GlintFrame): void {
  const rows: readonly string[] = GLINT_ART[frame];
  const half = (rows.length - 1) / 2;
  graphics.clear();
  rows.forEach((row, y) =>
    [...row].forEach((ink, x) => {
      if (ink !== '.') {
        graphics.fillStyle(GLINT_INKS[ink], 1).fillRect(x - half, y - half, 1, 1);
      }
    }),
  );
}
