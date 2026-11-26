import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag, ITEM_DEFINITIONS, MATERIAL_IDS } from '../items';
import { itemIconName } from '../ui/icons';
import {
  BULBASAUR,
  CHARMANDER,
  PIDGEY,
  Pokemon,
  PokemonParty,
  SQUIRTLE,
  experienceForLevel,
} from '../pokemon';
import { FIRST_CONTRACT_ID, RAID_CONTRACTS, standingBoard, type RaidContract } from '../objectives';
import { activeRunManager, RunPhase } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import { flowForGame, type ArenaKit } from '../base/arenaKit';
import type { RestoredGame } from '../save/SaveManager';
import { raidHeartbeat } from '../run/raidInFlight';
import { availableInsertionIds, frontDoorFor, requireInsertion, RUN_INSERTIONS } from '../run/runGeneration';
import { jobsForMap, noJobChoice, QUICKER_LANDING_MS, standingJobWalk } from '../objectives/standingBoard';
import { formatRecoveryClock, healDayOf } from '../hub/recovery';
import { STEP_DURATION_MS } from '../movement/stepClock';
import type { ActiveRunSession } from '../run/RunSession';
import { createStartingStash, Stash, type StashedPokemon } from '../stash';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import {
  MAX_PENDING_RECOVERY_MS,
  raidClockAfterRecovery,
  recoveryCostMs,
  recoveryPrices,
  type DeploymentFlow,
} from '../hub';
import {
  DEFAULT_RAID_PROGRESS,
  SAVE_KEY,
  SaveManager,
  type RaidProgress,
  type StorageLike,
} from '../save/SaveManager';
import { PIXEL_STATUS_SELECTOR } from '../ui/pixelUi';
import { planOwnFrame } from '../ui/mapPicture';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from '../display/stage';
import { SCROLL_ROWS } from '../ui/MenuOverlay';
import { extractionPointsOn } from '../world/extractionPoints';
import { gatesForMap } from '../world/gates';
import { encodeSurvey } from '../world/survey';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { PUBLISHED_FIXTURE_MAP_ID } from '../world/publishedMapFixture.testkit';
import { setActiveSaveSlot } from '../dev/playtestMode';
import { HubScene, RELEASE_ARMING_MS, RIM_REFUSED_TITLE, roomKeptFor, STALE_SAVE_REFUSAL, type HubSceneData, wildlifeKinds } from './HubScene';

describe('the lobby as a screen of the game', () => {
  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /** Every lobby screen, on a save worn enough to show its treatment surfaces. */
  function everyScreen(): readonly string[] {
    const { hub } = createWornHub();
    const screens = [markupOf(hub)];
    hub.setView('stash');
    screens.push(markupOf(hub));
    hub.setView('reselect');
    screens.push(markupOf(hub));
    intoTheArena(hub);
    hub.flow.togglePokemon('charmander-1');
    hub.flow.adjustItem('potion', 1);
    screens.push(markupOf(hub));
    hub.setView('rack');
    screens.push(markupOf(hub));
    hub.setView('locker');
    screens.push(markupOf(hub));
    hub.setView('rim');
    readyToDeploy(hub);
    screens.push(markupOf(hub));
    // The wall map in Oak's Lab, at a glance and close up.
    hub.setView('wallmap');
    screens.push(markupOf(hub));
    hub.wallMapInspect = 'route-1';
    screens.push(markupOf(hub));
    return screens;
  }

  it('types nothing the typeface cannot draw', () => {
    // Orange Kid has no arrows and no tick. A glyph it lacks is drawn in the
    // browser's fallback face, which is a second typeface in one picture - so
    // the cursor and the tick are drawn, and no screen may type one.
    for (const screen of everyScreen()) {
      expect(screen).not.toMatch(/[\u2190-\u21ff\u2713\u2714\u25b6\u25c0\u25b8\u25c2]/u);
    }
  });

  it('builds every screen from the shared frame: title bar, body, help bar', () => {
    for (const screen of everyScreen()) {
      expect(screen).toContain('class="px-screen"');
      expect(screen).toContain('class="px-title"');
      expect(screen).toMatch(/class="px-help[ "]/);
      // And every one names its keys on the line that never goes (the navigation audit).
      expect(screen).toMatch(/<span class="px-keys" data-keys>[^<]+</);
      // The modern-web vocabulary it replaced, which the raid's own screens still use.
      expect(screen).not.toMatch(/class="[^"]*(?<![\w-])(panel|entity-row|button|menu-shell)(?![\w-])/);
    }
  });

  it('leaves the lab no screen: the board is read in the room, and preparation packs nobody', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      completedContracts: [FIRST_CONTRACT_ID],
    });
    intoTheArena(hub);

    // The hall's marshal opens the loadout, with nobody packed for you.
    expect(hub.flow.step).toBe('loadout');
    expect(hub.flow.party).toEqual([]);
  });

  it('counts one kind of supply in the stash as one kind, not "1 kinds"', () => {
    const { hub } = createHub();
    const kinds = Object.entries(hub.stash.listItems()).filter(([, count]) => count > 0);
    for (const [itemId, count] of kinds.slice(1)) {
      hub.stash.removeItem(itemId, count);
    }

    hub.setView('stash');
    const stash = markupOf(hub);
    expect(stash).toContain('<small>1 kind</small>');
    expect(stash).not.toContain('1 kinds');
  });

  it('says at base that a TM or a stone is used from the pack in a raid (playtest 47)', () => {
    const { hub } = createHub();
    hub.stash.addItem('tm40-aerial-ace', 1);
    hub.stash.addItem('fire-stone', 1);

    hub.setView('stash');
    const stash = markupOf(hub);
    const helpOf = (markup: string, attribute: string, id: string): string =>
      new RegExp(`${attribute}="${id}"[^>]*data-help="([^"]*)"`).exec(markup)?.[1] ?? '';
    expect(helpOf(stash, 'data-supply', 'tm40-aerial-ace')).toContain('read it from your pack (B) in a raid');
    expect(helpOf(stash, 'data-supply', 'fire-stone')).toContain('use it from your pack (B) in a raid');
    // A Potion is used at base too, so it carries no such line.
    expect(helpOf(stash, 'data-supply', 'potion')).not.toContain('in a raid');
  });

  it('prices each hurt Pokémon on its own row of the boxes, with no bill along the foot of them', () => {
    const { hub } = createWornHub();

    hub.setView('stash');
    const stash = markupOf(hub);
    // Everyone at once is Nurse Joy's, at her counter (`hub/centerCounter.ts`).
    expect(stash).not.toContain('recovery-panel');
    expect(stash).not.toContain('data-recover-all');
    expect(stash).toContain('data-recover="charmander-1"');
  });

  it('offers only the boxes that have room while a Pokemon is picked up, and puts it down', () => {
    const { hub } = createHub();
    hub.setView('stash');
    hub.stash.addBox();

    hub.pickUp('charmander-1');
    const moving = markupOf(hub);
    expect(moving).toContain('Put Charmander in');
    expect(moving).toContain('data-box-drop="1"');

    hub.putDown('1');
    expect(hub.stash.boxIndexOf('charmander-1')).toBe(1);
    expect(markupOf(hub)).not.toContain('Put Charmander in');
  });

  it('keeps a fit save free of the Pokemon Center entirely', () => {
    const { hub } = createHub();

    hub.setView('stash');

    expect(markupOf(hub)).not.toContain('recovery-panel');
  });

});

interface WorldSceneData {
  readonly party: PokemonParty;
  readonly bag: Bag;
  readonly runSession: ActiveRunSession;
}

interface HubInternals {
  init(data?: HubSceneData): void;
  setView(view: 'stash' | 'summary' | 'bench' | 'rack' | 'locker' | 'rim' | 'reselect' | 'workshop' | 'trader' | 'wallmap'): void;
  goBack(): void;
  wallMapInspect: string | undefined;
  startRun(): void;
  render(): void;
  recover(ids: readonly string[]): void;
  treat(pokemonId: string, itemId: string): void;
  pickUp(pokemonId: string): void;
  putDown(destination: string): void;
  stepBox(direction: number): void;
  readonly flow: DeploymentFlow;
  readonly stash: Stash;
  readonly raidClockMs: number;
  readonly pendingRecoveryMs: number;
}

/** Preparation as the Raid Arena's door opens it: a fresh loadout. */
function intoTheArena(hub: HubInternals): void {
  hub.flow.restart();
  hub.setView('bench');
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

/**
 * A survey of one map that has walked onto the named ways out and doors and
 * nowhere else, which is what the drop-in screen and the wall map name them by.
 */
function walkedOnto(mapId: WorldMapId, labels: readonly string[]): RaidProgress['surveyed'] {
  const map = getWorldMap(mapId);
  const tiles = [
    ...extractionPointsOn(mapId).filter((point) => labels.includes(point.label)).map((point) => point.position),
    ...gatesForMap(mapId).filter((gate) => labels.includes(gate.label)).flatMap((gate) => gate.tiles),
  ];
  return { [mapId]: encodeSurvey(map.width, new Set(tiles.map((tile) => tile.y * map.width + tile.x))) };
}

function createHub(
  raidProgress: RaidProgress = DEFAULT_RAID_PROGRESS,
  storage: StorageLike | null = null,
): { hub: HubInternals; start: ReturnType<typeof vi.fn> } {
  const stash = createStartingStash();
  stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
  const start = vi.fn<(scene: string, data: WorldSceneData) => void>();
  const fadeCallbacks: (() => void)[] = [];
  const hub = Object.create(HubScene.prototype) as HubInternals;

  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        once: (_event: string, callback: () => void) => fadeCallbacks.push(callback),
      },
    },
    scene: { start },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn() },
    overlay: {
      root: {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      focus: vi.fn(),
      refocus: vi.fn(),
      redraw(markup: string) {
        this.root.innerHTML = markup;
      },
    },
  });
  hub.init({
    savedGame: {
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      items: [],
      bag: new Bag(),
      stash,
      raidProgress,
      starterSpeciesId: 'bulbasaur',
      pendingRecoveryMs: 0,
      wardTreatmentsUsed: 0,
      // Today's free heal already taken, so a heal is charged as every other is.
      freeHealDay: healDayOf(new Date()),
      traderRationUsed: 0,
      traderBerthPaid: false,
    },
  });
  return {
    hub,
    start: Object.assign(start, {
      flushFade: () => fadeCallbacks.splice(0).forEach((callback) => callback()),
    }),
  };
}

function statusOf(hub: HubInternals): string {
  return (hub as unknown as { status: string }).status;
}

/** Looks the plan over from the rim, which is the only place a raid can start from. */
function readyToDeploy(hub: HubInternals): void {
  hub.flow.advance();
}

function deploy(hub: HubInternals, start: ReturnType<typeof vi.fn>): void {
  hub.startRun();
  (start as unknown as { flushFade(): void }).flushFade();
}

/** A hub whose stored save holds one worn-down Pokemon, as a raid leaves it. */
function createWornHub(damage = (maxHp: number) => maxHp - 3, freeHealTaken = true): {
  hub: HubInternals;
  start: ReturnType<typeof vi.fn>;
  storage: MemoryStorage;
  worn: StashedPokemon;
} {
  const storage = new MemoryStorage();
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 7);
  charmander.takeDamage(damage(charmander.maxHp));
  stash.addPokemon(charmander, 'charmander-1');
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    ...(freeHealTaken ? { freeHealDay: healDayOf(new Date()) } : {}),
  });
  const { hub, start } = createHub(DEFAULT_RAID_PROGRESS, storage);
  const worn = hub.stash.listPokemon().find((stored) => stored.id === 'charmander-1')!;
  return { hub, start, storage, worn };
}

