import { describe, expect, it, vi } from 'vitest';

/**
 * The Pokemon at the player's heel on a raid, driven through the real
 * WorldScene: who it is, where it walks, and the promises that keep it company
 * rather than a thing in the way - it is never collision, never costs the clock,
 * and gets out of the way of a ledge, a door and anybody stepping onto its tile.
 */

class FakeKey {
  public isDown = false;
  public justDown = false;
  public on(): this {
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      public constructor(key?: string) {
        this.key = key;
      }
      public key?: string;
    },
    Math: {
      Vector2: class {
        public x = 0;
        public y = 0;
        public set(x: number, y: number): this {
          this.x = x;
          this.y = y;
          return this;
        }
      },
      Linear: (from: number, to: number, t: number) => from + (to - from) * t,
    },
    Input: {
      Keyboard: {
        JustDown: (key: FakeKey | undefined) => Boolean(key?.justDown),
        KeyCodes: { SPACE: 32, ENTER: 13, P: 80, B: 66, K: 75, O: 79 },
      },
    },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: {
      Scene2D: {
        Events: {
          FADE_OUT_COMPLETE: 'camerafadeoutcomplete',
          FADE_IN_COMPLETE: 'camerafadeincomplete',
        },
      },
    },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

vi.mock('../ui/DialogBox', () => ({
  DialogBox: class {
    public visible = false;
    public isCurrentMessageComplete = true;
    public setScrollFactor(): this {
      return this;
    }
    public setVisible(value: boolean): this {
      this.visible = value;
      return this;
    }
    public showMessage(): void {
      this.visible = true;
    }
    public showMessages(): void {
      this.visible = true;
    }
    public advance(): void {}
    public skip(): void {}
    public update(): void {}
  },
}));

import { Bag } from '../items';
import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import { BULBASAUR, CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession, type ActiveRunSession } from '../run/RunSession';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, requireInsertion, type RunInsertionId } from '../run/runGeneration';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { ledgesForMap } from '../world/ledges';
import type { PartnerFigure } from '../base/partnerFigure';
import { WorldScene } from './WorldScene';

/** A display object that answers every chainable setter with itself. */
const chainable = (): never => {
  const members: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(members, {
    get: (target, property) => {
      if (property === 'height' || property === 'width') return 10;
      if (property === 'text') return '';
      if (property === 'frame') return { name: 0 };
      if (!(property in target)) {
        target[property as string] = vi.fn(() => proxy);
      }
      return target[property as string];
    },
  });
  return proxy as never;
};

const makeControls = (): Record<string, FakeKey> => {
  const controls: Record<string, FakeKey> = {};
  for (const name of ['up', 'down', 'left', 'right', 'w', 'a', 's', 'd']) {
    controls[name] = new FakeKey();
  }
  return controls;
};

const attachSceneStubs = (scene: WorldScene, controls: Record<string, FakeKey>): void => {
  Object.assign(scene as unknown as Record<string, unknown>, {
    add: {
      sprite: vi.fn(() => chainable()),
      rectangle: vi.fn(() => chainable()),
      image: vi.fn(() => chainable()),
      text: vi.fn(() => chainable()),
      container: vi.fn(() => chainable()),
      graphics: vi.fn(() => chainable()),
    },
    scale: { width: BASE_STAGE_WIDTH, height: BASE_STAGE_HEIGHT, on: vi.fn(), off: vi.fn() },
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        flash: vi.fn(),
        shake: vi.fn(),
        once: vi.fn((_event: string, callback: () => void) => callback()),
        setBounds: vi.fn(),
        setRoundPixels: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn(),
        centerOn: vi.fn(),
        worldView: { left: 0, right: BASE_STAGE_WIDTH, top: 0, bottom: BASE_STAGE_HEIGHT },
      },
    },
    game: { loop: { frame: 0 } },
    input: {
      keyboard: {
        addCapture: vi.fn(),
        addKey: vi.fn((code: number) => controls[String(code)] ?? new FakeKey()),
        addKeys: vi.fn(() => ({ W: controls.w, A: controls.a, S: controls.s, D: controls.d })),
        createCursorKeys: vi.fn(() => ({
          up: controls.up,
          down: controls.down,
          left: controls.left,
          right: controls.right,
        })),
        on: vi.fn(),
      },
    },
    make: {
      tilemap: vi.fn(() => ({
        addTilesetImage: vi.fn(() => ({})),
        createBlankLayer: vi.fn(() => ({
          putTilesAt: vi.fn(),
          setDepth: vi.fn(),
          forEachTile: vi.fn(),
          setAlpha: vi.fn(),
        })),
      })),
    },
    scene: {
      start: vi.fn(),
      launch: vi.fn(),
      pause: vi.fn(),
      manager: { keys: { base: {}, extraction: {} } },
    },
    events: { once: vi.fn(), on: vi.fn() },
    time: { now: 0, delayedCall: vi.fn((_delayMs: number, callback: () => void) => callback()) },
    tweens: { add: vi.fn(() => chainable()), addCounter: vi.fn(() => chainable()) },
  });
};

