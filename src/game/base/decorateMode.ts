import Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';
import { audioManager } from '../audio/AudioManager';
import { decorateKeyHintLine } from '../input/keyBindings';
import { GAME_FONT } from '../ui/gameFont';
import { WINDOW_CREAM, WINDOW_INK, drawPixelWindow } from '../ui/pixelWindow';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { CANOPY_BAND, FLOOR_FURNITURE_DEPTH } from '../world/depths';
import { TILE_SIZE } from '../worldMap';
import { pieceTiles, placedPiece, type Placement } from '../home/arrangement';
import {
  canTurnNow,
  decorate,
  decorBox,
  decorRefusalLine,
  heldPlacement,
  heldRefusal,
  pieceUnderCursor,
  startDecorating,
  type DecorAction,
  type DecorContext,
  type DecorRefusal,
  type DecorState,
} from '../home/decorating';
import type { FurnitureDefinition } from '../home/furniture';
import type { BuiltRoom } from './rooms';
import { furnitureImage } from './furnitureArt';

/**
 * Decorating THE BOLTHOLE, drawn: the cursor on the room's tiles, the piece in
 * the player's hands as a ghost over the floor it would land on - green where
 * it fits, red where it does not, and the reason why in the panel at the top -
 * and the keys for what can be done now along the foot of the screen.
 *
 * Everything it decides is `home/decorating.ts`; this only draws it and turns
 * keys and the pointer into its actions. Habbo's controls are the pointer's:
 * the cursor follows it, a click picks up or puts down, a right click turns,
 * and the wheel walks the box. The keyboard does all of it too.
 */

export interface DecorateHost {
  readonly scene: Phaser.Scene;
  /** The room as it is built now. */
  built(): BuiltRoom;
  /** Where the player is standing: nothing solid lands on it, and it must still lead out. */
  standing(): GridPosition;
  /** What the save owns, which is what the box is drawn from. */
  owned(): ReadonlyMap<string, number>;
  /** Draws the house with this layout, without writing it: a piece has been picked up. */
  show(layout: readonly Placement[]): void;
  /** Writes the layout to the save and draws the house from it: a piece has landed. */
  keep(layout: readonly Placement[]): void;
  /** Says what the keys do now, along the foot of the screen. */
  showHint(text: string): void;
}

/** The keys a frame pressed, already read by the scene. */
export interface DecorateInput {
  readonly move?: { readonly dx: number; readonly dy: number };
  readonly press?: boolean;
  readonly turn?: boolean;
  readonly box?: 1 | -1;
  readonly putAway?: boolean;
  /** Escape: drop what is in hand, or stop decorating. */
  readonly back?: boolean;
  /** H: stop decorating. */
  readonly done?: boolean;
}

const PANEL_MARGIN = 6;
const PANEL_PADDING_X = 6;
const PANEL_PADDING_Y = 3;
const FITS = 0x58c860;
const REFUSED = 0xe05048;
const CURSOR = 0xffffff;
const HOVER = 0xf7d36b;
const REFUSED_INK = '#a8281c';
const FITS_INK = '#20683a';

export class DecorateMode {
  private state: DecorState;
  private refusal: DecorRefusal | null = null;
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Image | null = null;
  private ghostKey = '';
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly cleanUp: (() => void)[] = [];

  private readonly host: DecorateHost;

  public constructor(host: DecorateHost, layout: readonly Placement[], cursor: GridPosition) {
    this.host = host;
    const room = host.built().home!.plan.room;
    this.state = startDecorating(room, layout, cursor);
    const { scene } = host;
    this.grid = scene.add.graphics().setDepth(FLOOR_FURNITURE_DEPTH + 0.01);
    this.marks = scene.add.graphics().setDepth(CANOPY_BAND + 0.05);
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(CANOPY_BAND + 0.2);
    const text = (): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(CANOPY_BAND + 0.21);
    this.title = text();
    this.status = text();
    this.listenToPointer();
    audioManager.play('menuOpen');
    this.draw();
  }

  /** Whether something is in the player's hands. */
  public get holding(): boolean {
    return this.state.held !== null;
  }