describe('a panel over the hall', () => {
  /** The hall as a panel knows it: what it was handed, and what it asked for. */
  function hallKit(game: RestoredGame) {
    const calls: string[] = [];
    let world: WorldSceneData | undefined;
    const kit: ArenaKit = {
      game,
      flow: flowForGame(game),
      close: () => calls.push('close'),
      dress: () => calls.push('dress'),
      jump: (data) => {
        world = data as WorldSceneData;
        calls.push('jump');
      },
      aim: (id) => calls.push(`aim:${id}`),
    };
    return { kit, calls, world: () => world };
  }

  function panelOn(view: 'rim') {
    const { hub, start } = createHub();
    const game = (hub as unknown as { savedGame: RestoredGame }).savedGame;
    const held = hallKit(game);
    hub.init({ view, kit: held.kit });
    return { hub, start, ...held };
  }

  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  it('carries on with what the hall is holding, and leaves back into the hall', () => {
    const { hub, kit, calls, start } = panelOn('rim');
    expect(hub.flow).toBe(kit.flow);
    hub.flow.togglePokemon('charmander-1');
    hub.goBack();
    expect(calls).toEqual(['close']);
    expect(start).not.toHaveBeenCalled();
    // What was chosen on one panel is still chosen on the next.
    expect(kit.flow.includesPokemon('charmander-1')).toBe(true);
  });

  it('looks the plan over from the rim, and hands the raid to the hall to jump into', () => {
    const { hub, kit, calls, world, start } = panelOn('rim');
    kit.flow.togglePokemon('charmander-1');
    hub.init({ view: 'rim', kit });
    expect(hub.flow.step).toBe('confirm');
    hub.startRun();
    expect(calls).toEqual(['jump']);
    expect(start).not.toHaveBeenCalled();
    expect(world()?.party.pokemon.map((pokemon) => pokemon.base.id)).toEqual(['charmander']);
  });

  it('comes home to the same bench: home, SPACE and ENTER are all going again asks', () => {
    const { hub, kit } = panelOn('rim');
    kit.flow.togglePokemon('charmander-1');
    hub.init({ view: 'rim', kit });
    const remembered = vi.spyOn(SaveManager.prototype, 'recordBench');
    hub.startRun();
    expect(remembered).toHaveBeenCalledWith(['charmander-1']);
    remembered.mockRestore();
    const home = { ...kit.game, raidProgress: { ...kit.game.raidProgress, lastBench: ['charmander-1'] } };
    expect(flowForGame(home).party.map(({ id }) => id)).toEqual(['charmander-1']);
  });

  it('will not jump with nobody on the bench, and says so', () => {
    const { hub, kit, calls } = panelOn('rim');
    expect(hub.flow.step).toBe('loadout');
    const markup = (hub as unknown as { content(): string }).content();
    expect(markup).toContain('Nobody is on the bench');
    hub.startRun();
    expect(calls).toEqual([]);
    expect(statusOf(hub)).toBe('Nobody is on the bench. Choose at least one Pokémon to take into the raid.');
    expect(kit.flow.party).toEqual([]);
  });

  // Break-it test, 23 Nov 2026: a second tab's card offered JUMP IN as usual
  // while the first tab's raid went on, and said why not only on the press.
  it('heads the card with a raid another window is playing, and leaves JUMP IN to ask the browser', () => {
    const { hub, kit } = panelOn('rim');
    kit.flow.togglePokemon('charmander-1');
    hub.init({ view: 'rim', kit });
    const internals = hub as unknown as { saveManager: SaveManager; content(): string };
    const stored = internals.saveManager.load.bind(internals.saveManager);
    const load = vi
      .spyOn(internals.saveManager, 'load')
      .mockImplementation(() => ({ ...stored(), raidInFlight: { id: 'raid-elsewhere' } }) as unknown as RestoredGame);
    const live = vi.spyOn(raidHeartbeat, 'liveElsewhere').mockReturnValue(true);
    try {
      const markup = internals.content();
      const head = markup.slice(0, markup.indexOf('data-rim-about'));
      expect(head).toContain('A raid is already under way in another window. Finish it there first.');
      expect(markup).not.toMatch(/data-start[^>]*aria-disabled/);
      live.mockReturnValue(false);
      expect(internals.content()).not.toContain('another window');
    } finally {
      live.mockRestore();
      load.mockRestore();
    }
  });

  // The captain, 22 Nov 2026: home from a first raid lost in seconds, JUMP IN
  // was greyed out and the reason was small print at the card's foot.
  it('heads the card with why nobody can go when the whole team has fainted', () => {
    const { hub, kit, calls } = panelOn('rim');
    kit.flow.togglePokemon('charmander-1');
    for (const { pokemon } of kit.flow.party) {
      pokemon.currentHp = 0;
    }
    hub.init({ view: 'rim', kit });
    const markup = (hub as unknown as { content(): string }).content();
    const refusal = kit.flow.notReady ?? '';
    expect(refusal).toContain('Nurse Joy');
    const head = markup.slice(0, markup.indexOf('data-rim-about'));
    expect(head).toContain(RIM_REFUSED_TITLE);
    expect(head).toContain(refusal);
    // Said once, at the top, not again in the small print.
    expect(markup).not.toContain(`<small class="px-wrap px-warning">${refusal}`);
    hub.startRun();
    expect(calls).toEqual([]);
  });

  it('is one small card: no list, nothing to scroll, no hidden count', () => {
    const { hub, kit } = panelOn('rim');
    kit.flow.togglePokemon('charmander-1');
    hub.init({ view: 'rim', kit });
    const markup = (hub as unknown as { content(): string }).content();
    expect(markup).not.toContain('px-scroll');
    expect(markup).not.toContain('px-list');
    expect(markup).not.toContain('px-row');
    expect(markup).not.toContain('px-subheading');
    expect(markup).toContain('data-start');
    expect(markup).toContain('data-cursor-start');
  });

  it('points at another way in from the LAND row: the pit swings round and nothing is committed', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      defeatedBosses: ['overlook-warden'],
      reachedInsertions: ['route-1-overlook'],
    });
    const aimed: string[] = [];
    (hub as unknown as { kit: Partial<ArenaKit> }).kit = { aim: (id) => aimed.push(id) };
    hub.setView('rim');
    hub.flow.togglePokemon('charmander-1');
    hub.flow.chooseInsertion('route-1');
    const step = (by: -1 | 1): void => (hub as unknown as { stepRimRow(row: string, by: -1 | 1): void }).stepRimRow('landing', by);
    // The LAND row goes west to east, as the pit's lights lie, so the
    // overlook is one step the way it lies from the door.
    const overlook = RUN_INSERTIONS['route-1-overlook'].position;
    const door = RUN_INSERTIONS['route-1'].position;
    step(overlook.x > door.x ? 1 : -1);
    expect(hub.flow.insertionId).toBe('route-1-overlook');
    expect(aimed).toEqual(['route-1-overlook']);
    // And back again the other way.
    step(overlook.x > door.x ? -1 : 1);
    expect(hub.flow.insertionId).toBe('route-1');
    expect(() => hub.flow.deploy()).toThrow(/confirmed loadout/);
  });
});

/** The ways in the rim will point at, in the order they are offered. */
const offeredIds = (hub: HubInternals): readonly string[] =>
  (hub as unknown as { offeredWays: readonly (readonly [string, unknown])[] }).offeredWays.map(([id]) => id);

/** What is on the screen now, drawn fresh. */
const wallMapMarkup = (hub: HubInternals): string => {
  hub.render();
  return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
};

/**
 * The whole sentence a tile or row of the rim's card stands for, as its help
 * line reads it (`hub/rimCard.ts`): the `team`, `risk`, `hunters`, `job` and
 * `clock` tiles, and the `landing`, `job` and `sky` rows.
 */