/** The parts of the scene these tests read, which are private to it. */
interface Driven {
  currentTile: GridPosition;
  targetTile: GridPosition | null;
  facing: Direction;
  partner: PartnerFigure | null;
  party: PokemonParty;
  dialogBox: { visible: boolean };
  hunterState: { position?: GridPosition | null; mapId?: string };
  runSession: ActiveRunSession;
  isBlocked(tile: GridPosition): boolean;
  standPartnerBesidePlayer(): void;
}

interface RaidOptions {
  readonly party: readonly Pokemon[];
  readonly partner?: Pokemon;
  readonly secured?: readonly Pokemon[];
  readonly insertion?: RunInsertionId;
}

/** Drops into a raid on the scene, with the briefing already read. */
function dropIn({ party, partner, secured = [], insertion = 'floodplain-relay' }: RaidOptions) {
  const controls = makeControls();
  const scene = new WorldScene();
  attachSceneStubs(scene, controls);
  const manager = new RunManager();
  const team = new PokemonParty([...party]);
  manager.startRun(
    { party: team.pokemon, items: [{ itemId: 'potion', quantity: 1 }] },
    { mapId: requireInsertion(insertion).mapId, durationMs: RAID_DURATION_MS },
  );
  const plan = generateRunPlan(7, undefined, insertion, undefined);
  const runSession = createActiveRunSession(
    manager,
    secured.length > 0 ? { pokemon: secured } : {},
    {},
    [],
    [],
    [],
    plan,
    [],
    undefined,
    partner,
  );
  runSession.firstDeploymentBriefingShown = true;
  scene.create({ party: team, bag: new Bag({ potion: 1 }), runSession });
  const driven = scene as unknown as Driven;
  driven.dialogBox.visible = false;
  return { scene, driven, controls, manager };
}

const neighbour = (tile: GridPosition, direction: Direction): GridPosition => ({
  x: tile.x + DIRECTION_DELTAS[direction].x,
  y: tile.y + DIRECTION_DELTAS[direction].y,
});

const KEY: Record<Direction, string> = { up: 'up', down: 'down', left: 'left', right: 'right' };

/** Holds a direction for one frame, then lets the step it began run out. */
function walk(scene: WorldScene, controls: Record<string, FakeKey>, direction: Direction): void {
  const driven = scene as unknown as Driven;
  controls[KEY[direction]].isDown = true;
  scene.update(0, 16);
  controls[KEY[direction]].isDown = false;
  for (let frame = 0; frame < 40 && driven.targetTile !== null; frame += 1) {
    scene.update(0, 16);
  }
}

