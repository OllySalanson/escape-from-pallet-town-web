import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { STEP_DURATION_MS } from '../movement/stepClock';
import type { GridPosition } from '../movement/gridMovement';
import type { StashedPokemon } from '../stash/Stash';
import { FIGURE_BAND, atRow } from '../world/depths';
import {
  POKEMON_ICON_FRAME_MS,
  POKEMON_ICON_TEXTURE,
  isFigureSpecies,
  pokemonIconFrames,
  pokemonSoleDrop,
  type FigureSpeciesId,
} from '../world/pokemonFigures';
import { TILE_SIZE } from '../worldMap';
import { gardenStarts, nextGardenTile } from './homeGarden';

/** How often one of them thinks about stepping, as the Day-Care pen's does. */
const STEP_EVERY_MS = 1800;
const STEP_SPREAD_MS = 2600;

interface GardenFigure {
  readonly stored: StashedPokemon;
  readonly species: FigureSpeciesId;
  readonly sprite: Phaser.GameObjects.Sprite;
  tile: GridPosition;
  nextStepMs: number;
}

/**
 * The Pokémon walking about THE BOLTHOLE's garden (`homeGarden.ts` says who
 * and why), drawn as the Day-Care pen draws its Pokémon: FireRed's party icon,
 * bobbing, a tile at a time. Each is solid where it stands, as the harbour's
 * Pokémon are, so walking into one turns the player to it and the interact key
 * says who it is; none ever steps onto a tile somebody else has.
 */
export class HomeGardenFigures {
  private readonly figures: GardenFigure[] = [];
  private readonly scene: Phaser.Scene;
  /** Whether a tile may be stood on at all: the map's ground, and nobody else's. */
  private readonly free: (tile: GridPosition) => boolean;

  public constructor(scene: Phaser.Scene, pokemon: readonly StashedPokemon[], free: (tile: GridPosition) => boolean) {
    this.scene = scene;
    this.free = free;
    this.settle(pokemon);
  }

  /**
   * Who is out now: anybody still out stays where they stand, anybody gone is
   * taken away, and a newcomer comes out on the first open tile - so taking
   * one on the team does not shuffle the rest of the garden.
   */
  public settle(pokemon: readonly StashedPokemon[], occupied: (tile: GridPosition) => boolean = () => false): void {
    const wanted = new Set(pokemon.map((stored) => stored.id));
    for (const figure of [...this.figures]) {
      if (wanted.has(figure.stored.id)) continue;
      figure.sprite.destroy();
      this.figures.splice(this.figures.indexOf(figure), 1);
    }
    const drawn = pokemon.filter(
      (stored) => isFigureSpecies(stored.pokemon.base.id) && !this.figures.some((figure) => figure.stored.id === stored.id),
    );
    const starts = gardenStarts(drawn.length, (tile) => this.free(tile) && !occupied(tile) && !this.holds(tile));
    drawn.forEach((stored, index) => {
      const tile = starts[index];
      if (!tile) return;
      const species = stored.pokemon.base.id as FigureSpeciesId;
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
        .sprite(...this.point(tile, species), POKEMON_ICON_TEXTURE, first)
        .setOrigin(0.5, 1)
        .setDepth(atRow(FIGURE_BAND, tile.y))
        // FireRed's icons look left; every other one looks the other way, so
        // the garden is not six of the same picture in a row.
        .setFlipX(index % 2 === 1)
        .play(key);
      this.figures.push({ stored, species, sprite, tile, nextStepMs: STEP_EVERY_MS + index * 400 });
    });
  }

  /** Who stands on a tile, if anybody does. */
  public at(tile: GridPosition): StashedPokemon | undefined {
    return this.figures.find((figure) => figure.tile.x === tile.x && figure.tile.y === tile.y)?.stored;
  }

  /** Whether one of them stands on a tile: they are solid, as the harbour's Pokémon are. */
  public holds(tile: GridPosition): boolean {
    return this.at(tile) !== undefined;
  }

  /** Where they stand, for captions to keep clear of. */
  public standing(): readonly GridPosition[] {
    return this.figures.map((figure) => figure.tile);
  }

  /** For a playtest driver: who is out, by stash id, and where. */
  public get out(): readonly { readonly id: string; readonly tile: GridPosition }[] {
    return this.figures.map((figure) => ({ id: figure.stored.id, tile: { ...figure.tile } }));
  }

  /** Its cry, faced: the one thing it says. */
  public cry(stored: StashedPokemon): void {
    audioManager.play('cry', { species: stored.pokemon.base.dexId });
  }

  /**
   * They potter: now and then each steps a tile, never out of the garden and
   * never onto anybody - `occupied` is the player, where they are stepping to,
   * and their partner. It is the yard's own life, so it is off any clock, and
   * it waits while anything is being read.
   */
  public update(deltaMs: number, paused: boolean, occupied: (tile: GridPosition) => boolean): void {
    if (paused) return;
    for (const figure of this.figures) {
      figure.nextStepMs -= deltaMs;
      if (figure.nextStepMs > 0) continue;
      figure.nextStepMs = STEP_EVERY_MS + Math.random() * STEP_SPREAD_MS;
      const to = nextGardenTile(
        figure.tile,
        Math.random(),
        (tile) => this.free(tile) && !occupied(tile) && !this.holds(tile),
      );
      if (to.x === figure.tile.x && to.y === figure.tile.y) continue;
      if (to.x !== figure.tile.x) {
        figure.sprite.setFlipX(to.x > figure.tile.x);
      }
      figure.tile = to;
      const [x, y] = this.point(to, figure.species);
      figure.sprite.setDepth(atRow(FIGURE_BAND, to.y));
      this.scene.tweens.add({ targets: figure.sprite, x, y, duration: STEP_DURATION_MS * 2 });
    }
  }

  public destroy(): void {
    for (const figure of this.figures) figure.sprite.destroy();
    this.figures.length = 0;
  }

  /** Where an icon stands on a tile: centred, its feet on the tile's last row. */
  private point(tile: GridPosition, species: FigureSpeciesId): [number, number] {
    return [tile.x * TILE_SIZE + TILE_SIZE / 2, (tile.y + 1) * TILE_SIZE + pokemonSoleDrop(species)];
  }
}