function rimSays(markup: string, part: string, kind: 'tile' | 'row' = 'tile'): string {
  const match = new RegExp(`data-rim-${kind}="${part}"[^>]*?data-help="([^"]*)"`).exec(markup);
  return (match?.[1] ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

describe('hub deployment route', () => {
  // The hub shares one process-wide run manager, so a started raid has to be
  // resolved before the next test can deploy again.
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  // AI playtest, 22 Nov 2026: a row said CENTER -1:40 and the heal took 0:50,
  // because the debt was near its cap and only the shortfall is charged.
  it("prices a bench row at what the heal then charges, the debt's cap counted", () => {
    const { hub, worn } = createWornHub((maxHp) => maxHp);
    const fullMs = recoveryCostMs(worn.pokemon);
    const pendingMs = MAX_PENDING_RECOVERY_MS - 5_000;
    expect(fullMs).toBeGreaterThan(5_000);
    (hub as unknown as { savedGame: { pendingRecoveryMs: number } }).savedGame.pendingRecoveryMs = pendingMs;
    const quoted = (hub as unknown as { recoveryPriceMs(stored: StashedPokemon): number }).recoveryPriceMs(worn);
    expect(quoted).toBe(5_000);
    hub.recover(['charmander-1']);
    expect(hub.pendingRecoveryMs - pendingMs).toBe(quoted);
  });

  it('brings a fainted Pokemon round at base and takes the cost off the next raid clock', () => {
    const { hub, start, storage, worn } = createWornHub((maxHp) => maxHp);
    const costMs = recoveryCostMs(worn.pokemon);
    expect(costMs).toBeGreaterThan(0);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS);

    hub.recover(['charmander-1']);
    // Back on its feet, it can go on the raid.
    hub.flow.togglePokemon('charmander-1');

    expect(worn.pokemon.currentHp).toBe(worn.pokemon.maxHp);
    expect(hub.pendingRecoveryMs).toBe(costMs);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS - costMs);
    // The recovery and its bill survive a reload, so neither can be scummed away.
    const reloaded = new SaveManager(storage).load();
    expect(reloaded?.pendingRecoveryMs).toBe(costMs);
    expect(reloaded?.stash.listPokemon()).toMatchObject([
      { id: 'bulbasaur-1' },
      { id: 'charmander-1', pokemon: { currentHp: worn.pokemon.maxHp } },
    ]);

    readyToDeploy(hub);
    deploy(hub, start);
    expect(hub.flow.party.map((stored) => stored.id)).toEqual(['charmander-1']);
    expect(activeRunManager.snapshot().remainingMs).toBe(
      raidClockAfterRecovery(RAID_DURATION_MS, costMs),
    );
  });

  it('never books recovery it cannot fit inside half a raid clock', () => {
    // Recovering a whole worn-out party has to stay affordable, or the player
    // goes back to hoarding a heal they never dare spend.
    expect(MAX_PENDING_RECOVERY_MS * 2).toBeLessThanOrEqual(RAID_DURATION_MS);
    // And the raid a fully-indebted player deploys into is still a raid.
    expect(raidClockAfterRecovery(RAID_DURATION_MS, MAX_PENDING_RECOVERY_MS)).toBeGreaterThan(0);
  });

  it('revives a sole Pokemon that came home fainted and lets it deploy again', () => {
    const { hub, start, worn } = createWornHub((maxHp) => maxHp);
    // A fainted Pokemon is never packed, so the row refuses it and says why.
    expect(hub.flow.togglePokemon('charmander-1')).toMatch(/fainted/);

    expect(worn.pokemon.isFainted).toBe(true);
    expect(hub.flow.isDeployable).toBe(false);
    expect(hub.flow.advance()).toMatch(/Choose at least one/);

    hub.recover(['charmander-1']);

    expect(worn.pokemon.isFainted).toBe(false);
    expect(hub.flow.togglePokemon('charmander-1')).toBeUndefined();
    expect(hub.flow.advance()).toBeUndefined();
    readyToDeploy(hub);
    deploy(hub, start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("heals free the first time each day, and remembers the day it was taken", () => {
    const { hub, storage, worn } = createWornHub((maxHp) => maxHp, false);
    hub.recover(['charmander-1']);
    expect(worn.pokemon.isFainted).toBe(false);
    expect(hub.pendingRecoveryMs).toBe(0);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS);
    expect(new SaveManager(storage).load()?.freeHealDay).toBe(healDayOf(new Date()));
  });

  it('leaves a fit party alone rather than charging for a recovery it does not need', () => {
    const { hub } = createHub();

    hub.recover(['bulbasaur-1', 'charmander-1']);

    expect(statusOf(hub)).toBe('Everyone there is already fit.');
    expect(hub.pendingRecoveryMs).toBe(0);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS);
  });

  it('opens the base screen with an empty loadout instead of a partner the player never picked', () => {
    const { hub } = createHub();

    expect(hub.flow.step).toBe('loadout');
    expect(hub.flow.party).toEqual([]);
    expect(hub.flow.isDeployable).toBe(false);
  });

  it('never deploys a Pokemon a wipe in another tab has already taken', () => {
    // Two tabs on one save: this one built a loadout around the Charmander and
    // was left on the final check, and the other lost a raid it was on.
    const storage = new MemoryStorage();
    const stash = createStartingStash();
    stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
    stash.addItem('leftovers', 1);
    stash.giveHeldItem('charmander-1', 'leftovers');
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });
    const { hub: stale, start: staleStart } = createHub(DEFAULT_RAID_PROGRESS, storage);
    stale.flow.togglePokemon('charmander-1');
    readyToDeploy(stale);
    expect(stale.flow.step).toBe('confirm');
    expect(new SaveManager(storage).applyWipeLoss(['charmander-1'], [])).toBe(true);

    deploy(stale, staleStart);

    expect(staleStart).not.toHaveBeenCalled();
    expect(activeRunManager.phase).not.toBe(RunPhase.InRun);
    expect(statusOf(stale)).toBe(STALE_SAVE_REFUSAL);
    // It caught up: the wiped Pokemon and its gear are gone from this tab too,
    // and the loadout is rebuilt against the vault as it stands.
    expect(stale.stash.listPokemon().some((stored) => stored.id === 'charmander-1')).toBe(false);
    expect(stale.stash.itemCount('leftovers')).toBe(0);
    // Bulbasaur is the vault's only Pokemon now, so it is packed by default.
    expect(stale.flow.party.map(({ id }) => id)).toEqual(['bulbasaur-1']);

    // The next deploy is made against the game as it now stands, and goes.
    readyToDeploy(stale);
    deploy(stale, staleStart);
    expect(staleStart).toHaveBeenCalledTimes(1);
  });

  it('says on the loadout when no Poké Ball is packed, once the default has been taken out', () => {
    const { hub } = createHub();
    const loadout = () => {
      hub.setView('rack');
      hub.render();
      return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
    };
    expect(hub.stash.itemCount('poke-ball')).toBeGreaterThan(0);
    hub.flow.togglePokemon('charmander-1');

    // A fresh save's default packs its Potions and a few balls, so a first raid can catch something.
    expect(hub.flow.itemQuantity('poke-ball')).toBeGreaterThan(0);
    expect(loadout()).not.toContain('you can only catch with a ball you find');
    hub.flow.setItemQuantity('poke-ball', 0);
    expect(loadout()).toContain('No Poké Balls packed, so you can only catch with a ball you find out there.');

    // Packing one is the answer, and the warning goes.
    hub.flow.adjustItem('poke-ball', 1);
    expect(loadout()).not.toContain('you can only catch with a ball you find');

    // With none at base the line says that instead, since there is nothing to add.
    hub.flow.adjustItem('poke-ball', -1);
    hub.stash.removeItem('poke-ball', hub.stash.itemCount('poke-ball'));
    expect(loadout()).toContain('No Poké Balls at base, so you can only catch with a ball you find out there.');
  });

  it('will not enter a raid until the player confirms the plan', () => {
    const { hub, start } = createHub();

    deploy(hub, start);
    expect(start).not.toHaveBeenCalled();
    expect(statusOf(hub)).toBe('Nobody is on the bench. Choose at least one Pokémon to take into the raid.');

    hub.flow.togglePokemon('charmander-1');
    deploy(hub, start);
    expect(start).not.toHaveBeenCalled();
    expect(statusOf(hub)).toBe('Look down from the rim before you jump.');

    readyToDeploy(hub);
    deploy(hub, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe('world');
  });

  it('sends a brand new save into Floodplain Relay carrying no contract: the first raid is for finding out what a raid is', () => {
    const { hub, start } = createHub();

    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('floodplain-relay');
    expect(runSession.plan?.contract).toBeUndefined();
    expect(runSession.objectives).toEqual([]);
    expect(activeRunManager.snapshot().mapId).toBe('floodplain-relay');
  });

  it('goes over the fence as soon as it opens when there is nothing on the card to decide, and draws no card', () => {
    const jump = vi.fn();
    const { hub, start } = createHub();
    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    const render = vi.spyOn(hub as unknown as { render: () => void }, 'render');
    const scene = hub as unknown as { kit: unknown; straightOver: boolean; startRun: () => void; deploying: boolean };
    scene.kit = { jump, flow: hub.flow };
    scene.straightOver = true;
    // What `create` does with it, past the overlay a test has no page for.
    (HubScene.prototype as unknown as { goOverIfThereIsNothingToRead: () => boolean }).goOverIfThereIsNothingToRead.call(hub);
    expect(jump).toHaveBeenCalledOnce();
    expect(render).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('sends a save with a raid behind it into Floodplain Relay carrying a contract that lives there', () => {
    const { hub, start } = createHub({ ...DEFAULT_RAID_PROGRESS, raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 0, wiped: 1 } } });

    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('floodplain-relay');
    expect(runSession.plan?.contract?.mapId).toBe('floodplain-relay');
    expect(runSession.objectives.map((objective) => objective.id)).toEqual([
      'recover-lost-field-kit',
    ]);
    expect(activeRunManager.snapshot().mapId).toBe('floodplain-relay');
    // The container was never opened, so the raid knows the autofill filled
    // it, and a lost raid will not call its contents the player's call.
    expect(activeRunManager.snapshot().secureFilledForYou).toBe(true);
  });

  /**
   * Night is read off the player's own clock as the raid leaves
   * (`world/nightRaids.ts`), the same reading the drop-in screen's wildlife was
   * shown in, so what the screen named is what the raid meets.
   */
  /**
   * A delivery is decided at base or not at all: the drop refuses a player who
   * arrives short, and the raid is spent by then. The drop-in pane said so and
   * the final check - the last screen before the raid - did not (playtest 47).
   */
  it('names who comes on the raid on the jump screen', () => {
    // Tester 3's release blocker 3 (22 Nov 2026): '1 Pokémon to your 1' and nothing else.
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    hub.render();
    const check = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
    expect(rimSays(check, 'team')).toMatch(/^Team: Charmander Lv \d+[^.]* comes\./);
  });

  it('says on the final check what a delivery contract is still short of', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID, 'survey-the-braid'],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    hub.flow.chooseInsertion('viridian-forest');
    hub.flow.setItemQuantity('potion', 1);
    readyToDeploy(hub);
    expect(hub.flow.step).toBe('confirm');
    hub.render();
    const check = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
    expect(check).toContain('Still short: 1 Potion');

    hub.flow.setItemQuantity('potion', 2);
    hub.render();
    expect((hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML).not.toContain(
      'Still short',
    );
  });

  it.each([
    { hour: 23, night: true, heading: 'Wildlife by night' },
    { hour: 12, night: false, heading: 'Wildlife<' },
  ])('sends a raid out at $hour:00 as a night raid: $night', ({ hour, night, heading }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, hour, 0));
    try {
      const { hub, start } = createHub();
      hub.flow.togglePokemon('charmander-1');
      hub.setView('rim');
      readyToDeploy(hub);
      hub.render();
      const rim = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
      // The rim names it, as the raid's clock chip will.
      expect(rim.includes('night raid clock 5:00')).toBe(night);
      // And Oak's wall says what is out at that hour.
      hub.setView('wallmap');
      hub.wallMapInspect = 'floodplain-relay';
      expect(wallMapMarkup(hub)).toContain(heading);
      hub.setView('rim');
      readyToDeploy(hub);
      deploy(hub, start);
      const { runSession } = start.mock.calls[0][1] as WorldSceneData;
      expect(runSession.plan?.night).toBe(night);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A raid can wait on the rim for a darker sky (`base/raidSky.ts`): THE LONG
   * SHADOW's dusk and THE LOST FOLD's night are two pieces of the treasure map,
   * and a player whose own clock never gets there could never have them (the
   * 20 Nov AI playtest, #39, #63, #95). The wait is a minute of the raid clock.
   */
  describe('waiting on the rim for a darker sky', () => {
    const rimAt = (hour: number) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 12, hour, 0));
      const made = createHub();
      made.hub.flow.togglePokemon('charmander-1');
      made.hub.setView('rim');
      readyToDeploy(made.hub);
      const rim = () => {
        made.hub.render();
        return (made.hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
      };
      return { ...made, rim, wait: (sky: string | undefined) => ((made.hub as unknown as { waitedSky: string | undefined }).waitedSky = sky) };
    };

    it.each([
      { hour: 12, offered: ['dusk', 'night'] },
      { hour: 19, offered: ['night'] },
      { hour: 23, offered: [] },
    ])('offers at $hour:00 only the skies still to come: $offered', ({ hour, offered }) => {
      try {
        const { hub, rim } = rimAt(hour);
        // The SKY row's values: now, then each sky still to come.
        expect((hub as unknown as { rimSkyChoices(): readonly (string | undefined)[] }).rimSkyChoices()).toEqual([undefined, ...offered]);
        // With nothing to wait for, its arrows are not drawn.
        expect(/class="rim-choice is-fixed" data-rim-row="sky"/.test(rim())).toBe(offered.length === 0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('sends the raid out under the sky waited for, a minute short, and says both on the rim', () => {
      try {
        const { hub, start, rim, wait } = rimAt(12);
        wait('night');
        const html = rim();
        expect(html).toContain('night: you wait on the rim for it. It costs 1:00 of the raid clock');
        expect(html).toContain('night raid clock 4:00 (5:00 base − 1:00 waiting)');
        // The SKY row says the wait, and the clock under it what it cost.
        expect(rimSays(html, 'sky', 'row')).toContain('LEFT or RIGHT to go now instead.');
        expect(html).toMatch(/<strong>Dark<\/strong><small class="rim-note rim-wide">WAIT 1:00/);
        expect(html).toContain('−1:00 WAIT');

        deploy(hub, start);
        const { runSession } = start.mock.calls[0][1] as WorldSceneData;
        expect(runSession.plan?.night).toBe(true);
        expect(runSession.plan?.conditions?.hour).toBe('night');
        expect(runSession.manager.snapshot().durationMs).toBe(4 * 60_000);
      } finally {
        vi.useRealTimers();
      }
    });

    it('waits for dusk as the moor wants it, and goes now again for nothing', () => {
      try {
        const { hub, start, rim, wait } = rimAt(12);
        wait('dusk');
        expect(rim()).toContain('dusk: you wait on the rim for it.');
        wait(undefined);
        expect(rim()).not.toContain('you wait on the rim');

        wait('dusk');
        deploy(hub, start);
        const { runSession } = start.mock.calls[0][1] as WorldSceneData;
        expect(runSession.plan?.night).toBe(false);
        expect(runSession.plan?.conditions?.hour).toBe('dusk');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  /**
   * An explorer run's clock is eight hours and its chip says PLAYTEST rather
   * than count them, so the final check says what that means: it printed
   * `night raid clock 480:00` (the owner's playtest, 2026-10-13).
   */
  it.each([
    { hour: 23, line: 'night raid with no clock to beat: an explorer run lasts 8 hours' },
    { hour: 12, line: 'raid with no clock to beat: an explorer run lasts 8 hours' },
  ])('says an explorer run at $hour:00 has no clock to beat rather than counting eight hours', ({ hour, line }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, hour, 0));
    setActiveSaveSlot('playtest');
    try {
      const { hub } = createHub();
      hub.flow.togglePokemon('charmander-1');
      hub.setView('rim');
      readyToDeploy(hub);
      expect(hub.flow.step).toBe('confirm');
      hub.render();
      const html = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
      expect(html).toContain(line);
      expect(html).not.toContain('480:00');
    } finally {
      setActiveSaveSlot('normal');
      vi.useRealTimers();
    }
  });

  it('reopens the legacy insertions only once the first contract has been banked', () => {
    const { hub, start } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      workshopUpgrades: [],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });

    hub.flow.togglePokemon('charmander-1');
    hub.flow.chooseInsertion('town-square');
    readyToDeploy(hub);
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('town-square');
    // The banked contract is not re-issued, so its reward cannot be farmed.
    expect(runSession.plan?.contract).toBeUndefined();
    expect(runSession.objectives).toEqual([]);
  });

  /**
   * A drop-in point is unlocked by standing on it, not by a contract, so it has
   * to arrive in the lobby by the same list the contract insertions do - and a
   * raid that starts from one has to be built for the doors already open, or it
   * drops the player behind a gate with the boss back on the far side of it.
   */
  it('offers a reached drop-in point and deploys it into the map as the player left it', () => {
    const { hub, start } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      defeatedBosses: ['overlook-warden'],
      reachedInsertions: ['route-1-overlook'],
    });

    hub.flow.togglePokemon('charmander-1');
    expect(offeredIds(hub)).toContain('route-1-overlook');

    hub.flow.chooseInsertion('route-1-overlook');
    readyToDeploy(hub);
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('route-1-overlook');
    expect(runSession.plan?.defeatedBosses).toEqual(['overlook-warden']);
    expect(runSession.plan?.trainers.some((trainer) => trainer.bossId === 'overlook-warden'))
      .toBe(false);
  });

  /**
   * Where to drop in is its own step. The loadout is unchanged apart from
   * losing that pane, and the raid still cannot start before the confirmation -
   * `deploymentFlow.test.ts` holds the route itself; these are what the screen
   * has to get right.
   */
  const markupOf = (hub: HubInternals): string => {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  };

  /** One map from Oak's wall, close up: where everything known of it is read. */
  const onTheWall = (hub: HubInternals, mapId: WorldMapId = 'floodplain-relay'): string => {
    hub.setView('wallmap');
    hub.wallMapInspect = mapId;
    return markupOf(hub);
  };

  it('says on Oak\'s wall what is known of a place, and counts what is not', () => {
    const { hub } = createHub();
    const markup = onTheWall(hub);
    // A map nobody has walked names none of its ways out, doors or wildlife:
    // it counts them (playtest 6, D2).
    expect(markup).not.toContain('TOLL BRIDGE');
    expect(markup).not.toContain('SOUTH GATE');
    expect(markup).toMatch(/\d+ ways out to find\./);
    expect(markup).toMatch(/\d+ doors to find\./);
    expect(markup).toContain('You have walked none of this map');
  });

  it("measures the place's facts as lines, so the fold never cuts one through", () => {
    const { hub } = createHub();

    // Each fact is a `dt` and a `dd` in a `div`, with nothing else in it for the
    // fold to find, so at 640x480 the pane's MORE strip came to rest across the
    // middle of `Doors 5 held`.
    expect(onTheWall(hub)).toMatch(/<dl class="dropin-facts"><div><dt>Wild<\/dt><dd>[^<]+<\/dd><\/div>/);
    expect(SCROLL_ROWS.split(', ')).toContain('.dropin-facts > div');
  });

  it('names the ways out and doors you have walked to, and counts the rest', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      surveyed: walkedOnto('floodplain-relay', ['TOLL BRIDGE', 'SOUTH GATE']),
    });
    const markup = onTheWall(hub);
    expect(markup).toContain('TOLL BRIDGE');
    expect(markup).toContain('held by TOLLMAN BRIGGS');
    expect(markup).toContain('SOUTH GATE');
    const exits = extractionPointsOn('floodplain-relay').length;
    const doors = gatesForMap('floodplain-relay').length;
    expect(markup).toContain(`And ${exits - 1} more to find.`);
    expect(markup).toContain(`And ${doors - 1} more to find.`);
  });

  it('says one share known, in the heading and in the facts alike', () => {
    // AI playtest of 22 Nov 2026: '9% KNOWN' over 'Known 22/204 · 6%' on one
    // screen - the facts counted walked tiles, the picture walked and lit ones.
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      surveyed: walkedOnto('floodplain-relay', ['TOLL BRIDGE', 'SOUTH GATE']),
      defeatedBosses: ['floodplain-toll-keeper'],
    });
    const markup = onTheWall(hub);
    const heading = /(\d+)% known/.exec(markup)?.[1];
    const facts = /<dt>Known<\/dt><dd>[^<]*?(\d+)%<\/dd>/.exec(markup)?.[1];
    expect(heading).toBeDefined();
    expect(facts).toBe(heading);
  });

  it('shows a door as yours once its keeper is beaten', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      defeatedBosses: ['floodplain-toll-keeper'],
    });
    const markup = onTheWall(hub);
    expect(markup).toContain('TOLL BRIDGE');
    expect(markup).not.toContain('held by TOLLMAN BRIGGS');
  });

  it('does not offer a drop-in point nobody has walked to', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });

    expect(offeredIds(hub)).toContain('route-1');
    expect(offeredIds(hub)).not.toContain('route-1-overlook');
  });

  it('re-reads the stored save, so a banked contract is not hidden by a stale start payload', () => {
    // Phaser hands a restarted scene its previous start payload, so returning
    // from a raid without one used to re-render the pre-raid snapshot.
    const storage = new MemoryStorage();
    const stored = new SaveManager(storage);
    stored.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash: createStartingStash(),
      raidProgress: {
        ...DEFAULT_RAID_PROGRESS,
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
        workshopUpgrades: [],
        defeatedBosses: [],
        reachedInsertions: [],
        standingContractsBanked: 0,
      },
    });
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, storage);

    // The save was written before Viridian City existed, and banked the first
    // contract that now unlocks it too: the loader hands it over rather than
    // leaving an old player a map short (`CONTRACT_REWARD_INSERTIONS`).
    expect((hub as unknown as { savedGame: { raidProgress: RaidProgress } }).savedGame.raidProgress)
      .toEqual({
        ...DEFAULT_RAID_PROGRESS,
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest', 'viridian-city'],
        workshopUpgrades: [],
        // Writing the save registered the starter in the vault (`hub/pokedex.ts`).
        pokedexOwned: [1],
      });
  });

  it('starts one raid however many times the key that started it is pressed', () => {
    const { hub, start } = createHub();
    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);

    // The screen keeps its cursor on `Enter the raid` for the length of the
    // fade, and the second press used to throw out of a raid already running.
    hub.startRun();
    expect(() => hub.startRun()).not.toThrow();
    (start as unknown as { flushFade(): void }).flushFade();

    expect(start).toHaveBeenCalledTimes(1);
  });

  // A raid the manager refuses to start - one left running by a maker's try
  // was how - used to be written as under way first, so the jump hung over
  // the pit and the reload settled it as abandoned and took the pack (raids
  // bug hunt, fault 1). It must write nothing, and leave the jump to be tried.
  it('writes nothing about a raid the manager refuses to start', () => {
    const { hub, start, storage } = createWornHub(() => 0);
    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
    activeRunManager.startRun({ party: [], items: [] }, { mapId: 'greystone-vale', durationMs: 1 });
    const before = new SaveManager(storage).load();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    deploy(hub, start);

    error.mockRestore();
    expect(start).not.toHaveBeenCalled();
    expect(statusOf(hub)).toBe('That raid could not be started. Nothing was taken - try the jump again.');
    const after = new SaveManager(storage).load();
    expect(after?.raidInFlight).toBeNull();
    expect(before).not.toBeNull();
    expect(after?.raidProgress.raidRecord).toEqual(before?.raidProgress.raidRecord);
    expect((hub as unknown as { deploying: boolean }).deploying).toBe(false);

    activeRunManager.abandonRun();
    deploy(hub, start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('enters the raid with exactly the party, supplies and secure slot that were confirmed', () => {
    const { hub, start } = createHub();

    hub.flow.togglePokemon('charmander-1');
    hub.flow.setItemQuantity('potion', 2);
    readyToDeploy(hub);
    deploy(hub, start);

    const data = start.mock.calls[0][1] as WorldSceneData;
    expect(data.party.pokemon.map((pokemon) => pokemon.base.id)).toEqual(['charmander']);
    expect(data.bag.toJSON()).toEqual({ potion: 2, 'poke-ball': 3 });
    expect(data.runSession.broughtPokemonIds).toEqual(['charmander-1']);
    expect(data.runSession.broughtItems).toEqual(expect.arrayContaining([{ itemId: 'potion', quantity: 2 }]));
    expect(data.runSession.stashSecureSlot).toEqual({ pokemonIds: ['charmander-1'], items: [] });
    expect(activeRunManager.snapshot().loadout?.party.map((pokemon) => pokemon.base.id)).toEqual([
      'charmander',
    ]);
  });
});

describe('the hunter a loadout draws', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  function finalCheckOf(hub: HubInternals): string {
    hub.setView('rim');
    readyToDeploy(hub);
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /**
   * The hunter mirrors the party (`world/hunter.ts`): one Pokemon for each of
   * yours, each a rung below the one it answers. So a veteran is priced in the
   * level of the one Pokemon it meets, never in a bigger team or an earlier
   * arrival, and the final check says who is coming and with what.
   */
  it('names the hunter on the final check, and matches a veteran with one Pokemon below it', () => {
    const { hub, start } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 16), 'veteran-1');
    hub.flow.togglePokemon('veteran-1');

    const finalCheck = finalCheckOf(hub);
    expect(finalCheck).toContain('data-hunter-tier="1"');
    expect(finalCheck).toContain('BLUE where you land: ');
    expect(finalCheck).toContain('1 Pokémon to your 1 · lead Lv 12 to your Lv 16 Charmander');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(0);
    expect(runSession.plan?.hunter.rivalId).toBe('blue');
  });

  it('meets a lone Lv 5 starter with one Pokemon at the floor', () => {
    const { hub, start } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 16), 'veteran-1');
    hub.flow.togglePokemon('bulbasaur-1');
    expect(hub.flow.party.map((stored) => stored.pokemon.level)).toEqual([5]);

    const finalCheck = finalCheckOf(hub);
    expect(finalCheck).toContain('1 Pokémon to your 1 · lead Lv 2 to your Lv 5 Bulbasaur');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(0);
  });

  it('sends the next hunter on the next raid, and names them before it starts', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 1, wiped: 0 } },
    });
    hub.flow.togglePokemon('bulbasaur-1');

    expect(finalCheckOf(hub)).toContain('LORELEI where you land: ');
  });
});

