import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon/Pokemon';
import type { StashedPokemon } from '../stash/Stash';
import { pokemonSoleDrop } from '../world/pokemonFigures';
import { FIGURE_BAND, atRow } from '../world/depths';
import { TILE_SIZE } from '../worldMap';
import { FOLLOWER_ART } from './generated/followerArt';
import { HomeGardenFigures } from './homeGardenFigures';
import { PARTNER_GLINT_DROP, PARTNER_SPRITE_Y_OFFSET, PartnerFigure, type PartnerHost } from './partnerFigure';
import { GARDEN_GLINT_PLACE, GLINT_ART, GLINT_EVERY_MS, GLINT_FIRST_MS, GLINT_MOTES, ICON_GLINT_RISE, glintAt, glintHeadStart } from './shinyGlint';

/**
 * A shiny Pokemon walking about (`shinyGlint.ts`): the partner at the
 * player's heel and the Pokemon out in THE BOLTHOLE's garden, on a stage that
 * remembers what it was asked to draw. An ordinary one draws no stars at all.
 */

class Drawn {
  public x = 0;
  public y = 0;
  public depth = 0;
  public alpha = 1;
  public visible = true;
  public frame: string | number = 0;
  public gone = false;
  public clear(): this {
    return this;
  }
  public fillStyle(): this {
    return this;
  }
  public fillRect(): this {
    return this;
  }
  public readonly texture: string;
  public constructor(texture = '') {
    this.texture = texture;
  }
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
  public setAlpha(alpha = 1): this {
    this.alpha = alpha;
    return this;
  }
  public setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  public setFrame(frame: string | number): this {
    this.frame = frame;
    return this;
  }
  public setOrigin(): this {
    return this;
  }
  public setFlipX(): this {
    return this;
  }
  public play(): this {
    return this;
  }
  public destroy(): void {
    this.gone = true;
  }
}

/** A stage, and every graphics drawn on it after the figures were stood up: the stars. */
function stage(fetched: readonly string[] = []) {
  const stars: Drawn[] = [];
  const sprites: Drawn[] = [];
  const scene = {
    textures: { exists: (key: string) => fetched.includes(key) },
    anims: { exists: () => true, create: () => undefined },
    tweens: { add: () => undefined },
    add: {
      sprite: (x: number, y: number, texture: string) => {
        const sprite = new Drawn(texture).setPosition(x, y);
        sprites.push(sprite);
        return sprite;
      },
      graphics: () => {
        const star = new Drawn();
        stars.push(star);
        return star;
      },
    },
  } as unknown as Phaser.Scene;
  return { scene, stars, sprites, lit: () => stars.filter((star) => star.visible && !star.gone) };
}

const PLAYER: GridPosition = { x: 14, y: 12 };
const HEEL: GridPosition = { x: 14, y: 13 };
/** A moment with all three glints out at once. */
const ALL_OUT_MS = GLINT_FIRST_MS + GLINT_MOTES[GLINT_MOTES.length - 1].fromMs + 10;

function partnerAtHeel(shiny: boolean, place = { tile: HEEL, out: true, facing: 'up' as const }, fetched: readonly string[] = []) {
  const { scene, sprites, stars, lit } = stage(fetched);
  const host: PartnerHost = {
    playerTile: () => PLAYER,
    playerStepping: () => false,
    stepProgress: () => 0,
    player: new Drawn().setPosition(PLAYER.x * TILE_SIZE, PLAYER.y * TILE_SIZE).setDepth(atRow(FIGURE_BAND, PLAYER.y)) as unknown as Phaser.GameObjects.Sprite,
    playerHeadMark: new Drawn() as unknown as Phaser.GameObjects.Graphics,
    reading: () => false,
    standingAbout: () => true,
    quiet: () => true,
  };
  const pokemon = { name: 'Charmander', shiny, isFainted: false, currentHp: 20, maxHp: 20 } as unknown as Pokemon;
  const figure = new PartnerFigure(scene, host, { pokemon, species: 'charmander' }, place, { fadeIn: false });
  return { figure, sprite: sprites[0], stars, lit };
}

