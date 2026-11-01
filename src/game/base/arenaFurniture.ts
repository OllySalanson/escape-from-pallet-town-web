import type Phaser from 'phaser';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import { iconTextureKey, itemIconName } from '../ui/icons';
import { TILE_SIZE } from '../worldMap';
import { FIGURE_BAND, atRow } from '../world/depths';
import {
  POKEMON_ICON_FRAME_MS,
  POKEMON_ICON_TEXTURE,
  isFigureSpecies,
  pokemonIconFrames,
  pokemonSoleDrop,
} from '../world/pokemonFigures';
import { ARENA_STATIONS } from './arenaHall';

/**
 * What stands on THE RAID ARENA's furniture, which is the loadout you can read
 * from across the room: whoever is coming sits along the bench - but the partner,
 * who is at the player's heel already and goes over the fence with them - and the
 * pack this raid is wearing stands on the rack beside what is in it.
 *
 * Drawn from what has been chosen, and put away and drawn again whenever a panel
 * closes. Nothing here is stored.
 */

/** How many fit on the bench's slab. */
const BENCH_SEATS = 6;
/** The bench's seat, in from the ends of its tiles (`scripts/draw-arena-hall.mts`). */
const BENCH_INSET_LEFT = 2;
const BENCH_INSET_RIGHT = 2;
/** How far up from the foot of its row a Pokemon's feet rest on the seat. */
const SEAT_RISE = 10;
/** The rack's shelf: how far up from the foot of its row, and how far things stand along it. */
const SHELF_RISE = 8;
const RACK_INSET_LEFT = 1;
const SHELF_SLOTS = 3;

const tilesOf = (id: string) => ARENA_STATIONS.find((station) => station.id === id)!.tiles;

export class ArenaFurniture {
  private readonly scene: Phaser.Scene;
  private things: Phaser.GameObjects.GameObject[] = [];

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public show(flow: DeploymentFlow, partnerId: string | null): void {
    this.clear();
    this.seatTheBench(flow, partnerId);
    this.dressTheRack(flow);
  }

  private seatTheBench(flow: DeploymentFlow, partnerId: string | null): void {
    const tiles = tilesOf('bench');
    const left = tiles[0].x * TILE_SIZE + BENCH_INSET_LEFT;
    const right = (tiles[tiles.length - 1].x + 1) * TILE_SIZE - BENCH_INSET_RIGHT;
    const foot = (tiles[0].y + 1) * TILE_SIZE;
    const sitting = flow.party.filter((stored) => stored.id !== partnerId);
    const seated = sitting.slice(0, BENCH_SEATS);
    seated.forEach((stored, index) => {
      const species = stored.pokemon.base.id;
      if (!isFigureSpecies(species)) {
        return;
      }
      const [first, second] = pokemonIconFrames(species);
      const key = `pokemon-icon-${species}`;
      if (!this.scene.anims.exists(key)) {
        this.scene.anims.create({
          key,
          frames: [
            { key: POKEMON_ICON_TEXTURE, frame: first },
            { key: POKEMON_ICON_TEXTURE, frame: second },
          ],
          frameRate: 1000 / POKEMON_ICON_FRAME_MS,
          repeat: -1,
        });
      }
      const sprite = this.scene.add
        .sprite(
          // Spread along it evenly however many there are, so nobody sits in anybody's lap.
          Math.round(left + ((right - left) * (index + 0.5)) / seated.length),
          foot - SEAT_RISE + pokemonSoleDrop(species),
          POKEMON_ICON_TEXTURE,
          first,
        )
        .setOrigin(0.5, 1)
        .setDepth(atRow(FIGURE_BAND, tiles[0].y))
        .play(key);
      this.things.push(sprite);
    });
  }

  private dressTheRack(flow: DeploymentFlow): void {
    const tiles = tilesOf('rack');
    const left = tiles[0].x * TILE_SIZE + RACK_INSET_LEFT + 2;
    const shelf = (tiles[0].y + 1) * TILE_SIZE - SHELF_RISE;
    const packed = [...flow.items].sort((a, b) => b.quantity - a.quantity).map((item) => item.itemId as string);
    const onShow = [...(flow.packItemId === undefined ? [] : [flow.packItemId as string]), ...packed].slice(0, SHELF_SLOTS);
    onShow.forEach((itemId, index) => {
      this.things.push(
        this.scene.add
          .image(left + index * TILE_SIZE - index, shelf, iconTextureKey(itemIconName(itemId)))
          .setOrigin(0, 1)
          .setDepth(atRow(FIGURE_BAND, tiles[0].y)),
      );
    });
  }

  private clear(): void {
    this.things.forEach((thing) => thing.destroy());
    this.things = [];
  }

  public destroy(): void {
    this.clear();
  }
}