describe('the standing board in the lobby', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  const chainBanked = (standingContractsBanked: number): RaidProgress => ({
    ...DEFAULT_RAID_PROGRESS,
    firstContractExtracted: true,
    completedContracts: RAID_CONTRACTS.map((contract) => contract.id),
    unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    standingContractsBanked,
  });
  const markupOf = (hub: HubInternals): string => {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  };

  it.each([
    ['a raised contract', (contract: RaidContract) => contract.hunterPressure === 1],
    ['a contract with no pressure on it', (contract: RaidContract) => contract.hunterPressure === undefined],
    ['a contract on a map a player made', (contract: RaidContract) => contract.mapId === PUBLISHED_FIXTURE_MAP_ID],
  ] as const)(
    'prices %s on the final check and sends that same hunter into the raid',
    (_name, isTheOne) => {
      const progress = chainBanked(2);
      const contract = standingBoard(progress).find(isTheOne)!;
      const pressure = contract.hunterPressure;
      const tier = (pressure ?? 0) + 1;
      const insertion = frontDoorFor(contract.mapId)!;
      const { hub, start } = createHub(progress);
      hub.flow.togglePokemon('bulbasaur-1');
      hub.flow.chooseInsertion(insertion.id);
      hub.setView('rim');
      readyToDeploy(hub);

      const finalCheck = markupOf(hub);
      expect(finalCheck).toContain(`data-hunter-tier="${tier}"`);
      expect(finalCheck.includes('this job: ')).toBe(pressure !== undefined);

      deploy(hub, start);
      const { runSession } = start.mock.calls[0][1] as WorldSceneData;
      expect(runSession.plan?.contract?.id).toBe(contract.id);
      expect(runSession.plan?.hunter.teamTierOffset).toBe(tier - 1);
    },
  );

  it('says how much of the clock the job on the board is just walking (characters bug hunt, 11 Nov 2026)', () => {
    // A dispatch 900 steps long is 2:15 of a 5:00 raid, and a player used to
    // find that out only by running out of clock.
    const progress = chainBanked(2);
    const contract = standingBoard(progress)[0];
    const insertion = frontDoorFor(contract.mapId)!;
    const walk = standingJobWalk(contract, insertion.position, progress)!;
    expect(walk).toBeGreaterThan(0);
    const { hub } = createHub(progress);
    hub.flow.togglePokemon('bulbasaur-1');
    hub.flow.chooseInsertion(insertion.id);
    hub.setView('rim');

    // And what to allow: the straight walk alone is a floor, and players who
    // trusted it took two to three times as long (tester 4, 22 Nov 2026).
    expect(markupOf(hub)).toContain(
      `Walked straight with no stops, it takes ${formatRecoveryClock(walk * STEP_DURATION_MS)} of your 5:00; allow ${formatRecoveryClock(walk * STEP_DURATION_MS * 2.5)}.`,
    );
  });

  it('says in red when what to allow for the job is longer than the raid (AI playtest, 23 Nov 2026)', () => {
    // "2:45 of your 4:00; allow 6:52" was offered first and taken by a friend
    // who had not done the sum.
    const progress = chainBanked(2);
    const contract = standingBoard(progress)[0];
    const insertion = frontDoorFor(contract.mapId)!;
    const allowMs = standingJobWalk(contract, insertion.position, progress)! * STEP_DURATION_MS * 2.5;
    const { hub } = createHub(progress);
    hub.flow.togglePokemon('bulbasaur-1');
    hub.flow.chooseInsertion(insertion.id);
    hub.setView('rim');
    expect(markupOf(hub)).not.toContain('That is longer than this raid.');

    Object.defineProperty(hub, 'raidClockMs', { get: () => allowMs - 1_000 });
    hub.setView('rim');
    const markup = markupOf(hub);
    expect(markup).toContain('That is longer than this raid.');
    // The JOB row's value, and the PAYS tile, in red.
    expect(markup).toContain('class="rim-choice is-warn" data-rim-row="job"');
    expect(markup).toContain('LONGER THAN THE RAID');
  });

  /**
   * The raid's job is chosen at the rim, out of the board's and a second of
   * another kind, or turned down: LINE SURVEY was every raid's job until it
   * was banked, with no way out (AI playtest 4, 22 Nov 2026).
   */
  it.each([
    ['the second job', 1],
    ['no job', 'none'],
  ] as const)('lets the rim take %s instead, and the raid carries what was chosen', (_name, pick) => {
    const progress = chainBanked(2);
    const jobs = jobsForMap('greystone-vale', progress);
    expect(jobs).toHaveLength(2);
    const insertion = frontDoorFor('greystone-vale')!;
    const { hub, start } = createHub(progress);
    hub.flow.togglePokemon('bulbasaur-1');
    hub.flow.chooseInsertion(insertion.id);
    hub.setView('rim');
    readyToDeploy(hub);

    // The JOB row holds the board's job, the second, and none, in that order.
    const internals = hub as unknown as { rimJobChoices(id: string): readonly string[]; stepRimRow(row: string, by: -1 | 1): void };
    expect(internals.rimJobChoices(insertion.id)).toEqual([jobs[0].id, jobs[1].id, noJobChoice(jobs)]);
    expect(rimSays(markupOf(hub), 'job', 'row')).toContain(`${jobs[0].name}: `);

    // Right once is the second job, twice is none.
    internals.stepRimRow('job', 1);
    if (pick === 'none') {
      internals.stepRimRow('job', 1);
    }
    const chosen = markupOf(hub);
    if (pick === 'none') {
      expect(rimSays(chosen, 'job', 'row')).toContain('None this raid: nothing to fetch.');
      expect(chosen).toMatch(/data-rim-row="job".*?No job/);
    } else {
      expect(rimSays(chosen, 'job', 'row')).toContain(`${jobs[1].name}: `);
    }

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.contract?.id).toBe(pick === 'none' ? undefined : jobs[1].id);
  });

  /**
   * A job's stops are placed off the front door, so from a landing across the
   * map it can be most of the raid: the north bug hunt (11 Nov 2026) took a
   * survey in the west and centre of the vale from the Rest House, at its far
   * east, with nothing on the rim but the walk. Now it names the way in that
   * walks it quickest, when one on offer saves half a minute or more.
   */
  it('names a way in that walks the job much quicker than the one chosen (north bug hunt, 11 Nov 2026)', () => {
    const progress = { ...chainBanked(6), reachedInsertions: ['greystone-vale-the-dam', 'greystone-vale-farmhouse', 'greystone-vale-moor-top'] };
    const contract = standingBoard(progress).find((one) => one.mapId === 'greystone-vale')!;
    const ways = availableInsertionIds(progress)
      .map((id) => requireInsertion(id))
      .filter((way) => way.mapId === contract.mapId);
    const walks = ways.map((way) => ({ way, walk: standingJobWalk(contract, way.position, progress)! }));
    const slowest = walks.reduce((one, other) => (other.walk > one.walk ? other : one));
    const quickest = walks.reduce((one, other) => (other.walk < one.walk ? other : one));
    // The case the hunt met: one way in is a long way round, another much nearer.
    expect((slowest.walk - quickest.walk) * STEP_DURATION_MS).toBeGreaterThanOrEqual(QUICKER_LANDING_MS);
    const { hub } = createHub(progress);
    hub.flow.togglePokemon('bulbasaur-1');
    hub.flow.chooseInsertion(slowest.way.id);
    hub.setView('rim');
    expect(markupOf(hub)).toContain(
      `From ${quickest.way.label} it takes ${formatRecoveryClock(quickest.walk * STEP_DURATION_MS)}.`,
    );
    // From the quickest, nothing more is said.
    hub.flow.chooseInsertion(quickest.way.id);
    expect(markupOf(hub)).not.toMatch(/From [A-Z' ]+ it takes/);
  });
});