describe('a shiny partner at the player’s heel', () => {
  it('walks in its shiny colours once the raid has fetched them, and in its ordinary ones until then', () => {
    expect(partnerAtHeel(true, undefined, ['partner-shiny-charmander']).sprite.texture).toBe('partner-shiny-charmander');
    expect(partnerAtHeel(true).sprite.texture).toBe('partner-charmander');
    expect(partnerAtHeel(false, undefined, ['partner-shiny-charmander']).sprite.texture).toBe('partner-charmander');
  });

  it('glints round its head, over its own picture and under whoever stands a row nearer', () => {
    const { figure, sprite, lit } = partnerAtHeel(true);

    figure.update(ALL_OUT_MS);

    expect(glintAt(ALL_OUT_MS)).toHaveLength(GLINT_MOTES.length);
    const head = {
      x: HEEL.x * TILE_SIZE + TILE_SIZE / 2,
      y: HEEL.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET + FOLLOWER_ART.charmander.topPixelY + PARTNER_GLINT_DROP,
    };
    expect(lit().map((star) => [star.x, star.y])).toEqual(
      glintAt(ALL_OUT_MS).map((mote) => [head.x + mote.dx, head.y + mote.dy]),
    );
    for (const star of lit()) {
      expect(star.depth).toBeGreaterThan(sprite.depth);
      expect(star.depth).toBeLessThan(atRow(FIGURE_BAND, HEEL.y + 1));
    }
    // All of every star is within a tile of the middle of its head, and none below it.
    const half = (GLINT_ART.star.length - 1) / 2;
    for (const star of lit()) {
      expect(Math.abs(star.x - head.x) + half).toBeLessThanOrEqual(TILE_SIZE);
      expect(star.y).toBeLessThanOrEqual(head.y + TILE_SIZE / 2);
    }
  });

  it('glints no more once it is tucked away, and takes its stars with it when it goes', () => {
    const { figure, stars, lit } = partnerAtHeel(true);
    figure.update(ALL_OUT_MS);
    expect(lit()).toHaveLength(GLINT_MOTES.length);

    figure.standAt({ tile: PLAYER, out: false, facing: 'up' });
    expect(lit()).toHaveLength(0);

    figure.destroy();
    expect(stars.every((star) => star.gone)).toBe(true);
  });

  it('is as faint as its figure while a caption reads through it', () => {
    const { figure, sprite, lit } = partnerAtHeel(true);
    figure.setVeiled(true);
    figure.update(ALL_OUT_MS);
    expect(lit().map((star) => star.alpha)).toEqual(GLINT_MOTES.map(() => sprite.alpha));
    expect(sprite.alpha).toBeLessThan(1);
  });

  it('draws no stars at all for a partner in its ordinary colours', () => {
    const { figure, stars } = partnerAtHeel(false);
    figure.update(ALL_OUT_MS);
    expect(stars).toHaveLength(0);
  });
});

describe('a shiny Pokemon out in THE BOLTHOLE’s garden', () => {
  /** The first shiny one of the garden with all three of its glints out. */
  const FIRST_IN_GARDEN_ALL_OUT_MS = GLINT_EVERY_MS - glintHeadStart(GARDEN_GLINT_PLACE) + ALL_OUT_MS;

  const stored = (id: string, speciesId: string, shiny: boolean): StashedPokemon =>
    ({ id, pokemon: { shiny, base: { id: speciesId, dexId: 25 } } }) as unknown as StashedPokemon;

  it('glints over its own icon, and the ordinary one beside it does not', () => {
    const { scene, sprites, lit } = stage();
    const garden = new HomeGardenFigures(scene, [stored('a', 'pikachu', true), stored('b', 'eevee', false)], () => true);
    const pikachu = sprites[0];

    // The first of the garden has a head start on the partner (`glintHeadStart`).
    garden.update(FIRST_IN_GARDEN_ALL_OUT_MS, true, () => false);

    const middle = { x: pikachu.x, y: pikachu.y - pokemonSoleDrop('pikachu') - ICON_GLINT_RISE };
    expect(lit().map((star) => [star.x, star.y])).toEqual(
      glintAt(ALL_OUT_MS).map((mote) => [middle.x + mote.dx, middle.y + mote.dy]),
    );
    for (const star of lit()) {
      expect(star.depth).toBeGreaterThan(pikachu.depth);
    }
  });

  it('never begins a burst with the one beside it', () => {
    const { scene, stars, sprites } = stage();
    const garden = new HomeGardenFigures(scene, [stored('a', 'pikachu', true), stored('b', 'eevee', true)], () => true);
    // The two stand two tiles apart (`gardenStarts`), so a star is its nearer figure's.
    const owner = (star: Drawn): number => (Math.abs(star.x - sprites[0].x) < Math.abs(star.x - sprites[1].x) ? 0 : 1);
    const began: number[][] = [[], []];
    let was = new Set<number>();
    for (let ms = 0; ms < GLINT_EVERY_MS * 3; ms += 50) {
      garden.update(50, true, () => false);
      const now = new Set(stars.filter((star) => star.visible).map(owner));
      now.forEach((index) => {
        if (!was.has(index)) began[index].push(ms);
      });
      was = now;
    }
    expect(began[0].length).toBeGreaterThanOrEqual(2);
    expect(began[1].length).toBeGreaterThanOrEqual(2);
    for (const a of began[0]) {
      for (const b of began[1]) {
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(250);
      }
    }
  });

  it('takes the stars away with the Pokemon when it is taken onto the team', () => {
    const { scene, stars, lit } = stage();
    const shiny = stored('a', 'pikachu', true);
    const garden = new HomeGardenFigures(scene, [shiny], () => true);
    garden.update(FIRST_IN_GARDEN_ALL_OUT_MS, false, () => false);
    expect(lit()).toHaveLength(GLINT_MOTES.length);

    garden.settle([]);

    expect(stars.every((star) => star.gone)).toBe(true);
  });
});
