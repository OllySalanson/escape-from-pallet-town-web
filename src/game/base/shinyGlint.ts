import type Phaser from 'phaser';
import { SHINY_SPARKLE_TEXTURE, SPARKLE_FRAMES } from '../ui/shinySparkle';
import { pokemonSoleDrop, type FigureSpeciesId } from '../world/pokemonFigures';

/**
 * A shiny Pokemon looks like one wherever it walks.
 *
 * A shiny was shiny in a fight and on every list (`pokemon/shiny.ts`), and
 * nowhere else: at the player's heel round THE HARBOUR and on a raid, and out
 * in THE BOLTHOLE's garden, it was drawn from the one sheet of following
 * sprites and party icons there is, in its ordinary colours. The rarest thing
 * a save can own walked about looking like any other of its kind.
 *
 * There is no second sheet to draw it from, and a tint would be a lie about
 * which colours FireRed gives it. So it gives off what FireRed gives a shiny
 * as it lands in a fight - the gold stars, two of the three pictures on the
 * same sheet (`ui/shinySparkle.ts`) - small, round its head, every few
 * seconds: three glints, each coming out a beat after the last, each a plus
 * that opens into a star and closes again.
 *
 * `glintAt` is the whole choreography, a pure function of the time the
 * figure has been out; `ShinyGlints` only draws it.
 */

/** A burst begins this often. */
export const GLINT_EVERY_MS = 3_600;
/** The first one, this long after the figure comes out: soon enough to be seen by somebody who has just walked in. */
export const GLINT_FIRST_MS = 700;
/** How long one glint lives: a plus, a star, a plus, a third of it each. */
export const GLINT_LIFE_MS = 420;

/**
 * The three glints of a burst: when each comes out, and where, in pixels from
 * the middle of the figure's head. Inside a tile and a half either way, so a
 * figure standing beside somebody never glints on them.
 */
export const GLINT_MOTES: readonly { readonly fromMs: number; readonly dx: number; readonly dy: number }[] = [
  { fromMs: 0, dx: -8, dy: 1 },
  { fromMs: 150, dx: 7, dy: -5 },
  { fromMs: 300, dx: -1, dy: -10 },
];

/**
 * How far above its soles the middle of a party icon's body is: the garden's
 * and the Day-Care pen's Pokemon are FireRed's party icons, a tile or so tall.
 */
export const ICON_GLINT_RISE = 9;

/**
 * How far out of step with the last one each further shiny figure of a place
 * is: no whole fraction of the time between bursts, so no two ever keep time.
 */
export const GLINT_OUT_OF_STEP_MS = 1_300;

/** How long a whole burst lasts. */
export const GLINT_BURST_MS = GLINT_MOTES[GLINT_MOTES.length - 1].fromMs + GLINT_LIFE_MS;

/** How far over its figure a glint is drawn: over it, and under whoever stands a row nearer. */
export const GLINT_OVER = 0.00002;

export interface GlintMote {
  /** Which of the burst's three: stable for its whole life. */
  readonly index: number;
  readonly frame: 'twinkle' | 'glint';
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
    return [{ index, frame: third === 1 ? ('twinkle' as const) : ('glint' as const), dx: mote.dx, dy: mote.dy }];
  });
}

/**
 * The glints of one shiny figure, drawn. Its owner tells it every frame where
 * the middle of the figure's head is and how the figure is drawn (`place`),
 * or that it is not to be seen (`hide`). A scene with no sparkle sheet - one
 * under test - draws nothing.
 */
export class ShinyGlints {
  private readonly images: (Phaser.GameObjects.Image | undefined)[] = [];
  private readonly scene: Phaser.Scene;
  private outMs: number;

  /**
   * `outMs` is how long it counts as having been out already: several shiny
   * figures drawn in the same instant are each given their own, so a garden
   * of them twinkles here and there rather than all at once.
   */
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
        this.images[index]?.setVisible(false);
        continue;
      }
      const image = this.imageFor(index);
      image?.setFrame(mote.frame).setPosition(Math.round(x + mote.dx), Math.round(y + mote.dy)).setDepth(depth).setAlpha(alpha).setVisible(true);
    }
  }

  /**
   * Round a party icon standing on the ground, as the garden and the pen
   * stand theirs: bottom-centre origin, its soles let down onto the tile.
   */
  public placeOverIcon(sprite: Phaser.GameObjects.Sprite, species: FigureSpeciesId): void {
    this.place(sprite.x, sprite.y - pokemonSoleDrop(species) - ICON_GLINT_RISE, sprite.depth + GLINT_OVER, sprite.alpha);
  }

  public hide(): void {
    for (const image of this.images) {
      image?.setVisible(false);
    }
  }

  public destroy(): void {
    for (const image of this.images) {
      image?.destroy();
    }
    this.images.length = 0;
  }

  private imageFor(index: number): Phaser.GameObjects.Image | undefined {
    if (this.images[index]) {
      return this.images[index];
    }
    if (!this.scene.textures?.exists?.(SHINY_SPARKLE_TEXTURE)) {
      return undefined;
    }
    const texture = this.scene.textures.get(SHINY_SPARKLE_TEXTURE);
    for (const [name, frame] of Object.entries(SPARKLE_FRAMES)) {
      if (!texture.has(name)) {
        texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
      }
    }
    this.images[index] = this.scene.add.image(0, 0, SHINY_SPARKLE_TEXTURE, 'glint').setOrigin(0.5, 0.5).setVisible(false);
    return this.images[index];
  }
}