describe('what the base screen leads with', () => {
  /** The markup the lobby actually renders, for the view it is currently on. */
  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /** A save exactly as a new player has it: one starter, nothing lost yet. */
  function createFreshHub(): HubInternals {
    const { hub } = createHub();
    const stash = hub.stash;
    for (const stored of stash.listPokemon().slice(1)) {
      stash.removePokemon(stored.id);
    }
    return hub;
  }

  it('counts the stash in the title bar the way the boxes count it: kinds, not items', () => {
    const hub = createFreshHub();
    const kinds = ITEM_DEFINITIONS.filter((item) => hub.stash.itemCount(item.id) > 0).length;
    const units = ITEM_DEFINITIONS.reduce((sum, item) => sum + hub.stash.itemCount(item.id), 0);
    // The case that misled: a stack of several is one kind, not one item.
    expect(units).toBeGreaterThan(kinds);
    const aside = (markup: string) => /class="px-title-aside">([^<]*)</.exec(markup)?.[1];

    // A screen with no number of its own to lead with: the friend room.
    (hub as unknown as { setView(view: string): void }).setView('friend');
    expect(aside(markupOf(hub))).toBe(`1 Pokémon · ${kinds} kinds of item`);
    // The boxes' own pane says the same number in the same word.
    hub.setView('stash');
    expect(markupOf(hub)).toContain(`${kinds} kinds`);
  });

  it("says in Brock's title bar what his parts come to at base, each by its picture", () => {
    const hub = createFreshHub();
    hub.setView('workshop');
    const aside = /class="px-title-aside">([\s\S]*?)<\/div>/.exec(markupOf(hub))?.[1] ?? '';
    const parts = MATERIAL_IDS.filter((itemId) => hub.stash.itemCount(itemId) > 0);
    if (parts.length === 0) {
      expect(aside).toBe('No parts yet');
    } else {
      expect(aside.startsWith('Parts ')).toBe(true);
      for (const itemId of parts) {
        expect(aside).toContain(`${itemIconName(itemId)}.png`);
      }
    }
  });

  it('keeps the swap offer, in the stash beside the Pokémon it would trade away', () => {
    const hub = createFreshHub();
    const saved = (hub as unknown as { savedGame: { raidProgress: RaidProgress } }).savedGame;
    saved.raidProgress = {
      ...saved.raidProgress,
      raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 0, wiped: 1 } },
    };

    hub.setView('stash');
    const stash = markupOf(hub);

    expect(stash).toContain('swap-panel');
    expect(stash).toContain('Down to one Pokémon');
    expect(stash).toContain('data-view="reselect"');
  });

  it('words the swap as an option, not an alarm, before a raid has been lost (playtest 47)', () => {
    const hub = createFreshHub();

    hub.setView('stash');
    const stash = markupOf(hub);

    expect(stash).toContain('data-view="reselect"');
    expect(stash).toContain('Swap your partner');
    expect(stash).not.toContain('Down to one Pokémon');
    expect(stash).not.toContain('is all you have left');
  });

  /**
   * Oak's Lab is a room, not a lobby. The stash, the Outfitter and the
   * Ferryman are three other buildings in the yard outside
   * (`base/doors.ts`), so nothing here may navigate to one - what each of them
   * holds is said on its own door (`base/doorStatus.ts`), and the swap offer
   * with it.
   */
  /** Playtest 3, D1: home from an extraction at 1 HP with no Potions and four Poke Balls. */
  function createSpentHub(): { hub: HubInternals; storage: MemoryStorage } {
    const storage = new MemoryStorage();
    const stash = new Stash({ items: { 'poke-ball': 4 } });
    const squirtle = new Pokemon(SQUIRTLE, 5);
    squirtle.takeDamage(squirtle.maxHp - 1);
    stash.addPokemon(squirtle, 'squirtle-1');
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'squirtle',
    });
    return { hub: createHub(DEFAULT_RAID_PROGRESS, storage).hub, storage };
  }

  function swapTo(hub: HubInternals, starterId: string): void {
    const swapping = hub as unknown as { reselectStarterId: string; confirmSwap(): void };
    hub.setView('reselect');
    swapping.reselectStarterId = starterId;
    swapping.confirmSwap();
  }

  it('does not let the swap stand in for the Pokemon Center or the restock', () => {
    const { hub, storage } = createSpentHub();
    hub.setView('stash');
    // The price is the tag on the hurt Pokémon's own row.
    const priceOn = (id: string): string | undefined =>
      new RegExp(`data-recover="${id}"[^>]*>.*?px-tag-(?:risk|good)">([^<]+)<`).exec(markupOf(hub))?.[1];
    const price = priceOn('squirtle-1');
    expect(price).toBeDefined();

    swapTo(hub, 'charmander');

    const saved = new SaveManager(storage).load()!;
    expect(saved.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { base: { id: 'charmander' }, level: 5, currentHp: 1 } },
    ]);
    expect(saved.stash.listItems()).toEqual({ 'poke-ball': 4, 'raid-pack': 1 });
    expect(saved.pendingRecoveryMs).toBe(0);
    // The screen shows the same vault, and the bay still wants its price.
    expect(hub.stash.listPokemon()[0].pokemon.currentHp).toBe(1);
    expect(priceOn('charmander-1')).toBe(price);

    // Swapping back for the species you had is no way round it either.
    swapTo(hub, 'squirtle');
    expect(hub.stash.listPokemon()[0].pokemon.currentHp).toBe(1);
    expect(hub.stash.listItems()).toEqual({ 'poke-ball': 4, 'raid-pack': 1 });
  });

  it('states the condition the new partner arrives in before the swap is confirmed', () => {
    const { hub } = createSpentHub();
    const swapping = hub as unknown as { reselectStarterId: string; swapArmed: boolean };

    hub.setView('reselect');
    swapping.reselectStarterId = 'charmander';
    expect(markupOf(hub)).toContain('Level 5 · 1/18\u00a0HP');

    swapping.swapArmed = true;
    const armed = markupOf(hub);
    expect(armed).toContain('data-swap-confirm');
    expect(armed).toContain('Level 5 · 1/18\u00a0HP');
  });

  it('cannot be released by double-clicking SWAP FOR X', () => {
    // Playtest 30 4.7: the second click of a double-click landed on the armed
    // question's RELEASE button, drawn where SWAP had been.
    const { hub } = createSpentHub();
    const buttons = new Map<string, { onclick?: (event: { detail: number }) => void }>();
    const internals = hub as unknown as {
      reselectStarterId: string;
      overlay: { root: { querySelectorAll(selector: string): unknown[] }; focus: ReturnType<typeof vi.fn> };
    };
    internals.overlay.root.querySelectorAll = (selector: string) => {
      if (!selector.startsWith('[data-swap-')) return [];
      const button = buttons.get(selector) ?? {};
      buttons.set(selector, button);
      return [button];
    };
    const click = (selector: string, detail: number): void => buttons.get(selector)!.onclick!({ detail });
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    hub.setView('reselect');
    internals.reselectStarterId = 'charmander';
    hub.render();
    click('[data-swap-arm]', 1);
    // Keep stands in the seat the swap button had: last in the bar.
    expect(markupOf(hub)).toMatch(/data-swap-confirm[\s\S]*data-swap-cancel/);

    now += 120;
    click('[data-swap-confirm]', 2);
    expect(hub.stash.listPokemon()[0].pokemon.base.id).toBe('squirtle');
    expect(internals.overlay.focus).toHaveBeenLastCalledWith('[data-swap-cancel]');

    // A deliberate click, once the double-click is over, still swaps.
    now += RELEASE_ARMING_MS;
    click('[data-swap-confirm]', 1);
    expect(hub.stash.listPokemon()[0].pokemon.base.id).toBe('charmander');
    vi.restoreAllMocks();
  });

  it('lets the keyboard confirm a swap straight away', () => {
    const { hub } = createSpentHub();
    const buttons = new Map<string, { onclick?: (event: { detail: number }) => void }>();
    const internals = hub as unknown as {
      reselectStarterId: string;
      overlay: { root: { querySelectorAll(selector: string): unknown[] } };
    };
    internals.overlay.root.querySelectorAll = (selector: string) => {
      if (!selector.startsWith('[data-swap-')) return [];
      const button = buttons.get(selector) ?? {};
      buttons.set(selector, button);
      return [button];
    };
    hub.setView('reselect');
    internals.reselectStarterId = 'charmander';
    hub.render();
    buttons.get('[data-swap-arm]')!.onclick!({ detail: 0 });
    // A key's click carries no detail: reaching RELEASE from KEEP is already deliberate.
    buttons.get('[data-swap-confirm]')!.onclick!({ detail: 0 });
    expect(hub.stash.listPokemon()[0].pokemon.base.id).toBe('charmander');
  });

  it('drops the offer everywhere the moment a second Pokémon is banked', () => {
    const { hub } = createHub();

    hub.setView('stash');
    expect(markupOf(hub)).not.toContain('swap-panel');
  });

  it('lets each panel of the hall be left by the X on its title bar, with no Done button beside it', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    for (const panel of ['bench', 'rack', 'locker'] as const) {
      hub.setView(panel);
      const markup = markupOf(hub);
      expect(markup.slice(0, markup.indexOf('</header>'))).toContain('class="px-close" data-close');
      expect(markup).not.toContain('>Done<');
    }
    hub.setView('rim');
    const rim = markupOf(hub);
    expect(rim.slice(rim.indexOf('confirm-bar'))).toContain('data-start');
    expect(rim.slice(0, rim.indexOf('confirm-bar'))).not.toContain('data-start');
  });

  it('says at the rim what a wipe would take and what comes home', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.flow.setItemQuantity('potion', 3);
    hub.setView('rim');
    readyToDeploy(hub);
    const rim = markupOf(hub);
    // The pack and three Potions go; the Charmander filled the locker.
    expect(rimSays(rim, 'risk')).toMatch(/^At risk: the Raid pack, Potion/);
    expect(rimSays(rim, 'risk')).toContain('Safe: Charmander');
  });

  it('tells two of a kind apart by level on the Safe line, as the Team line does', () => {
    // 'Pidgey Lv 6 comes. Pidgey Lv 4 stays home' over 'Safe: Pidgey' said
    // neither which one the locker keeps (scenario loop, 23 Nov 2026).
    const { hub } = createHub();
    const stash = (hub as unknown as { stash: { addPokemon(pokemon: Pokemon, id: string): void } }).stash;
    stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-6');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-4');
    hub.flow.togglePokemon('pidgey-6');
    hub.setView('rim');
    readyToDeploy(hub);
    const rim = markupOf(hub);
    expect(rim).toContain('Pidgey Lv 6 comes.');
    // One of a kind keeps its bare name.
    expect(rim).toContain('Charmander and Pidgey Lv 4 stay home');
    expect(rimSays(rim, 'team')).toContain('Safe: Pidgey Lv 6.');
  });

  it('says at the rim who a wipe would lose for good, and never the partner, which is always safe', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    expect(markupOf(hub)).not.toContain('lost for good');
    hub.flow.toggleSecurePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    expect(rimSays(markupOf(hub), 'risk')).toContain('A wipe: Charmander: lost for good');
    // The partner has a place of its own beside the container (11 Nov 2026,
    // option B), so marking the Charmander as the partner moves it from the
    // losses to what is safe - the hunt's "(your partner): lost for good" is gone.
    (hub as unknown as { stash: { adoptPartner(id: string): void } }).stash.adoptPartner('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    expect(markupOf(hub)).not.toContain('lost for good');
    expect(rimSays(markupOf(hub), 'team')).toContain('Safe: Charmander (your partner)');
  });

  it('says nothing in red at the rim about a wipe when nobody can go (first-hour hunt 2, finding 3)', () => {
    const { hub } = createHub();
    for (const stored of hub.stash.listPokemon()) {
      stored.pokemon.takeDamage(stored.pokemon.maxHp);
    }
    hub.setView('rim');
    hub.render();
    const rim = markupOf(hub);
    expect(rim).toContain('Nurse Joy can revive them');
    expect(rim).not.toContain('a wipe costs you everything');
    expect(rim).not.toContain('Safe:');
  });

  it('says at the rim, with no one safe, that a wipe costs what you take rather than everything', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.flow.toggleSecurePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    expect(rimSays(markupOf(hub), 'team')).toContain('Safe: nothing: a wipe costs everything you take');
  });

  it('warns on the card of a badly hurt team, with the cursor on its first row', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    const { pokemon } = hub.flow.party[0];
    pokemon.takeDamage(pokemon.currentHp - 1);
    pokemon.primaryStatus = 'burn';
    hub.setView('rim');
    readyToDeploy(hub);
    const rim = markupOf(hub);
    expect(rimSays(rim, 'team')).toMatch(/Hurt: .* is at 1\/\d+ and burned/);
    expect(rim).toMatch(/<button data-cursor-start class="rim-choice[^"]*" data-rim-row="landing"/);
    expect(rim).not.toMatch(/data-start data-cursor-start/);
  });

  it('starts on the first row for a fit team just home from a raid, so SPACE through the result does not jump', () => {
    const { hub } = createHub();
    const savedGame = (hub as unknown as { savedGame: RestoredGame }).savedGame;
    hub.init({ view: 'rim', justHome: true, savedGame });
    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    expect(hub.flow.notReady).toBeUndefined();
    const rim = markupOf(hub);
    expect(rim).not.toContain('Hurt:');
    expect(rim).toMatch(/<button data-cursor-start class="rim-choice[^"]*" data-rim-row="landing"/);
    expect(rim).not.toMatch(/data-start data-cursor-start/);
  });

  /**
   * Presses `key` on the rim with the highlight on `on` - JUMP IN (`start`) or
   * one of the card's rows - and answers where the highlight is
   * afterwards (`HubScene.rimArrow`).
   */
  function pressOnTheRim(hub: HubInternals, on: string, key: string): string {
    const document = { activeElement: null as unknown };
    const make = (name: string) => {
      const control = {
        name,
        dataset: name === 'start' ? {} : { rimRow: name },
        hasAttribute: () => false,
        matches: () => false,
        closest: () => null,
        focus: () => {
          document.activeElement = control;
        },
      };
      return control;
    };
    const start = make('start');
    const rows = new Map(['landing', 'job', 'sky'].map((name) => [name, make(name)]));
    const root = (hub as unknown as { overlay: { root: { querySelectorAll: (selector: string) => unknown[]; querySelector: (selector: string) => unknown } } }).overlay.root;
    const saved = { all: root.querySelectorAll, one: root.querySelector };
    root.querySelectorAll = (selector) => (selector === '.rim-actions button' ? [start] : saved.all(selector));
    root.querySelector = (selector) => rows.get(/data-rim-row="(\w+)"/.exec(selector)?.[1] ?? '') ?? null;
    document.activeElement = on === 'start' ? start : rows.get(on);
    vi.stubGlobal('document', document);
    try {
      (hub as unknown as { handleKey(event: KeyboardEvent): void }).handleKey({ key, preventDefault: () => undefined } as KeyboardEvent);
    } finally {
      vi.unstubAllGlobals();
      root.querySelectorAll = saved.all;
      root.querySelector = saved.one;
    }
    return (document.activeElement as { name: string } | undefined)?.name ?? 'nothing';
  }

  // The second characters hunt of 11 Nov 2026, finding 1: a hurt team's card
  // opened away from JUMP IN, every arrow went to the map and bumped, and only
  // TAB - said nowhere - reached JUMP IN. Nothing stops the player, keyboard or not.
  it('lets a hurt team walk down the card to JUMP IN, and choose nothing on the map by it', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    const { pokemon } = hub.flow.party[0];
    pokemon.takeDamage(pokemon.currentHp - 1);
    hub.setView('rim');
    readyToDeploy(hub);
    const landing = hub.flow.insertionId;
    const last = pressOnTheRim(hub, 'start', 'ArrowUp');
    expect(last).not.toBe('start');
    expect(pressOnTheRim(hub, last, 'ArrowDown')).toBe('start');
    expect(hub.flow.insertionId).toBe(landing);
  });

  // The critic's pass on the X, 25 Nov 2026: with NOT YET gone, a click on a
  // tile left nothing focused and the next arrow fell back on JUMP IN.
  it('puts a lost highlight on a hurt team’s card back on its first row, never on JUMP IN', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    const { pokemon } = hub.flow.party[0];
    pokemon.takeDamage(pokemon.currentHp - 1);
    hub.setView('rim');
    readyToDeploy(hub);
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(pressOnTheRim(hub, 'nothing', key)).toBe('landing');
    }
  });

  it('has nothing beside JUMP IN for Left and Right to reach: the way back is the X', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    expect(pressOnTheRim(hub, 'start', 'ArrowLeft')).toBe('start');
    expect(pressOnTheRim(hub, 'start', 'ArrowRight')).toBe('start');
    expect(markupOf(hub)).not.toContain('Not yet');
    expect(markupOf(hub)).toContain('class="px-close" data-close');
  });

  // The captain, 25 Nov 2026: the same arrow moved the map's pointer on one
  // press and the buttons' highlight on the next, by where the lights lay.
  it('moves the landing only from the LAND row, whatever lies on the map', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      defeatedBosses: ['overlook-warden'],
      reachedInsertions: ['route-1-overlook'],
    });
    (hub as unknown as { kit: Partial<ArenaKit> }).kit = { aim: () => undefined };
    hub.setView('rim');
    hub.flow.togglePokemon('charmander-1');
    hub.flow.chooseInsertion('route-1');
    const toward = RUN_INSERTIONS['route-1-overlook'].position.x > RUN_INSERTIONS['route-1'].position.x ? 'ArrowRight' : 'ArrowLeft';
    const away = toward === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
    // On JUMP IN the arrows move nothing, with a landing that way or not.
    expect(pressOnTheRim(hub, 'start', away)).toBe('start');
    expect(pressOnTheRim(hub, 'start', toward)).toBe('start');
    expect(hub.flow.insertionId).toBe('route-1');
    // Up goes to the rows above; on the LAND row the same key moves the landing and keeps the highlight.
    expect(pressOnTheRim(hub, 'start', 'ArrowUp')).not.toBe('start');
    expect(pressOnTheRim(hub, 'landing', toward)).toBe('landing');
    expect(hub.flow.insertionId).toBe('route-1-overlook');
  });

  it('keeps the cursor on JUMP IN for a team that is fit', () => {
    const { hub } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);
    const rim = markupOf(hub);
    expect(rim).not.toContain('Hurt:');
    expect(rim).toMatch(/data-start data-cursor-start/);
  });
});

