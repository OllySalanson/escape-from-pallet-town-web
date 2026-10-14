import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon/Pokemon';
import { FIGURE_BAND, atRow } from '../world/depths';
import { HarbourFigures } from './harbourFigures';
import { PartnerFigure, type PartnerHost } from './partnerFigure';

/**
 * Somebody else in the shared harbour standing on this player's partner, as
 * the browser played it (two tabs over `?harbour=local`): AMY walked onto the
 * tile OLLY's Charmander stood on at heel, and her figure was drawn over it, so
 * OLLY's partner vanished from his screen while it stood there. Everybody
 * arrives on the same spawn with a partner on the same heel tile, so in a busy
 * harbour this is the ordinary case, not a corner.
 */

/** A drawn thing that remembers where it was last put and how deep. */
class Drawn {
  public x = 0;
  public y = 0;
  public depth = 0;
  public visible = true;
  public text = '';
  public width = 12;
  public height = 12;
  public frame = { name: 0 };
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
  public setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  public setText(text: string): this {
    this.text = text;
    return this;
  }
  public setOrigin(): this {
    return this;
  }
  public setAlpha(): this {
    return this;
  }
  public setFrame(): this {
    return this;
  }
  public play(): this {
    return this;
  }
  public stop(): this {
    return this;
  }
  public clear(): this {
    return this;
  }
  public fillStyle(): this {
    return this;
  }
  public fillRect(): this {
    return this;
  }
  public destroy(): void {}
}

function stage() {
  const sprites: Drawn[] = [];
  const scene = {
    add: {
      sprite: () => {
        const sprite = new Drawn();
        sprites.push(sprite);
        return sprite;
      },
      graphics: () => new Drawn(),
      text: (_x: number, _y: number, text: string) => new Drawn().setText(text),
    },
  } as unknown as Phaser.Scene;
  return { scene, sprites };
}

const PLAYER: GridPosition = { x: 14, y: 12 };
const HEEL: GridPosition = { x: 14, y: 13 };

function ollyWithPartner() {
  const { scene, sprites } = stage();
  const player = new Drawn().setDepth(atRow(FIGURE_BAND, PLAYER.y));
  const host: PartnerHost = {
    playerTile: () => PLAYER,
    playerStepping: () => false,
    stepProgress: () => 0,
    player: player as unknown as Phaser.GameObjects.Sprite,
    playerHeadMark: new Drawn() as unknown as Phaser.GameObjects.Graphics,
    reading: () => false,
    standingAbout: () => true,
    quiet: () => true,
  };
  const pokemon = { name: 'Charmander', isFainted: false, currentHp: 20, maxHp: 20 } as unknown as Pokemon;
  new PartnerFigure(scene, host, { pokemon, species: 'charmander' }, { tile: HEEL, out: true, facing: 'up' }, { fadeIn: false });
  const partner = sprites[0];
  const others = new HarbourFigures(scene);
  const amyOn = (tile: GridPosition) => {
    others.update([{ id: 'amy', place: 'yard', tile, toward: null, progress: 0, facing: 'down', name: 'AMY' }]);
    return sprites[sprites.length - 1];
  };
  return { partner, player, amyOn };
}

describe('another player in the harbour and this player\'s partner', () => {
  it('draws somebody standing on the partner\'s tile behind the partner, so it is still seen', () => {
    const { partner, amyOn } = ollyWithPartner();
    const amy = amyOn(HEEL);
    expect(amy.depth).toBeLessThan(partner.depth);
  });

  it('draws somebody standing on the player\'s own tile behind the player', () => {
    const { player, amyOn } = ollyWithPartner();
    expect(amyOn(PLAYER).depth).toBeLessThan(player.depth);
  });

  it('still draws somebody a row lower in front of the partner, and a row higher behind it', () => {
    const { partner, amyOn } = ollyWithPartner();
    expect(amyOn({ x: HEEL.x, y: HEEL.y + 1 }).depth).toBeGreaterThan(partner.depth);
    expect(amyOn({ x: HEEL.x, y: HEEL.y - 1 }).depth).toBeLessThan(partner.depth);
  });
});