  /**
   * One frame's keys. Returns false once decorating is over - the held piece,
   * if any, gone back where it came from.
   */
  public update(input: DecorateInput): boolean {
    if (input.done || (input.back && !this.state.held)) {
      this.act({ kind: 'cancel' });
      audioManager.play('menuClose');
      return false;
    }
    if (input.back) this.act({ kind: 'cancel' });
    if (input.move) this.act({ kind: 'move', ...input.move });
    if (input.press) this.act({ kind: 'press' });
    if (input.turn) this.act({ kind: 'turn' });
    if (input.box) this.act({ kind: 'box', step: input.box });
    if (input.putAway) this.act({ kind: 'put-away' });
    return true;
  }

  /** Redraws over a house the scene has just drawn again: a window resized, or a piece landed. */
  public draw(): void {
    this.drawGrid();
    this.drawMarks();
    this.drawPanel();
    this.host.showHint(
      decorateKeyHintLine(
        this.state.held ? 'holding' : pieceUnderCursor(this.state) ? 'on-a-piece' : 'on-the-floor',
        canTurnNow(this.state),
      ),
    );
  }

  /**
   * Lets go of the pointer and the canvas, and nothing else: what a scene
   * shutting down mid-decorate needs, since its own drawing goes with it.
   */
  public release(): void {
    this.cleanUp.forEach((undo) => undo());
    this.cleanUp.length = 0;
  }

  public destroy(): void {
    this.release();
    this.grid.destroy();
    this.marks.destroy();
    this.ghost?.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.status.destroy();
    this.host.showHint('');
  }

  private context(): DecorContext {
    return {
      plan: this.host.built().home!.plan,
      owned: this.host.owned(),
      standing: [this.host.standing()],
    };
  }

  private act(action: DecorAction): void {
    const before = this.state;
    const result = decorate(before, action, this.context());
    this.state = result.state;
    this.refusal = result.refusal ?? null;
    if (result.changed) {
      this.host.keep(this.state.layout);
    } else if (this.state.layout !== before.layout) {
      this.host.show(this.state.layout);
    }
    const sound = {
      'picked-up': 'select',
      'put-down': 'confirm',
      turned: 'select',
      boxed: 'menuClose',
      'took-out': 'select',
      cancelled: 'cancel',
      refused: 'denied',
      moved: null,
      nothing: null,
    } as const;
    const effect = sound[result.outcome];
    if (effect) audioManager.play(effect);
    this.draw();
  }

  // -- the pointer -----------------------------------------------------------