describe('Brock', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  interface WorkshopInternals extends HubInternals {
    armUpgrade(upgradeId: string): void;
    buildUpgrade(upgradeId: string): void;
    workshopArmed: string | undefined;
  }

  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /** A stored mid-game save: a partner, three catches, spare kit and materials, these upgrades. */
  function createWorkshopHub(workshopUpgrades: readonly string[] = []): {
    hub: WorkshopInternals;
    start: ReturnType<typeof vi.fn>;
    storage: MemoryStorage;
  } {
    const storage = new MemoryStorage();
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'pidgey-2');
    stash.addPokemon(new Pokemon(BULBASAUR, 6), 'bulbasaur-9');
    stash.addItem('poke-ball', 4);
    stash.addItem('potion', 4);
    stash.addItem('great-ball', 3);
    stash.addItem('antidote', 3);
    stash.addItem('parts-crate', 5);
    stash.addItem('mooring-rope', 1);
    stash.addItem('radio-valve', 3);
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: {
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
        workshopUpgrades: [...workshopUpgrades],
        defeatedBosses: [],
        reachedInsertions: [],
        standingContractsBanked: 0,
        giftsReceived: [],
      },
      freeHealDay: healDayOf(new Date()),
    });
    const { hub, start } = createHub(DEFAULT_RAID_PROGRESS, storage);
    return { hub: hub as WorkshopInternals, start, storage };
  }

  it('says nothing of his favour over the workshop: it is asked in the room, before the screen opens', () => {
    const { hub, storage } = createWorkshopHub();
    hub.setView('workshop');
    expect(markupOf(hub)).not.toContain('GREYSTONE PEAKS');
    expect(markupOf(hub)).not.toContain('data-speech-done');
    // Opening his screen takes nothing on: only a YES in the room does.
    expect(new SaveManager(storage).load()!.raidProgress.errands ?? []).toEqual([]);

    // Nor is a crate that came home handed over by the screen.
    const saves = new SaveManager(storage);
    const game = saves.load()!;
    game.stash.addItem('brocks-crate', 1);
    saves.save({
      ...game,
      raidProgress: { ...game.raidProgress, errands: [{ id: 'brocks-crate', status: 'started', found: 1, lossesHeard: 0 }] },
    });
    const again = createHub(DEFAULT_RAID_PROGRESS, storage).hub as WorkshopInternals;
    again.setView('workshop');
    expect(markupOf(again)).not.toContain('You handed over');
    expect(new SaveManager(storage).load()!.stash.itemCount('brocks-crate')).toBe(1);
  });

  it('is its own building, walked into rather than chosen off the lab screen', () => {
    const { hub } = createWorkshopHub();

    expect(markupOf(hub)).not.toContain('data-view="workshop"');
    hub.setView('workshop');
    expect(markupOf(hub)).toContain('Secure locker I');
  });

  it('lists every rung with its price in materials, and marks what this vault cannot pay yet', () => {
    const { hub } = createWorkshopHub();

    hub.setView('workshop');
    const ladder = markupOf(hub);
    expect(ladder).toContain('Secure locker I');
    // The price is on the rung's card, one part a salvage's icon and its count,
    // and it is materials and nothing else (playtest 42, option A).
    const lockerOne = ladder.slice(ladder.indexOf('data-outfit="secure-locker-1"'), ladder.indexOf('data-outfit="secure-locker-2"'));
    expect(lockerOne).toMatch(/<span class="workshop-cost"><span class="item-icon"><img src="[^"]*parts-crate\.png"[^]*?<small>×4<\/small>/);
    expect(ladder).not.toContain('Pokémon</small>');
    // A part the base cannot pay is crossed and grey, on whichever card asks it.
    expect(ladder).toMatch(/<span class="workshop-cost is-short"><span class="cost-mark" aria-hidden="true"><\/span><span class="item-icon"><img src="[^"]*\.png"[^]*?<small>×\d+<\/small>/);
    // The second locker waits on the first, and its card says so with a lock
    // where its price would be: its price is in the card on the right.
    const lockerTwo = ladder.slice(ladder.indexOf('data-outfit="secure-locker-2"'));
    const lockerTwoCard = lockerTwo.slice(0, lockerTwo.indexOf('</button>'));
    expect(lockerTwoCard).toContain('aria-label="After Secure locker I"');
    expect(lockerTwoCard).toMatch(/padlock\.png[^]*?Locker I<\/span>/);
    // Short is a drawn cross on the tag as well as grey, never colour alone
    // (playtest 40 #4), so the row needs no legend strip over it.
    expect(ladder).not.toContain('Red is not yet spare');
    expect(ladder).toMatch(/class="workshop-cost is-short"><span class="cost-mark" aria-hidden="true"><\/span>/);
    // A rung that cannot be built is still a control, so the cursor can reach it
    // and the pane under the list can say what it does.
    expect(ladder).toMatch(/data-outfit="secure-locker-1"(?![^>]*aria-disabled)[^>]* data-shows/);
    expect(ladder).toMatch(/data-outfit="secure-locker-2" aria-disabled="true"/);
    expect(ladder).not.toMatch(/<button[^>]* disabled/);
    expect(ladder).toContain('data-shown-by="secure-locker-2"');
  });

  /**
   * The fault this screen was rebuilt for. A rung's own line used to be its
   * price until it was built and its effect afterwards, so the one moment a
   * player needed to know what a thing did - deciding whether to buy it - was
   * the moment it was hidden, and the screen explained the purchase only once
   * the money was gone.
   */
  it('says what every rung does, bought or not, and never in place of its price', () => {
    const { hub } = createWorkshopHub(['secure-locker-1']);

    hub.setView('workshop');
    const ladder = markupOf(hub);
    const rowOf = (id: string): string =>
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g
        .exec(ladder.slice(ladder.indexOf(`data-shows="${id}"`) - 400))![0];

    // Unbought: the card says what it does, and the price is under it.
    const unbought = rowOf('quarantine-ward');
    expect(unbought).toContain('Three revives per raid, free of clock.');
    expect(unbought).toContain('<span class="workshop-costs">');
    // Built: the same line, still there, gold and tagged BUILT, and what it
    // cost with nothing marked short.
    const built = rowOf('secure-locker-1');
    expect(built).toContain('One more column of THE LOCKER.');
    expect(built).toContain('workshop-card is-built');
    expect(built).toContain('>Built<');
    expect(built).not.toContain('is-short');
  });

  it('prices the pointed-at build against what this base actually holds, as part tags', () => {
    const { hub } = createWorkshopHub();

    hub.setView('workshop');
    const ladder = markupOf(hub);
    const paneOf = (id: string): string => {
      // The card on the right, not the gold ring over the room, which answers to the same id.
      const from = ladder.slice(ladder.indexOf(`shop-card" data-shown-by="${id}"`));
      return from.slice(0, from.indexOf('shop-card" data-shown-by=', 1));
    };

    // Four parts crates asked, five spare: a green tag, and ALL HERE.
    const lockerOne = paneOf('secure-locker-1');
    expect(lockerOne).toMatch(/<span class="part-tag"><span class="item-icon"><img src="[^"]*parts-crate\.png"[^]*?<small>×4<\/small>/);
    expect(lockerOne).toContain('All here');
    expect(lockerOne).toContain('Build it');
    // What it does in a raid, as a picture of THE LOCKER's squares.
    expect(lockerOne).toContain('In a raid');
    expect(lockerOne).toContain('ws-squares');
    // The second waits on the first, and says so by name with a lock.
    expect(paneOf('secure-locker-2')).toContain('After Secure locker I');
    expect(paneOf('secure-locker-2')).not.toContain('Build it');
  });

  it('shows what a build still needs as grey tags, and offers no key to build it', () => {
    const { hub } = createWorkshopHub();

    hub.setView('workshop');
    const markup = markupOf(hub);
    const from = markup.slice(markup.indexOf('shop-card" data-shown-by="beacon"'));
    const pane = from.slice(0, from.indexOf('shop-card" data-shown-by=', 1));

    // No lamp oil and no cable at all: both crossed and grey, and the head says SHORT.
    expect(pane).toMatch(/<span class="part-tag is-short"><span class="cost-mark" aria-hidden="true"><\/span><span class="item-icon"><img src="[^"]*lamp-oil\.png"[^]*?<small>×4<\/small>/);
    expect(pane).toMatch(/<span class="part-tag is-short">[^]*?cable-coil\.png[^]*?<small>×3<\/small>/);
    expect(pane).toContain('<span>Short</span>');
    expect(pane).not.toContain('All here');
    expect(pane).not.toContain('Build it');
  });

  it('names the materials it is spending, and asks before it spends them', () => {
    const { hub, storage } = createWorkshopHub();
    hub.setView('workshop');
    // Walking in is when Brock asks his favour, which is a write of its own.
    (hub as unknown as { render(): void }).render();
    const before = storage.getItem(SAVE_KEY);
    hub.armUpgrade('secure-locker-1');
    const armed = markupOf(hub);
    // The row becomes the question, as Bill's barters do, with the cursor on
    // the answer that changes nothing and on no other row.
    expect(hub.workshopArmed).toBe('secure-locker-1');
    expect(armed).toContain('Spend 4 Parts crates on it for good?');
    expect(armed).toContain('data-outfit-confirm="secure-locker-1"');
    expect(armed).toMatch(/data-deal-cancel data-cursor-start[^>]*>Not now</);
    expect(armed.match(/data-cursor-start/g)).toHaveLength(1);
    // Nothing about a Pokemon is asked or named.
    expect(armed).not.toContain('release');
    // Arming spends nothing.
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });

  it('puts the question down, not the screen, when backed out of', () => {
    const { hub, storage } = createWorkshopHub();
    hub.setView('workshop');
    (hub as unknown as { render(): void }).render();
    const before = storage.getItem(SAVE_KEY);
    hub.armUpgrade('radio-mast');

    hub.goBack();

    expect((hub as unknown as { view: string }).view).toBe('workshop');
    expect(hub.workshopArmed).toBeUndefined();
    expect(markupOf(hub)).not.toContain('data-outfit-confirm');
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });

  it('builds the locker out of materials, keeps every Pokémon, and protects a wider container from then on', () => {
    const { hub, storage } = createWorkshopHub();
    expect(hub.flow.secureGrid).toEqual({ width: 2, height: 2 });

    hub.setView('workshop');
    hub.armUpgrade('secure-locker-1');
    hub.buildUpgrade('secure-locker-1');

    expect(statusOf(hub)).toBe('Secure locker I built.');
    expect(hub.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'pidgey-1', 'pidgey-2', 'bulbasaur-9']);
    expect(hub.stash.itemCount('parts-crate')).toBe(1);
    expect(hub.stash.itemCount('poke-ball')).toBe(9);
    expect(hub.stash.itemCount('potion')).toBe(7);
    expect(hub.flow.secureGrid).toEqual({ width: 3, height: 2 });
    expect(markupOf(hub)).toMatch(/data-built="secure-locker-1"[\s\S]*?has-tick">Built</);
    // The upgrade is in storage, not just on screen.
    expect(new SaveManager(storage).load()?.raidProgress.workshopUpgrades).toEqual(['secure-locker-1']);
  });

  it('builds for a player down to one Pokémon, which is the player who used to get nothing', () => {
    const { hub } = createWorkshopHub();
    for (const stored of hub.stash.listPokemon().slice(1)) {
      hub.stash.removePokemon(stored.id);
    }
    (hub as unknown as { saveManager: SaveManager }).saveManager.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash: hub.stash,
      starterSpeciesId: 'charmander',
      raidProgress: (hub as unknown as { savedGame: { raidProgress: RaidProgress } }).savedGame.raidProgress,
    });

    hub.setView('workshop');
    hub.armUpgrade('radio-mast');
    hub.buildUpgrade('radio-mast');

    expect(statusOf(hub)).toBe('Radio mast built.');
    expect(hub.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1']);
  });

  it('offers a base with no materials nothing to build', () => {
    const { hub } = createHub();
    const workshop = hub as WorkshopInternals;

    hub.setView('workshop');
    expect(markupOf(hub)).not.toMatch(/data-outfit="[a-z0-9-]+"(?! aria-disabled="true")/);

    // Choosing a rung that cannot be paid for is answered, and goes nowhere.
    workshop.armUpgrade('radio-mast');
    const refused = markupOf(hub);
    expect(refused).toContain('Radio mast still needs 3 Radio valves and 1 Mooring rope.');
    expect(refused).not.toContain('data-outfit-confirm');
  });

  it('deploys with a second protected Pokémon, the beacon and the mast once they are built', () => {
    const { hub, start } = createWorkshopHub([
      'secure-locker-1',
      'secure-locker-2',
      'beacon',
      'radio-mast',
    ]);
    hub.flow.togglePokemon('charmander-1');
    hub.flow.togglePokemon('pidgey-1');
    hub.flow.togglePokemon('pidgey-2');
    // Both lockers together are a 4x2 container, which is exactly two
    // first-stage Pokemon at four squares each - the second slot and the room
    // for it arrive on the same rung, or the slot would be unusable.
    for (const stored of [...hub.flow.securedPokemon]) {
      hub.flow.toggleSecurePokemon(stored.id);
    }
    // The Charmander is the partner, in its own place, so both slots go to
    // the Pidgey and the partner takes none of the eight squares.
    hub.flow.toggleSecurePokemon('pidgey-1');
    hub.flow.toggleSecurePokemon('pidgey-2');
    expect(hub.flow.secureCells).toEqual({ used: 8, total: 8 });
    expect(hub.flow.partnerOnRaid?.pokemon.base.id).toBe('charmander');
    hub.setView('rim');
    readyToDeploy(hub);

    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.stashSecureSlot.pokemonIds).toEqual(['pidgey-1', 'pidgey-2']);
    expect(runSession.secureSlot.pokemon).toHaveLength(2);
    expect(runSession.secureSlot.partner?.base.id).toBe('charmander');
    expect(runSession.workshopUpgrades).toContain('radio-mast');
    expect(runSession.plan?.extractionPoints.filter((point) => point.label === 'BEACON')).toMatchObject([
      { mapId: 'floodplain-relay', unlockAtMs: RAID_DURATION_MS / 2 },
    ]);
  });

  it('deploys from a base with nothing built exactly as before', () => {
    const { hub, start } = createWorkshopHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('rim');
    readyToDeploy(hub);

    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.workshopUpgrades).toEqual([]);
    expect(runSession.plan?.extractionPoints.some((point) => point.label === 'BEACON')).toBe(false);
  });

  it('quotes the bay at this base\'s prices and spends the ward\'s three beds once', () => {
    const { hub } = createWorkshopHub(['recovery-bay-1', 'quarantine-ward']);
    const everyone = hub.stash.listPokemon();
    for (const stored of everyone) stored.pokemon.takeDamage(stored.pokemon.maxHp);
    const [first, second, third, fourth] = everyone;
    const terms = { priceShare: 0.5, wardTreatments: 0 };

    // The bill is in the stash, beside the Pokémon it is for.
    hub.setView('stash');
    expect(markupOf(hub)).toContain('Ward bed: ');

    // The beds bring three round for nothing: a raid party back from a wipe.
    hub.recover([first.id]);
    hub.recover([second.id, third.id]);
    expect(hub.pendingRecoveryMs).toBe(0);

    // No bed left, so the fourth revive is charged, at the bay's discount.
    const revivePriceMs = recoveryCostMs(fourth.pokemon, terms);
    expect(revivePriceMs).toBe(recoveryPrices(0.5).reviveMs);
    hub.recover([fourth.id]);
    expect(hub.pendingRecoveryMs).toBe(revivePriceMs);
    expect(markupOf(hub)).not.toContain('Ward bed: ');
  });
});

/**
 * Playtest 3, B6d: clicking "Enter the raid" shortly after arriving on the final
 * check did nothing, and a second click worked. Reproduced in a browser: a
 * status line raised on an earlier step re-rendered the whole screen 2.2s
 * later, and a render between mousedown and mouseup replaces the button the
 * press began on, so no click is ever dispatched.
 */