/** A way out of the player's tile and straight back again, on open ground. */
function openDirection(driven: Driven): Direction {
  const direction = (['right', 'left', 'up', 'down'] as const).find(
    (one) => !driven.isBlocked(neighbour(driven.currentTile, one)),
  );
  if (!direction) {
    throw new Error('The landing has no open neighbour.');
  }
  return direction;
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

describe('who walks at the heel on a raid', () => {
  it('is the lead, standing beside the player from the moment they drop in', () => {
    const lead = new Pokemon(BULBASAUR, 5);
    const { driven } = dropIn({ party: [lead, new Pokemon(PIDGEY, 4)] });

    expect(driven.partner?.pokemon).toBe(lead);
    expect(driven.partner?.appearing).toBe(true);
    expect(driven.partner?.place.out).toBe(true);
    const { tile } = driven.partner!.place;
    expect(Math.abs(tile.x - driven.currentTile.x) + Math.abs(tile.y - driven.currentTile.y)).toBe(1);
  });

  it('is the partner when the lead has no walking art, and nobody when neither does', () => {
    const starter = new Pokemon(CHARMANDER, 5);
    expect(dropIn({ party: [new Pokemon(PIDGEY, 4), starter], partner: starter }).driven.partner?.pokemon).toBe(
      starter,
    );
    expect(dropIn({ party: [new Pokemon(PIDGEY, 4)] }).driven.partner).toBeNull();
  });

  it('is still the starter when it is packed into the secure container, which fills itself with it', () => {
    const starter = new Pokemon(CHARMANDER, 5);
    expect(dropIn({ party: [starter], secured: [starter], partner: starter }).driven.partner?.pokemon).toBe(starter);
  });

  it('changes over the moment the lead faints, and goes when nobody is left to walk', () => {
    const lead = new Pokemon(BULBASAUR, 5);
    const second = new Pokemon(CHARMANDER, 5);
    const { scene, driven } = dropIn({ party: [lead, second] });

    lead.takeDamage(lead.maxHp);
    scene.update(0, 16);
    expect(driven.partner?.pokemon).toBe(second);

    second.takeDamage(second.maxHp);
    scene.update(0, 16);
    expect(driven.partner).toBeNull();
  });

  it('follows a party put in a new order', () => {
    const lead = new Pokemon(BULBASAUR, 5);
    const second = new Pokemon(CHARMANDER, 5);
    const { scene, driven } = dropIn({ party: [lead, second] });

    driven.party.movePokemon(1, 0);
    scene.update(0, 16);

    expect(driven.partner?.pokemon).toBe(second);
  });
});

describe('walking with it', () => {
  it('steps onto the tile the player has just left', () => {
    const { scene, driven, controls } = dropIn({ party: [new Pokemon(BULBASAUR, 5)] });
    const from = { ...driven.currentTile };

    walk(scene, controls, openDirection(driven));

    expect(driven.partner?.place).toMatchObject({ tile: from, out: true });
  });

  it('is never collision: its tile stays open, and walking back into it is a swap', () => {
    const { scene, driven, controls } = dropIn({ party: [new Pokemon(BULBASAUR, 5)] });
    const start = { ...driven.currentTile };
    const away = openDirection(driven);
    walk(scene, controls, away);

    expect(driven.isBlocked(driven.partner!.place.tile)).toBe(false);
    walk(scene, controls, OPPOSITE[away]);

    expect(driven.currentTile).toEqual(start);
    expect(driven.partner?.place.tile).toEqual(neighbour(start, away));
  });

  it('costs the raid clock nothing: the same walk takes the same time with company and without', () => {
    const walkOut = (party: readonly Pokemon[]) => {
      const raid = dropIn({ party });
      const away = openDirection(raid.driven);
      // There and back twice: the second step of each pair walks into the follower.
      for (const direction of [away, OPPOSITE[away], away, OPPOSITE[away]]) {
        walk(raid.scene, raid.controls, direction);
      }
      return { tile: raid.driven.currentTile, remainingMs: raid.manager.snapshot().remainingMs };
    };

    const withCompany = walkOut([new Pokemon(BULBASAUR, 5)]);
    const alone = walkOut([new Pokemon(PIDGEY, 5)]);

    expect(withCompany).toEqual(alone);
  });

  it('gets out of the way of anybody who steps onto its tile, and comes out again behind the player', () => {
    const { scene, driven, controls } = dropIn({ party: [new Pokemon(BULBASAUR, 5)] });
    const taken = { ...driven.partner!.place.tile };
    const onTaken = (tile: GridPosition): boolean => tile.x === taken.x && tile.y === taken.y;
    // Somebody - a townsperson keeping their beat, the hunter - stands on it.
    const open = driven.isBlocked.bind(driven);
    const standing = vi.spyOn(driven, 'isBlocked').mockImplementation((tile) => onTaken(tile) || open(tile));

    for (let frame = 0; frame < 20; frame += 1) {
      scene.update(0, 16);
    }
    expect(driven.partner?.place.out).toBe(false);

    standing.mockRestore();
    const from = { ...driven.currentTile };
    const away = (['right', 'left', 'up', 'down'] as const).find(
      (one) => !driven.isBlocked(neighbour(from, one)) && !onTaken(neighbour(from, one)),
    )!;
    walk(scene, controls, away);
    expect(driven.partner?.place).toMatchObject({ tile: from, out: true });
  });

  it('is standing beside the player on the way back from a fight, not fading in', () => {
    const lead = new Pokemon(BULBASAUR, 5);
    const { scene, driven } = dropIn({ party: [lead] });
    const at = { ...driven.currentTile };

    scene.create({
      party: driven.party,
      bag: new Bag({ potion: 1 }),
      runSession: driven.runSession,
      returnLocation: { mapId: driven.runSession.plan!.insertion.mapId, position: at, facing: 'down' },
    });

    expect(driven.partner?.pokemon).toBe(lead);
    expect(driven.partner?.place.out).toBe(true);
    expect(driven.partner?.appearing).toBe(false);
  });
});

describe('a ledge', () => {
  it('takes the partner over with the player, tucked in, and out again on the next step', () => {
    const ledge = ledgesForMap('viridian-forest')[0];
    const { scene, driven, controls } = dropIn({
      party: [new Pokemon(BULBASAUR, 5)],
      insertion: 'viridian-forest',
    });
    const brow = ledge.brow.find((tile) => !driven.isBlocked(tile))!;
    driven.currentTile = { ...brow };
    driven.facing = ledge.drop;
    driven.standPartnerBesidePlayer();
    expect(driven.partner?.place.out).toBe(true);

    walk(scene, controls, ledge.drop);
    const landing = { ...driven.currentTile };
    expect(landing).not.toEqual(brow);
    for (let frame = 0; frame < 20; frame += 1) {
      scene.update(0, 16);
    }
    expect(driven.partner?.place.out).toBe(false);

    walk(scene, controls, openDirection(driven));
    expect(driven.currentTile).not.toEqual(landing);
    expect(driven.partner?.place).toMatchObject({ tile: landing, out: true });
  });
});