  private listenToPointer(): void {
    const { scene } = this.host;
    const tileOf = (pointer: Phaser.Input.Pointer): GridPosition => ({
      x: Math.floor(pointer.worldX / TILE_SIZE),
      y: Math.floor(pointer.worldY / TILE_SIZE),
    });
    const plan = (): { width: number; height: number } => this.host.built().home!.plan;
    const inRoom = (tile: GridPosition): boolean =>
      tile.x >= 0 && tile.y >= 0 && tile.x < plan().width && tile.y < plan().height;
    const move = (pointer: Phaser.Input.Pointer): void => {
      const tile = tileOf(pointer);
      if (inRoom(tile) && (tile.x !== this.state.cursor.x || tile.y !== this.state.cursor.y)) {
        this.act({ kind: 'point', at: tile });
      }
    };
    const down = (pointer: Phaser.Input.Pointer): void => {
      const tile = tileOf(pointer);
      if (!inRoom(tile)) return;
      move(pointer);
      this.act(pointer.rightButtonDown() ? { kind: 'turn' } : { kind: 'press' });
    };
    const wheel = (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void => {
      if (dy !== 0) this.act({ kind: 'box', step: dy > 0 ? 1 : -1 });
    };
    // A right click turns a piece, so the browser's own menu keeps out of the
    // way of one - while decorating, and only then.
    const canvas = scene.game.canvas;
    const noMenu = (event: Event): void => event.preventDefault();
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, down);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, wheel);
    canvas?.addEventListener('contextmenu', noMenu);
    this.cleanUp.push(() => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, down);
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL, wheel);
      canvas?.removeEventListener('contextmenu', noMenu);
    });
  }

  // -- drawing ---------------------------------------------------------------

  /** A faint square round every tile of floor, as Habbo shows the room's grid while it is being arranged. */
  private drawGrid(): void {
    const { plan } = this.host.built().home!;
    this.grid.clear().lineStyle(1, 0xffffff, 0.14);
    for (let y = 0; y < plan.height; y += 1) {
      for (let x = 0; x < plan.width; x += 1) {
        if (!plan.blocked[y][x]) {
          this.grid.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }
    }
  }

  private drawMarks(): void {
    const { held, cursor } = this.state;
    this.marks.clear();
    if (held) {
      const placement = heldPlacement(this.state, held);
      const piece = placedPiece(placement);
      const fits = heldRefusal(this.state, this.context()) === null;
      if (piece) {
        this.marks.fillStyle(fits ? FITS : REFUSED, 0.38);
        for (const tile of pieceTiles(piece)) {
          this.marks.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        this.drawGhost(piece.definition, placement);
      }
    } else {
      this.ghost?.destroy();
      this.ghost = null;
      this.ghostKey = '';
      // What a press would pick up, framed whole.
      const under = pieceUnderCursor(this.state);
      if (under) {
        this.marks.lineStyle(1, HOVER, 1);
        this.marks.strokeRect(
          under.x * TILE_SIZE + 0.5,
          under.y * TILE_SIZE + 0.5,
          under.definition.width * TILE_SIZE - 1,
          under.definition.height * TILE_SIZE - 1,
        );
      }
    }
    this.marks.lineStyle(1, CURSOR, 1);
    this.marks.strokeRect(cursor.x * TILE_SIZE + 0.5, cursor.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  /** The piece in hand, drawn where it would land, see-through. */
  private drawGhost(definition: FurnitureDefinition, placement: Placement): void {
    const key = `${placement.id}:${placement.facing}:${placement.x},${placement.y}`;
    if (key === this.ghostKey && this.ghost) {
      return;
    }
    this.ghost?.destroy();
    this.ghostKey = key;
    this.ghost = furnitureImage(this.host.scene, definition.facings[placement.facing], placement.x, placement.y)
      .setAlpha(0.8)
      .setDepth(CANOPY_BAND + 0.06);
  }

  /** The panel at the top: what is in hand or under the cursor, and whether it fits. */
  private drawPanel(): void {
    const { held } = this.state;
    const context = this.context();
    const under = held ? undefined : pieceUnderCursor(this.state);
    const definition = held ? placedPiece(heldPlacement(this.state, held))?.definition : under?.definition;
    const kinds = decorBox({ ...this.state, held: null }, context.owned).length;
    const refusal = this.refusal ?? (held ? heldRefusal(this.state, context) : null);
    let title = 'DECORATING';
    let status = kinds === 0 ? 'THE BOX IS EMPTY' : `${kinds} ${kinds === 1 ? 'KIND' : 'KINDS'} OF THING IN THE BOX`;
    let ink = WINDOW_INK;
    if (definition) {
      title = held && !held.from && kinds > 0 ? `${definition.name}  ${this.state.boxIndex + 1}/${kinds}` : definition.name;
      status = whereFrom(definition);
    }
    if (refusal) {
      status = decorRefusalLine(refusal);
      ink = REFUSED_INK;
    } else if (held) {
      status = `IT FITS HERE - ${whereFrom(definition)}`;
      ink = FITS_INK;
    }
    this.title.setText(title);
    this.status.setText(status).setColor(ink);
    const { width: viewWidth } = this.host.scene.scale;
    const width = Math.min(
      viewWidth - PANEL_MARGIN * 2,
      Math.ceil(Math.max(this.title.width, this.status.width)) + PANEL_PADDING_X * 2,
    );
    const height = Math.ceil(this.title.height + this.status.height) + PANEL_PADDING_Y * 2;
    const x = Math.round((viewWidth - width) / 2);
    const y = PANEL_MARGIN;
    this.panel.clear();
    drawPixelWindow(this.panel, { x, y, width, height }, { fill: WINDOW_CREAM });
    this.title.setPosition(x + PANEL_PADDING_X, y + PANEL_PADDING_Y);
    this.status.setPosition(x + PANEL_PADDING_X, y + PANEL_PADDING_Y + Math.ceil(this.title.height));
  }
}

/** Where a piece came from, which is what the panel says about it. */
function whereFrom(definition: FurnitureDefinition | undefined): string {
  switch (definition?.source.kind) {
    case 'house':
      return "THE HOUSE'S OWN";
    case 'found':
      return definition.rare ? 'SUPER RARE - FOUND ON A RAID' : 'FOUND ON A RAID';
    case 'doll':
      return 'FOR ONE YOU BROUGHT HOME';
    default:
      return '';
  }
}