describe('taking a status line down', () => {
  function hubWithRenderCount() {
    const { hub } = createHub();
    let renders = 0;
    let html = '';
    const removed = vi.fn();
    const root = {
      get innerHTML() { return html; },
      set innerHTML(value: string) { html = value; renders += 1; },
      querySelector: (selector: string) => (selector === PIXEL_STATUS_SELECTOR ? { remove: removed } : null),
      querySelectorAll: () => [],
    };
    const timers: { callback: () => void; remove: ReturnType<typeof vi.fn> }[] = [];
    Object.assign(hub as unknown as Record<string, unknown>, {
      overlay: { root, focus: vi.fn(), refocus: vi.fn(), redraw: (markup: string) => { root.innerHTML = markup; } },
      time: {
        delayedCall: (_ms: number, callback: () => void) => {
          const timer = { callback, remove: vi.fn() };
          timers.push(timer);
          return timer;
        },
      },
    });
    const internals = hub as unknown as { setStatus(message: string | undefined): void };
    return { hub, internals, timers, removed, renders: () => renders };
  }

  it('removes the line without rebuilding the buttons under the pointer', () => {
    const { hub, internals, timers, removed, renders } = hubWithRenderCount();
    internals.setStatus('The secure slot protects 1 item stacks.');
    const rendersWhileShown = renders();

    timers[0].callback();

    expect(renders()).toBe(rendersWhileShown);
    expect(removed).toHaveBeenCalledOnce();
    expect(statusOf(hub)).toBe('');
  });

  // Playtest 4: "Charmander recovered for 0:50 of raid time" was still in the
  // help bar on Brock, a screen that had said nothing.
  it('leaves a status line on the screen that raised it', () => {
    const { hub, internals, timers } = hubWithRenderCount();
    const views = hub as unknown as { setView(view: string): void };
    views.setView('stash');
    internals.setStatus('Charmander recovered for 0:50 of raid time. Next raid clock: 4:10.');

    views.setView('workshop');

    expect(statusOf(hub)).toBe('');
    expect(timers[0].remove).toHaveBeenCalledOnce();
  });

  it('keeps one timer, so an old message cannot cut a new one short', () => {
    const { internals, timers } = hubWithRenderCount();
    internals.setStatus('first');
    internals.setStatus('second');

    expect(timers).toHaveLength(2);
    expect(timers[0].remove).toHaveBeenCalledOnce();
    expect(timers[1].remove).not.toHaveBeenCalled();
  });
});

/**
 * Bill's counter, as the lobby draws it.
 *
 * The screen is held to the thing the whole design rests on: two panes, never
 * one, because a shelf priced in money and a barter table that money cannot
 * touch read as a shop the moment they are one list.
 */
describe('HubScene - Bill', () => {
  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /** A save standing high enough with him to be sold and bartered anything. */
  function createTraderHub(money = 1_000): {
    hub: HubInternals;
    storage: MemoryStorage;
    start: ReturnType<typeof vi.fn>;
  } {
    const storage = new MemoryStorage();
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    stash.addItem('money', money);
    stash.addItem('parts-crate', 4);
    stash.addItem('cable-coil', 3);
    stash.addItem('lamp-oil', 3);
    stash.addItem('mooring-rope', 2);
    stash.addItem('linen-roll', 3);
    stash.addItem('radio-valve', 3);
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: {
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID, 'survey-the-braid', 'cordon-ledger', 'wardens-resupply'],
        unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
        workshopUpgrades: [],
        defeatedBosses: ['floodplain-toll-keeper', 'floodplain-sluice-keeper', 'floodplain-orchard-warden'],
        reachedInsertions: [],
        standingContractsBanked: 2,
        giftsReceived: [],
      },
    });
    const { hub, start } = createHub(DEFAULT_RAID_PROGRESS, storage);
    return { hub, storage, start };
  }

  it('is the quay, a walk away from Brock, so the pair reads as two places', () => {
    const { hub } = createTraderHub();
    expect(markupOf(hub)).not.toContain('data-view="trader"');

    hub.setView('trader');
    const boat = markupOf(hub);
    // Money leads, because it is the one number found rather than earned and
    // the screen behind the door turns on it.
    expect(boat).toContain('₽1000');
  });

  it('keeps the shelf and the barter table apart, and says money buys none of the second', () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);

    expect(boat).toContain('For money');
    expect(boat).toContain('For parts');
    expect(boat).toContain('No money buys these');
    // The shelf prices in money, on a gold tag; the table prices in found
    // goods, each part a tag with its picture and how many.
    expect(boat).toContain('data-buy="potion"');
    expect(boat).toContain('<span class="price-tag">₽120</span>');
    expect(boat).toContain('data-barter="barter-quick-claw"');
    const quickClaw = boat.slice(boat.indexOf('data-barter="barter-quick-claw"'));
    expect(quickClaw.slice(0, quickClaw.indexOf('</button>'))).toMatch(/parts-crate\.png[^]*?<small>×2<\/small>[^]*?cable-coil\.png[^]*?<small>×1<\/small>/);
    // Nothing on the shelf is gear, at any standing.
    expect(boat).not.toContain('data-buy="quick-claw"');
    expect(boat).not.toContain('data-buy="leftovers"');
  });

  it('says what standing is and what the next tier costs, so it is never a mystery', () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);

    // His standing, by name, and how far it is to the next as a bar and a count.
    expect(boat).toMatch(/<span class="trader-rank">(Stranger|Regular|Trusted|Partner)<\/span>/);
    expect(boat).toContain('class="trader-trust-bar"');
    expect(boat).toMatch(/\d+ \/ \d+<span class="trader-trust-to"><\/span>(Regular|Trusted|Partner)/);
    // What raises it, as the three prices rather than a paragraph about them -
    // and only while there is a tier left to raise it to.
    expect(boat).toContain('Bank a job +2, beat a boss +3, spend ₽200 +1.');
  });

  it('offers a stranger Potions and Poké Balls only, and keeps every shut row reachable by the cursor', () => {
    const storage = new MemoryStorage();
    const stash = createStartingStash(CHARMANDER);
    stash.addItem('money', 5_000);
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: DEFAULT_RAID_PROGRESS,
    });
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, storage);
    hub.setView('trader');
    const boat = markupOf(hub);

    // ₽5000 buys Potions and Poké Balls and nothing else: standing is the
    // first gate to the rest, and money can never open it.
    expect([...boat.matchAll(/data-buy="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual(['poke-ball', 'potion']);
    expect(boat).toContain('Potions and Balls for now');
    // Not `disabled`: a cursor has to reach a shut row to be told why.
    expect(boat).not.toMatch(/<button[^>]* disabled/);
    expect(boat).toMatch(/aria-disabled="true"/);
  });

  it("rents a berth in the shelf, and names it against Brock's locker", () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);

    expect(boat).toContain('data-berth');
    // The price is the card's own gold tag, as every money price on the shelf
    // is; the card says THIS RAID, and its pane what the berth *does*.
    expect(boat).toContain('<span class="price-tag">₽250</span>');
    expect(boat).toContain('<span class="trader-limit">This raid</span>');
    // The one sentence that tells the two places apart, on the row itself.
    // The squares come from the grid rather than a number typed beside it.
    expect(boat).toMatch(/\+\d+ safe squares, this raid\./);
    // The comparison with the built locker is the help bar's, because on the
    // row it wrapped to three lines and ate the shelf above it.
    expect(boat).toMatch(/data-help="[^"]*Brock builds one for good/);
    expect(boat).not.toMatch(/<small[^>]*>[^<]*Brock builds one for good/);
  });

  /**
   * The same fault Brock had, and worse on the barter table: a row
   * that named only what it took said nothing about what it handed back, so
   * QUICK CLAW, FOCUS BAND and LIFE ORB were three prices and three names.
   */
  it('says what every deal hands over and what it hands back, both on the row', () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);

    // The shelf: a Potion's card is its picture, name and price; what it does
    // is the card on the right, which answers for the card the cursor is on.
    expect(boat).toContain('<strong class="px-name">Potion</strong><span class="price-tag">₽120</span>');
    const potion = boat.slice(boat.indexOf('data-shown-by="potion"'));
    expect(potion.slice(0, potion.indexOf('data-shown-by=', 1))).toContain('Restores 20 HP.');
    // The table: what the gear does, from the item's own catalogue line.
    expect(boat).toContain('Sometimes the holder strikes first, whatever the Speed says.');
    expect(boat).toContain("The holder's hits land a third harder and cost it a tenth of its own HP.");
  });

  it('prices both counters against what the vault is actually holding', () => {
    const { hub } = createTraderHub(200);
    hub.setView('trader');
    const boat = markupOf(hub);
    const paneOf = (id: string): string => {
      const from = boat.slice(boat.indexOf(`data-shown-by="${id}"`));
      return from.slice(0, from.indexOf('data-shown-by=', 1));
    };

    // ₽260 against ₽200 held: the purse line runs out, and says so in red.
    expect(paneOf('super-potion')).toMatch(/<span>₽200<\/span><span class="shop-arrow"><\/span><strong class="is-short">₽0<\/strong>/);
    // A Potion at ₽120 leaves ₽80, written as the number the purse will roll down to.
    expect(paneOf('potion')).toMatch(/<span>₽200<\/span><span class="shop-arrow"><\/span><strong class="">₽80<\/strong>/);

    // Two mooring ropes asked, two held: a green tag and ALL HERE.
    const table = paneOf('barter-hm03');
    expect(table).toMatch(/<span class="part-tag"><span class="item-icon"><img src="[^"]*mooring-rope\.png"[^]*?<small>×2<\/small>/);
    expect(table).toContain('All here');
  });

  it('names the standing a shut deal is waiting on rather than only shutting it', () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);
    const from = boat.slice(boat.indexOf('data-shown-by="barter-life-orb"'));
    const pane = from.slice(0, from.indexOf('shop-card" data-shown-by=', 1));

    // The padlock and the standing it waits for, where ALL HERE would stand -
    // never both - and the help bar has his words for it.
    expect(pane).toMatch(/<span class="trader-lock"><span class="item-icon"><img src="[^"]*padlock\.png"[^]*?Partner<\/span>/);
    expect(pane).not.toContain('All here');
    expect(boat).toContain('data-help="He keeps that back until you are a partner."');
  });

  /**
   * Found goods are gone for good, so a barter is never one press. The second
   * press is a different button with the cursor on the one that changes
   * nothing, because the key that armed the deal is still under the finger -
   * the same rule `trainerChallengePrompt` opens on BACK AWAY for.
   */
  it('asks again before it takes found goods, with the cursor on keeping them', () => {
    const { hub } = createTraderHub();
    const armed = hub as unknown as { traderArmed: string | undefined };
    hub.setView('trader');

    // Unarmed, the row is the question and nothing on screen strikes the deal.
    const offered = markupOf(hub);
    expect(offered).toContain('data-barter="barter-quick-claw"');
    expect(offered).not.toContain('data-barter-confirm');
    expect(offered).toMatch(/data-barter="barter-quick-claw"[^>]*data-help="[^"]*He asks again/);

    armed.traderArmed = 'barter-quick-claw';
    const asking = markupOf(hub);

    expect(asking).toContain('Hand over 2 Parts crates and 1 Cable coil for good?');
    expect(asking).toMatch(/data-deal-cancel[^>]*data-cursor-start/);
    expect(asking).toContain('data-barter-confirm="barter-quick-claw"');
    // The armed row is no longer the one-press deal it replaced.
    expect(asking).not.toContain('data-barter="barter-quick-claw"');
    // Keeping them is offered ahead of handing them over, so the first control
    // the cursor can reach is the one that costs nothing.
    expect(asking.indexOf('data-deal-cancel')).toBeLessThan(asking.indexOf('data-barter-confirm'));
  });

  it('asks again before it rents a berth, which is a raid of scavenging in money', () => {
    const { hub } = createTraderHub();
    const armed = hub as unknown as { traderArmed: string | undefined };
    hub.setView('trader');

    armed.traderArmed = 'berth';
    const asking = markupOf(hub);

    expect(asking).toContain('Pay ₽250 for one raid, used or not?');
    expect(asking).toContain('data-berth-confirm');
    expect(asking).toMatch(/data-deal-cancel[^>]*data-cursor-start/);
    expect(asking).not.toMatch(/data-berth(?![-\w])/);
  });

  /**
   * The midgame bug hunt of 11 Nov 2026: a double ENTER on POTION bought two,
   * spent a TRUSTED save's whole ration and said "Bought one". The shelf asks
   * as the barters do, so a press arms the row and the second lands on KEEP.
   */
  it('asks before it buys off the shelf, so a double ENTER on a row buys nothing', () => {
    const { hub } = createTraderHub();
    const buttons = new Map<string, { dataset: Record<string, string>; onclick?: (event: { detail: number }) => void }>();
    const internals = hub as unknown as {
      traderArmed: string | undefined;
      overlay: { root: { querySelectorAll(selector: string): unknown[] }; focus: ReturnType<typeof vi.fn> };
    };
    const datasets: Record<string, Record<string, string>> = {
      '[data-buy]': { buy: 'potion' },
      '[data-buy-confirm]': { buyConfirm: 'potion' },
      '[data-deal-cancel]': {},
    };
    internals.overlay.root.querySelectorAll = (selector: string) => {
      const dataset = datasets[selector];
      if (!dataset) return [];
      const button = buttons.get(selector) ?? { dataset };
      buttons.set(selector, button);
      return [button];
    };
    const press = (selector: string, detail = 0): void => buttons.get(selector)!.onclick!({ detail });
    const money = (): number => hub.stash.itemCount('money');
    const potions = hub.stash.itemCount('potion');
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    hub.setView('trader');
    hub.render();
    expect(markupOf(hub)).toMatch(/2 others till you raid/);
    // A Potion is off that ration, so buying one leaves it as it was.

    // ENTER twice on the row: the first asks, the second asks again, and
    // nothing is spent either time.
    press('[data-buy]');
    press('[data-buy]');
    expect(money()).toBe(1_000);
    expect(hub.stash.itemCount('potion')).toBe(potions);
    const asking = markupOf(hub);
    expect(asking).toContain('Pay ₽120 for a Potion?');
    expect(asking).toMatch(/data-deal-cancel[^>]*data-cursor-start/);
    expect(asking.indexOf('data-deal-cancel')).toBeLessThan(asking.indexOf('data-buy-confirm'));
    expect(asking).not.toMatch(/data-buy="potion"/);

    // The second ENTER of a real double press lands on KEEP THEM: nothing is
    // spent, and the cursor goes back to the Potion rather than the top of the shelf.
    press('[data-deal-cancel]');
    expect(internals.traderArmed).toBeUndefined();
    expect(money()).toBe(1_000);
    expect(internals.overlay.focus).toHaveBeenLastCalledWith('[data-buy="potion"]');
    press('[data-buy]');

    // The second half of a double-click that armed it lands on BUY and is swallowed.
    now += 120;
    press('[data-buy-confirm]', 2);
    expect(money()).toBe(1_000);
    expect(internals.overlay.focus).toHaveBeenLastCalledWith('[data-deal-cancel]');

    // A deliberate BUY buys exactly one, and says so.
    press('[data-buy-confirm]');
    expect(money()).toBe(880);
    expect(hub.stash.itemCount('potion')).toBe(potions + 1);
    expect(internals.traderArmed).toBeUndefined();
    const after = markupOf(hub);
    expect(after).toContain('Bought one for ₽120.');
    expect(after).toMatch(/2 others till you raid/);
    vi.restoreAllMocks();
  });

  it('says on the question when it spends the rest of the trip', () => {
    const { hub } = createTraderHub();
    const internals = hub as unknown as { traderArmed: string | undefined; counterCounts: Map<string, number> };
    hub.setView('trader');
    internals.counterCounts.set('buy:antidote', 2);
    internals.traderArmed = 'stock:antidote';
    const asking = markupOf(hub);
    expect(asking).toContain("Pay ₽160 for 2 Antidotes? That's your last till you raid.");
    expect(asking).toContain('data-buy-confirm="antidote"');
    // A Potion is off the ration, so two of them are never the last.
    internals.counterCounts.set('buy:potion', 2);
    internals.traderArmed = 'stock:potion';
    expect(markupOf(hub)).toContain('Pay ₽240 for 2 Potions?</');
  });

  it('forgets a deal it had asked about the moment the screen changes', () => {
    const { hub } = createTraderHub();
    const armed = hub as unknown as { traderArmed: string | undefined };
    hub.setView('trader');
    armed.traderArmed = 'barter-quick-claw';

    hub.setView('stash');
    hub.setView('trader');

    expect(armed.traderArmed).toBeUndefined();
    expect(markupOf(hub)).not.toContain('data-barter-confirm');
  });

  /**
   * ESC on a question is NO, as B is on FireRed's YES/NO box: it puts the deal
   * down and leaves the player at the counter, rather than walking them out of
   * the cottage with the question still unanswered.
   */
  it('takes ESC on an armed deal as keeping the goods, and stays at the counter', () => {
    const { hub, start } = createTraderHub();
    const armed = hub as unknown as { traderArmed: string | undefined };
    hub.setView('trader');
    armed.traderArmed = 'barter-quick-claw';
    hub.render();

    vi.stubGlobal('document', { activeElement: null });
    try {
      (hub as unknown as { handleKey(event: KeyboardEvent): void }).handleKey({
        key: 'Escape',
        preventDefault: () => undefined,
      } as KeyboardEvent);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(armed.traderArmed).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    const boat = markupOf(hub);
    expect(boat).not.toContain('data-barter-confirm');
    expect(boat).toContain('data-barter="barter-quick-claw"');
  });

  it('says a struck deal is traded on its card, once, in place of its parts', () => {
    const { storage } = createTraderHub();
    const save = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: { traderBarters?: string[] } };
    save.raidProgress.traderBarters = ['barter-quick-claw'];
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, storage);

    hub.setView('trader');
    const boat = markupOf(hub);
    const row = /<button[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g.exec(
      boat.slice(boat.indexOf('data-shows="barter-quick-claw"') - 400),
    )![0];

    expect(row).toContain('is-secured');
    expect(row).not.toContain('part-tag');
    expect(row.match(/Traded/gi)).toHaveLength(1);
  });

  it('types no arrow and no tick, exactly as every other pixel screen', () => {
    const { hub } = createTraderHub();
    hub.setView('trader');
    const boat = markupOf(hub);

    expect(boat).not.toMatch(/[▶▲▼◀→←↑↓✓✔]/u);
  });
});

/**
 * Two questions a player could not ask anywhere in the game: how close is this
 * Pokemon to its next level, and what does this move actually do. They used to
 * be a screen of their own, opened by a chip on every stash row; they are the
 * stash's own detail pane now, so the collection and the answer about the thing
 * in it are one screen.
 */
describe('what the stash says about the Pokémon under the cursor', () => {
  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  function stashMarkup(hub: HubInternals): string {
    hub.setView('stash');
    return markupOf(hub);
  }

  it('holds a pane for every Pokémon in the list, not a chip that opens a screen', () => {
    const { hub } = createHub();

    const stash = stashMarkup(hub);

    const rows = hub.stash.listPokemon();
    expect(rows.length).toBeGreaterThan(0);
    for (const stored of rows) {
      // The row points at its own pane, and the pane is on the same screen.
      expect(stash).toContain(`data-shows="${stored.id}"`);
      expect(stash).toContain(`data-shown-by="${stored.id}"`);
    }
    // Nothing on a row opens a second screen about the thing the row is.
    expect(stash).not.toContain('data-summary=');
  });

  // Break-it test, 23 Nov 2026: RENAME opened with the old name unselected and
  // the caret at its start, so a pasted name went in front of it.
  it('selects the old name when RENAME opens, so what is typed or pasted replaces it', () => {
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, new MemoryStorage());
    const internals = hub as unknown as {
      boxScope: number;
      boxEditing: string | undefined;
      overlay: { root: { querySelectorAll(selector: string): unknown[]; querySelector(selector: string): unknown } };
    };
    hub.setView('stash');
    internals.boxScope = 0;
    const rename = { dataset: {} as Record<string, string>, onclick: undefined as undefined | ((event: { detail: number }) => void) };
    const field = { select: vi.fn() };
    internals.overlay.root.querySelectorAll = (selector: string) => (selector === '[data-box-rename]' ? [rename] : []);
    internals.overlay.root.querySelector = (selector: string) =>
      selector === '[data-box-form="rename"] .px-field' && internals.boxEditing === 'rename' ? field : null;
    hub.render();
    rename.onclick!({ detail: 0 });

    expect(internals.boxEditing).toBe('rename');
    expect(field.select).toHaveBeenCalledOnce();
  });

  it.each(['<!--', '<i>Keep</i>'])('prints a box named %s as words, never as markup', (typed) => {
    // A box named `<!--` once commented out the rest of the Pokemon Center.
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, new MemoryStorage());
    const editing = hub as unknown as { boxScope: number; boxEditing: string; submitBoxForm(text: string): void };
    hub.setView('stash');
    editing.boxScope = 0;
    editing.boxEditing = 'rename';
    editing.submitBoxForm(typed);

    // Read with the "Renamed to" line still up, which prints the name too.
    const stash = markupOf(hub);
    expect(stash).toContain('Renamed to');

    expect(stash).not.toContain('<!--');
    expect(stash).not.toContain('<i>');
    const named = hub.stash.listBoxes()[0].name;
    expect(named).toBe(typed.replace(/[<>]/g, ''));
    expect(stash).toContain(named);
    // The screen is still all there after the name: the list is drawn.
    expect(stash.slice(stash.indexOf(named))).toContain('data-shows="charmander-1"');
  });

  it('says how far the next level is, and what each move does', () => {
    const { hub } = createHub();
    const stored = hub.stash.listPokemon().find(({ id }) => id === 'charmander-1')!;
    const { pokemon } = stored;
    const curve = pokemon.base.growthRate;
    const span = experienceForLevel(pokemon.level + 1, curve) - experienceForLevel(pokemon.level, curve);
    pokemon.experience = experienceForLevel(pokemon.level, curve) + Math.floor(span / 2);

    const stash = stashMarkup(hub);

    expect(stash).toContain('px-xp-fill');
    expect(stash).toContain(`${Math.ceil(span / 2).toLocaleString('en-GB')} XP to Lv ${pokemon.level + 1}`);
    // Every move carries its numbers and the sentence that says what it is for,
    // in the help bar the cursor fills when it rests on the move.
    for (const move of pokemon.moves) {
      expect(stash).toContain(move.base.name);
      expect(stash).toContain(`ACC ${move.base.accuracy}`);
      expect(stash).toContain(move.base.description);
    }
    expect(stash).toContain(`${pokemon.moves.length} of 4 known`);
  });

  it('shows one pane at a time: the first, until the cursor says otherwise', () => {
    const { hub } = createHub();

    const stash = stashMarkup(hub);

    const panes = [...stash.matchAll(/data-shown-by="([^"]+)"([^>]*)>/g)];
    expect(panes.length).toBe(hub.stash.listPokemon().length);
    expect(panes.filter(([, , rest]) => !rest.includes('hidden')).length).toBe(1);
  });

  it('keeps the pane on its own Pokémon while the cursor is inside it', () => {
    const { hub } = createHub();

    const stash = stashMarkup(hub);
    const id = hub.stash.listPokemon()[0].id;
    const pane = stash.slice(stash.indexOf(`data-shown-by="${id}"`));

    // `MenuOverlay.showDetailFor` reads the focused control's nearest
    // `data-shows`, so a control in the pane that carried none would leave the
    // pane it lives in showing somebody else after a re-render.
    for (const control of pane.slice(0, pane.indexOf('data-shown-by=', 1)).matchAll(/<button[^>]*>/g)) {
      expect(control[0]).toContain(`data-shows="${id}"`);
    }
  });
});

describe('the wall map in Oak’s Lab', () => {
  /** What `BaseScene.openWallMap` hands over: the view, the room, and where the player stood. */
  function walkUpToTheWall(hub: HubInternals): void {
    Object.assign(hub as unknown as Record<string, unknown>, {
      enteredFrom: 'oaks-lab',
      enteredAt: { x: 6, y: 2 },
    });
    hub.setView('wallmap');
  }

  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  it('hangs every map at one scale, with a sign for every keeper beaten', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      defeatedBosses: ['floodplain-toll-keeper', 'overlook-warden'],
    });
    walkUpToTheWall(hub);
    const markup = markupOf(hub);

    for (const mapId of ['floodplain-relay', 'pallet-town', 'route-1', 'viridian-forest', 'viridian-city']) {
      expect(markup).toContain(`data-wall-map="${mapId}"`);
      expect(markup).toContain(`data-picture="wall:${mapId}"`);
    }
    // One scale for all five, and each card as wide as its map.
    expect(markup.match(/data-fit="shared"/g)).toHaveLength(5);
    expect(markup).toContain('data-picture-row="128,64,64,64,72"');
    expect(markup).toContain('TOLLMAN BRIGGS');
    expect(markup).toContain('WARDEN WREN');
    expect(markup).not.toContain('MILLER VANCE');
    expect(markup).toContain('2 of 11 keepers beaten');
  });

  it('reads one map close up, and backs out to all of them before leaving the lab', () => {
    const { hub, start } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      surveyed: walkedOnto('route-1', ['OVERLOOK GATE', 'THORN GATE']),
    });
    walkUpToTheWall(hub);
    hub.wallMapInspect = 'route-1';
    const close = markupOf(hub);
    expect(close).toContain('data-picture="wall:route-1"');
    expect(close).toContain('data-fit="own"');
    // What is on it, each with the ink the picture draws it in.
    expect(close).toContain('OVERLOOK GATE');
    expect(close).toContain('held by WARDEN WREN');
    // A Cut door has no keeper: it wants a move.
    expect(close).toContain('needs CUT');
    expect(close).not.toContain('held by CUT');
    expect(close).toContain('No boss beaten here yet');
    // Only what has been walked to is named; the rest is counted.
    expect(close).toContain(`And ${gatesForMap('route-1').length - 2} more to find.`);
    expect(close).toMatch(/\d+ ways out to find\./);

    hub.goBack();
    expect(hub.wallMapInspect).toBeUndefined();
    expect(markupOf(hub)).toContain('data-fit="shared"');

    // And out of the screen, back to the tile it was read from.
    hub.goBack();
    expect(start).toHaveBeenCalledWith('base', expect.objectContaining({ room: 'oaks-lab', at: { x: 6, y: 2 } }));
  });

  it('draws every map close up at one tile a pixel in the smallest window, whatever its name holds the column open to', () => {
    // At 640x480 the body is the smallest stage across. The picture's room is
    // what the body leaves it, or what the place's heading holds its column
    // open to - so with the room left too narrow for the biggest map, a map
    // with a short name (PALLET TOWN) was drawn at half the scale of one with
    // a long one (FLOODPLAIN RELAY), a postage stamp in an empty pane.
    const { hub } = createHub({ ...DEFAULT_RAID_PROGRESS });
    walkUpToTheWall(hub);
    for (const mapId of ['floodplain-relay', 'pallet-town', 'route-1', 'viridian-forest', 'viridian-city']) {
      hub.wallMapInspect = mapId;
      const markup = markupOf(hub);
      const read = (name: string): number => Number(new RegExp(`data-${name}="(\\d+)"`).exec(markup)?.[1]);
      expect(markup).toContain('data-fit="own"');
      const plan = planOwnFrame(
        { width: read('picture-width'), height: read('picture-height') },
        { width: read('fit-width'), height: read('fit-height') },
        { width: BASE_STAGE_WIDTH - read('fit-leave'), height: BASE_STAGE_HEIGHT },
      );
      expect({ mapId, step: plan.fit.step }).toEqual({ mapId, step: 1 });
    }
  });
});

/**
 * The shipped roster (`world/mapRoster.ts`): every map but Greystone Vale is
 * retired, so the lab sends every save there - a new one and one whose every
 * landing was on a map put away.
 */
describe('the lab with only Greystone Vale in play', () => {
  beforeEach(() => retireMapsForTests(RETIRED_MAPS));
  afterEach(() => retireMapsForTests([]));

  it('sends a save with a raid behind it into Greystone Vale on a contract that lives there', () => {
    const { hub, start } = createHub({ ...DEFAULT_RAID_PROGRESS, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 0, wiped: 1 } } });

    expect(hub.flow.insertionId).toBe('greystone-vale');
    hub.flow.togglePokemon('charmander-1');
    readyToDeploy(hub);
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('greystone-vale');
    expect(runSession.plan?.contract?.mapId).toBe('greystone-vale');
  });

  it('turns a save whose landings are all on retired maps towards the vale, and refuses the old ones', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });

    expect(hub.flow.insertionId).toBe('greystone-vale');
    intoTheArena(hub);
    expect(hub.flow.insertionId).toBe('greystone-vale');
    const offered = (hub as unknown as { unlockedInsertions: readonly (readonly [string, unknown])[] }).unlockedInsertions;
    expect(offered.map(([id]) => id)).not.toContain('route-1');
  });
});

describe("the rim's Safe line", () => {
  /**
   * The overnight retest's explorer (23 Nov 2026) pressed + on a torn chart
   * in the locker's "Room for what you find", and every raid's card then said
   * "Safe: ... Torn chart (moor) x1": a chart they had never found.
   */
  it('names room kept for a found good as room, not as a thing carried', () => {
    expect(roomKeptFor({ itemId: 'torn-chart-moor', quantity: 1 }, 'Torn chart (moor)')).toBe('room for a Torn chart (moor)');
    expect(roomKeptFor({ itemId: 'radio-valve', quantity: 2 }, 'Radio valve')).toBe('room for 2 Radio valve');
    expect(roomKeptFor({ itemId: 'money', quantity: 250 }, 'Pokédollars')).toBe('room for ₽250');
  });
});

describe("Oak's wall's wildlife line", () => {
  it('keeps each kind and its level range together, and breaks only between kinds', () => {
    expect(wildlifeKinds([{ name: 'Pidgey', min: 3, max: 4 }, { name: 'Charmander', min: 4, max: 6 }])).toBe(
      '<span class="wildlife-kind">Pidgey 3-4</span> · <span class="wildlife-kind">Charmander 4-6</span>',
    );
  });
});
