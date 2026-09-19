import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, PIDGEY, Pokemon, PokemonParty, SQUIRTLE } from '../pokemon';
import { FIRST_CONTRACT_ID, RAID_CONTRACTS, standingBoard } from '../objectives';
import { activeRunManager, RunPhase } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import { RUN_INSERTIONS } from '../run/runGeneration';
import type { ActiveRunSession } from '../run/RunSession';
import { createStartingStash, Stash, type StashedPokemon } from '../stash';
import {
  FAINTED_TREATMENT_NOTE,
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
import { HubScene, type HubSceneData } from './HubScene';

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
    hub.openDeployment();
    hub.flow.togglePokemon('charmander-1');
    hub.flow.adjustItem('potion', 1);
    screens.push(markupOf(hub));
    hub.flow.openSecureSlot();
    screens.push(markupOf(hub));
    hub.flow.advance();
    hub.flow.advance();
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
      expect(screen).toContain('class="px-help"');
      // The modern-web vocabulary it replaced, which the raid's own screens still use.
      expect(screen).not.toMatch(/class="[^"]*(?<![\w-])(panel|entity-row|button|menu-shell)(?![\w-])/);
    }
  });

  it('points preparation at a contract\'s own insertion when its row is chosen', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      completedContracts: [FIRST_CONTRACT_ID],
    });

    expect(markupOf(hub)).toContain('data-contract="route-1"');
    hub.openDeployment('route-1');

    expect(hub.flow.insertionId).toBe('route-1');
    expect(hub.flow.step).toBe('loadout');
    // Where you drop in is the one thing the board may choose. It never packs.
    expect(hub.flow.party).toEqual([]);
  });

  it('will not be pointed at an insertion the save has not unlocked', () => {
    const { hub } = createHub();

    hub.openDeployment('viridian-forest');

    expect(hub.flow.insertionId).toBe('floodplain-relay');
  });

  it('says on the base screen that someone is hurt, and bills it in the stash', () => {
    const { hub } = createWornHub();

    const home = markupOf(hub);
    expect(home).toContain('1 Pokémon came home hurt');
    expect(home).not.toContain('recovery-panel');

    hub.setView('stash');
    const stash = markupOf(hub);
    expect(stash).toContain('recovery-panel');
    expect(stash).toContain('data-recover-all');
    expect(stash).toContain('data-recover="charmander-1"');
  });

  it('lists one box at a time, and every box when the loadout is chosen from', () => {
    const { hub } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 3), 'shelved');
    hub.stash.movePokemon('shelved', hub.stash.addBox());

    hub.setView('stash');
    const first = markupOf(hub);
    expect(first).toContain('Box 1');
    expect(first).toContain('data-box-step');
    expect(first).not.toContain('data-recover="shelved"');
    expect(first).not.toContain('data-fit="shelved"');

    hub.stepBox(1);
    expect(markupOf(hub)).toContain('data-fit="shelved"');

    // The loadout is drawn from all of them, so nothing to spend or deploy hides.
    hub.openDeployment();
    expect(markupOf(hub)).toContain('data-pokemon="shelved"');
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

  it('keeps a fit save free of the recovery bay entirely', () => {
    const { hub } = createHub();

    hub.setView('stash');

    expect(markupOf(hub)).not.toContain('recovery-panel');
  });

  it('lets the cursor rest on a medicine that would do nothing, to be told why', () => {
    const { hub } = createWornHub();

    hub.openDeployment();
    const loadout = markupOf(hub);

    // `disabled` would make the reason unreachable: the help bar only speaks for
    // the control the cursor is on.
    expect(loadout).toMatch(/data-treat-item="potion"[^>]*data-help="Potion: Restores/);
    expect(loadout).not.toMatch(/data-treat-item="[^"]*"[^>]* disabled/);
  });
});

interface WorldSceneData {
  readonly party: PokemonParty;
  readonly bag: Bag;
  readonly runSession: ActiveRunSession;
}

interface HubInternals {
  init(data?: HubSceneData): void;
  setView(view: 'home' | 'stash' | 'deploy' | 'reselect' | 'outfitter'): void;
  startRun(): void;
  render(): void;
  recover(ids: readonly string[]): void;
  treat(pokemonId: string, itemId: string): void;
  pickUp(pokemonId: string): void;
  putDown(destination: string): void;
  stepBox(direction: number): void;
  openDeployment(insertionId?: string): void;
  readonly flow: DeploymentFlow;
  readonly stash: Stash;
  readonly raidClockMs: number;
  readonly pendingRecoveryMs: number;
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
    time: { delayedCall: vi.fn() },
    overlay: {
      root: {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      focus: vi.fn(),
      refocus: vi.fn(),
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

function deploy(hub: HubInternals, start: ReturnType<typeof vi.fn>): void {
  hub.startRun();
  (start as unknown as { flushFade(): void }).flushFade();
}

/** A hub whose stored save holds one worn-down Pokemon, as a raid leaves it. */
function createWornHub(damage = (maxHp: number) => maxHp - 3): {
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
  });
  const { hub, start } = createHub(DEFAULT_RAID_PROGRESS, storage);
  const worn = hub.stash.listPokemon().find((stored) => stored.id === 'charmander-1')!;
  return { hub, start, storage, worn };
}

describe('hub deployment route', () => {
  // The hub shares one process-wide run manager, so a started raid has to be
  // resolved before the next test can deploy again.
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  it('recovers a worn Pokemon at base and takes the cost off the next raid clock', () => {
    const { hub, start, storage, worn } = createWornHub();
    const costMs = recoveryCostMs(worn.pokemon);
    // The player builds the loadout first, so recovery has to leave it intact.
    hub.flow.togglePokemon('charmander-1');
    expect(costMs).toBeGreaterThan(0);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS);

    hub.recover(['charmander-1']);

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

    hub.flow.advance();
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
    hub.flow.togglePokemon('charmander-1');

    expect(worn.pokemon.isFainted).toBe(true);
    expect(hub.flow.isDeployable).toBe(false);
    expect(hub.flow.advance()).toMatch(/fainted/);

    hub.recover(['charmander-1']);

    expect(worn.pokemon.isFainted).toBe(false);
    expect(hub.flow.advance()).toBeUndefined();
    deploy(hub, start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('heals a worn Pokemon with a stash Potion, and both the heal and the cost survive a reload', () => {
    // The other price for raid damage: an item instead of raid time. It has to
    // be a real trade, so the Potion has to actually leave the vault and stay
    // gone, and it must never touch the recovery bay's clock.
    const { hub, storage, worn } = createWornHub((maxHp) => maxHp - 3);
    const before = worn.pokemon.currentHp;
    expect(hub.stash.itemCount('potion')).toBe(3);

    hub.treat('charmander-1', 'potion');

    expect(worn.pokemon.currentHp).toBeGreaterThan(before);
    expect(hub.stash.itemCount('potion')).toBe(2);
    // A Potion is not raid time: the clock the next raid starts on is untouched.
    expect(hub.pendingRecoveryMs).toBe(0);
    expect(hub.raidClockMs).toBe(RAID_DURATION_MS);

    const reloaded = new SaveManager(storage).load();
    expect(reloaded?.stash.listItems().potion).toBe(2);
    expect(reloaded?.stash.listPokemon()).toMatchObject([
      { id: 'bulbasaur-1' },
      { id: 'charmander-1', pokemon: { currentHp: worn.pokemon.currentHp } },
    ]);
  });

  it('never deploys a supply the treatment already spent, secure slot included', () => {
    const { hub, start, storage } = createWornHub((maxHp) => maxHp - 3);
    hub.flow.togglePokemon('charmander-1');
    hub.flow.adjustItem('potion', 3);
    hub.flow.adjustSecureItem('potion', 3);
    expect(hub.flow.items).toEqual([{ itemId: 'potion', quantity: 3 }]);

    // One of those three Potions is drunk at base, so only two can be packed.
    hub.treat('charmander-1', 'potion');

    expect(hub.stash.itemCount('potion')).toBe(2);
    expect(hub.flow.items).toEqual([{ itemId: 'potion', quantity: 2 }]);
    expect(hub.flow.securedItems).toEqual([{ itemId: 'potion', quantity: 2 }]);

    hub.flow.advance();
    deploy(hub, start);
    const deployed = start.mock.calls[0][1] as WorldSceneData;
    expect(deployed.bag.count('potion')).toBe(2);
    // And the vault the raid was drawn from agrees, on disk.
    expect(new SaveManager(storage).load()?.stash.itemCount('potion')).toBe(2);
  });

  it('leaves a fainted Pokemon to the recovery bay rather than letting a Potion revive it', () => {
    // Reviving stays the bay's premium, which is what keeps a faint the worst
    // outcome of a fight rather than a three-Potion inconvenience.
    const { hub, worn } = createWornHub((maxHp) => maxHp);

    hub.treat('charmander-1', 'potion');

    expect(worn.pokemon.isFainted).toBe(true);
    expect(hub.stash.itemCount('potion')).toBe(3);
    expect(statusOf(hub)).toBe(FAINTED_TREATMENT_NOTE);

    hub.recover(['charmander-1']);
    expect(worn.pokemon.isFainted).toBe(false);
    expect(hub.pendingRecoveryMs).toBeGreaterThan(0);
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

  it('will not enter a raid until the player confirms the plan', () => {
    const { hub, start } = createHub();

    deploy(hub, start);
    expect(start).not.toHaveBeenCalled();
    expect(statusOf(hub)).toBe('Confirm your loadout before deploying.');

    hub.flow.togglePokemon('charmander-1');
    deploy(hub, start);
    expect(start).not.toHaveBeenCalled();
    expect(statusOf(hub)).toBe('Confirm your loadout before deploying.');

    hub.flow.advance();
    deploy(hub, start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe('world');
  });

  it('sends a brand new save into Floodplain Relay carrying a contract that lives there', () => {
    const { hub, start } = createHub();

    hub.flow.togglePokemon('charmander-1');
    hub.flow.advance();
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('floodplain-relay');
    expect(runSession.plan?.contract?.mapId).toBe('floodplain-relay');
    expect(runSession.objectives.map((objective) => objective.id)).toEqual([
      'recover-lost-field-kit',
    ]);
    expect(activeRunManager.snapshot().mapId).toBe('floodplain-relay');
  });

  it('reopens the legacy insertions only once the first contract has been banked', () => {
    const { hub, start } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      outfitterUpgrades: [],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });

    hub.flow.togglePokemon('charmander-1');
    hub.flow.chooseInsertion('town-square');
    hub.flow.advance();
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
    hub.setView('deploy');
    hub.render();
    const markup = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root
      .innerHTML;
    expect(markup).toContain('data-insertion="route-1-overlook"');
    expect(markup).toContain('DROP-IN · Route 1');

    hub.flow.chooseInsertion('route-1-overlook');
    hub.flow.advance();
    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.insertion.id).toBe('route-1-overlook');
    expect(runSession.plan?.defeatedBosses).toEqual(['overlook-warden']);
    expect(runSession.plan?.trainers.some((trainer) => trainer.bossId === 'overlook-warden'))
      .toBe(false);
  });

  it('does not offer a drop-in point nobody has walked to', () => {
    const { hub } = createHub({
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });

    hub.setView('deploy');
    hub.render();
    const markup = (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root
      .innerHTML;
    expect(markup).toContain('data-insertion="route-1"');
    expect(markup).not.toContain('route-1-overlook');
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
        outfitterUpgrades: [],
        defeatedBosses: [],
        reachedInsertions: [],
        standingContractsBanked: 0,
      },
    });
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, storage);

    expect((hub as unknown as { savedGame: { raidProgress: RaidProgress } }).savedGame.raidProgress)
      .toEqual({
        ...DEFAULT_RAID_PROGRESS,
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
        outfitterUpgrades: [],
      });
  });

  it('starts one raid however many times the key that started it is pressed', () => {
    const { hub, start } = createHub();
    hub.flow.togglePokemon('charmander-1');
    hub.flow.advance();

    // The screen keeps its cursor on `Enter the raid` for the length of the
    // fade, and the second press used to throw out of a raid already running.
    hub.startRun();
    expect(() => hub.startRun()).not.toThrow();
    (start as unknown as { flushFade(): void }).flushFade();

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('enters the raid with exactly the party, supplies and secure slot that were confirmed', () => {
    const { hub, start } = createHub();

    hub.flow.togglePokemon('charmander-1');
    hub.flow.adjustItem('potion', 2);
    hub.flow.openSecureSlot();
    hub.flow.toggleSecurePokemon('charmander-1');
    hub.flow.advance();
    hub.flow.advance();
    deploy(hub, start);

    const data = start.mock.calls[0][1] as WorldSceneData;
    expect(data.party.pokemon.map((pokemon) => pokemon.base.id)).toEqual(['charmander']);
    expect(data.bag.toJSON()).toEqual({ potion: 2 });
    expect(data.runSession.broughtPokemonIds).toEqual(['charmander-1']);
    expect(data.runSession.broughtItems).toEqual([{ itemId: 'potion', quantity: 2 }]);
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
    hub.setView('deploy');
    hub.flow.advance();
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  it('prices the veteran on the final check and sends that same hunter into the raid', () => {
    const { hub, start } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 16), 'veteran-1');
    hub.flow.togglePokemon('veteran-1');

    const finalCheck = finalCheckOf(hub);
    expect(finalCheck).toContain('data-hunter-tier="4"');
    expect(finalCheck).toContain('matched to your Lv 16 Charmander');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(3);
  });

  it('prices the same save a tier-one hunter when the veteran stays at base', () => {
    const { hub, start } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 16), 'veteran-1');
    hub.flow.togglePokemon('bulbasaur-1');
    expect(hub.flow.party.map((stored) => stored.pokemon.level)).toEqual([5]);

    const finalCheck = finalCheckOf(hub);
    expect(finalCheck).toContain('data-hunter-tier="1"');
    expect(finalCheck).toContain('nothing you bring out-levels it');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(0);
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

  it('replaces "Every contract is banked" once the chain is banked, one row per map', () => {
    const progress = chainBanked(2);
    const { hub } = createHub(progress);
    const home = markupOf(hub);
    expect(home).not.toContain('Every contract is banked');
    expect(home).toContain('Standing board');
    expect(home).toContain('4 open · 2 banked');
    for (const contract of standingBoard(progress)) {
      expect(home).toContain(contract.description);
      expect(home).toContain(`data-shows="${contract.id}"`);
      expect(home).toContain(`data-shown-by="${contract.id}"`);
    }
  });

  it('says what a contract costs before it is taken: the row opens its own insertion and the hunter is on it', () => {
    const progress = chainBanked(2);
    const raised = standingBoard(progress).find((contract) => contract.hunterPressure === 1)!;
    const home = markupOf(createHub(progress).hub);
    const insertion = Object.values(RUN_INSERTIONS).find((entry) => entry.mapId === raised.mapId)!;
    expect(home).toContain(`data-contract="${insertion.id}" data-shows="${raised.id}"`);
    expect(home).toContain('data-hunter-pressure="1"');
    expect(home).toContain('Hunter +1 tier');
    // The raised contract leads the board.
    expect(home.indexOf(`data-shows="${raised.id}"`)).toBe(home.indexOf('data-shows="'));
  });

  it.each([
    ['a raised contract', 1, 2],
    ['a contract with no pressure on it', undefined, 1],
  ] as const)(
    'prices %s on the final check and sends that same hunter into the raid',
    (_name, pressure, tier) => {
      const progress = chainBanked(2);
      const contract = standingBoard(progress).find((candidate) => candidate.hunterPressure === pressure)!;
      const insertion = Object.values(RUN_INSERTIONS).find((entry) => entry.mapId === contract.mapId)!;
      const { hub, start } = createHub(progress);
      hub.flow.togglePokemon('bulbasaur-1');
      hub.flow.chooseInsertion(insertion.id);
      hub.setView('deploy');
      hub.flow.advance();

      const finalCheck = markupOf(hub);
      expect(finalCheck).toContain(`data-hunter-tier="${tier}"`);
      expect(finalCheck.includes('for the contract')).toBe(pressure !== undefined);

      deploy(hub, start);
      const { runSession } = start.mock.calls[0][1] as WorldSceneData;
      expect(runSession.plan?.contract?.id).toBe(contract.id);
      expect(runSession.plan?.hunter.teamTierOffset).toBe(tier - 1);
    },
  );
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

  it('opens on the raid, not on an offer to trade the partner just chosen', () => {
    const hub = createFreshHub();

    const home = markupOf(hub);

    // Three seconds into a first game the loudest panel on the screen said
    // "DOWN TO ONE POKEMON". It also pushed the contract board past the frame.
    expect(home).not.toContain('Down to one Pokémon');
    expect(home).not.toContain('swap-panel');
    expect(home.indexOf('Start a raid')).toBeLessThan(home.indexOf('Contract board'));
    expect(home).toContain('Contract board');
  });

  it('keeps the swap offer, in the stash beside the Pokémon it would trade away', () => {
    const hub = createFreshHub();

    hub.setView('stash');
    const stash = markupOf(hub);

    expect(stash).toContain('swap-panel');
    expect(stash).toContain('Down to one Pokémon');
    expect(stash).toContain('data-view="reselect"');
  });

  it('says the swap is there, so a wiped player is not left hunting for it', () => {
    const hub = createFreshHub();

    // On the card that leads to it, in the help bar rather than in the card's
    // own line: with somebody hurt the line is already a warning, and a second
    // sentence made the smallest card the loudest thing on the base screen.
    const card = markupOf(hub);
    const stash = card.slice(card.indexOf('data-view="stash"'));
    expect(stash.slice(0, stash.indexOf('</button>'))).toContain(
      'Your last partner can be swapped here.',
    );
  });

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

  it('does not let the swap stand in for the recovery bay or the restock', () => {
    const { hub, storage } = createSpentHub();
    hub.setView('stash');
    // The price is the tag on the hurt Pokémon's own row.
    const priceOn = (id: string): string | undefined =>
      new RegExp(`data-recover="${id}"[^>]*>.*?px-tag-risk">([^<]+)<`).exec(markupOf(hub))?.[1];
    const price = priceOn('squirtle-1');
    expect(price).toBeDefined();

    swapTo(hub, 'charmander');

    const saved = new SaveManager(storage).load()!;
    expect(saved.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { base: { id: 'charmander' }, level: 5, currentHp: 1 } },
    ]);
    expect(saved.stash.listItems()).toEqual({ 'poke-ball': 4 });
    expect(saved.pendingRecoveryMs).toBe(0);
    // The screen shows the same vault, and the bay still wants its price.
    expect(hub.stash.listPokemon()[0].pokemon.currentHp).toBe(1);
    expect(priceOn('charmander-1')).toBe(price);

    // Swapping back for the species you had is no way round it either.
    swapTo(hub, 'squirtle');
    expect(hub.stash.listPokemon()[0].pokemon.currentHp).toBe(1);
    expect(hub.stash.listItems()).toEqual({ 'poke-ball': 4 });
  });

  it('states the condition the new partner arrives in before the swap is confirmed', () => {
    const { hub } = createSpentHub();
    const swapping = hub as unknown as { reselectStarterId: string; swapArmed: boolean };

    hub.setView('reselect');
    swapping.reselectStarterId = 'charmander';
    expect(markupOf(hub)).toContain('Level 5 · 1/16 HP');

    swapping.swapArmed = true;
    const armed = markupOf(hub);
    expect(armed).toContain('data-swap-confirm');
    expect(armed).toContain('Level 5 · 1/16 HP');
  });

  it('drops the offer everywhere the moment a second Pokémon is banked', () => {
    const { hub } = createHub();

    hub.setView('stash');
    expect(markupOf(hub)).not.toContain('swap-panel');
  });

  it('puts both loadout actions in one bar rather than at the bottom of a column', () => {
    const { hub } = createHub();

    hub.flow.togglePokemon('charmander-1');
    hub.setView('deploy');
    const loadout = markupOf(hub);
    const bar = loadout.slice(loadout.indexOf('confirm-bar'));

    // The primary action was entirely below the fold at 1280x800 because it sat
    // at the end of the right-hand column. It is in the full-width bar now, and
    // the secure-slot detour with it.
    expect(bar).toContain('data-advance');
    expect(bar).toContain('data-secure-slot');
    expect(loadout.slice(0, loadout.indexOf('confirm-bar'))).not.toContain('data-advance');
  });

  it('says in the bar what is packed, so the summary is beside the button that commits it', () => {
    const { hub } = createHub();

    hub.flow.togglePokemon('charmander-1');
    hub.flow.adjustItem('potion', 2);
    hub.setView('deploy');
    const loadout = markupOf(hub);
    const bar = loadout.slice(loadout.indexOf('confirm-bar'));

    expect(bar).toContain('1/6 Pokémon packed');
    // The bar's own title says "packed", so the summary under it does not.
    expect(bar).toContain('Charmander · 2 supplies · 0 protected');
  });
});

describe('the Outfitter', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  interface OutfitterInternals extends HubInternals {
    choosePayment(upgradeId: string): void;
    togglePayment(pokemonId: string): void;
    confirmPayment(): void;
    outfitterArmed: boolean;
    outfitterPayment: string[];
  }

  function markupOf(hub: HubInternals): string {
    hub.render();
    return (hub as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  }

  /** A stored mid-game save: a partner, three catches, spare kit, these upgrades. */
  function createOutfittedHub(outfitterUpgrades: readonly string[] = []): {
    hub: OutfitterInternals;
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
    stash.addItem('parts-crate', 3);
    stash.addItem('mooring-rope', 1);
    stash.addItem('radio-valve', 2);
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
        outfitterUpgrades: [...outfitterUpgrades],
        defeatedBosses: [],
        reachedInsertions: [],
        standingContractsBanked: 0,
        giftsReceived: [],
      },
    });
    const { hub, start } = createHub(DEFAULT_RAID_PROGRESS, storage);
    return { hub: hub as OutfitterInternals, start, storage };
  }

  it('is reached from base, beside the raid and the stash', () => {
    const { hub } = createOutfittedHub();

    const home = markupOf(hub);
    expect(home).toContain('data-view="outfitter"');
    expect(home).toContain('0/7 built');
    expect(home.indexOf('Start a raid')).toBeLessThan(home.indexOf('data-view="outfitter"'));
  });

  it('lists every rung with its price, and marks what this vault cannot pay yet', () => {
    const { hub } = createOutfittedHub();

    hub.setView('outfitter');
    const ladder = markupOf(hub);
    expect(ladder).toContain('Secure locker I');
    expect(ladder).toContain('Costs 2 Pokémon + 2× Parts crate');
    expect(ladder).toContain('After Secure locker I: ');
    // Three spendable catches cannot pay the four the second locker asks.
    expect(ladder).toContain('<span class="cost-short" title="Not enough spare at base yet">4 Pokémon</span>');
    // A rung that cannot be built is still a control, so the cursor can reach it
    // and the pane under the list can say what it does.
    expect(ladder).toMatch(/data-outfit="secure-locker-1"(?![^>]*aria-disabled)[^>]* data-shows/);
    expect(ladder).toMatch(/data-outfit="secure-locker-2" aria-disabled="true"/);
    expect(ladder).not.toMatch(/<button[^>]* disabled/);
    expect(ladder).toContain('data-shown-by="secure-locker-2"');
  });

  it('names the Pokémon and the supplies it is spending, and asks before it spends them', () => {
    const { hub, storage } = createOutfittedHub();
    const before = storage.getItem(SAVE_KEY);

    hub.setView('outfitter');
    hub.choosePayment('secure-locker-1');
    const empty = markupOf(hub);
    // Nothing is picked on the player's behalf, and the partner cannot be picked at all.
    expect(empty).toContain('Choose 2 more Pokémon to release.');
    expect(empty).toMatch(/data-pay-pokemon="charmander-1" aria-disabled="true"/);
    // Pointing at it says why, and choosing it changes nothing.
    hub.togglePayment('charmander-1');
    expect(hub.outfitterPayment).toEqual([]);
    expect(empty).toContain('Your partner is never payment');
    expect(empty).not.toContain('data-pay-arm');

    hub.togglePayment('pidgey-1');
    hub.togglePayment('bulbasaur-9');
    const chosen = markupOf(hub);
    expect(chosen).toContain('Release Pidgey (Level 4) and Bulbasaur (Level 6) and spend 2× Parts crate');
    expect(chosen).toContain('data-pay-arm');
    expect(chosen).not.toContain('data-pay-confirm');

    // A confirmation that was never armed does nothing at all.
    hub.confirmPayment();
    expect(storage.getItem(SAVE_KEY)).toBe(before);

    hub.outfitterArmed = true;
    const armed = markupOf(hub);
    expect(armed).toContain('This cannot be undone');
    expect(armed).toContain('Release Pidgey (Level 4) and Bulbasaur (Level 6) and spend 2× Parts crate?');
    expect(armed).toContain('data-pay-confirm');
    expect(armed).toContain('Keep them');
  });

  it('disarms the question whenever the payment it was asked about changes', () => {
    const { hub } = createOutfittedHub();
    hub.setView('outfitter');
    hub.choosePayment('radio-mast');
    hub.togglePayment('pidgey-1');
    hub.outfitterArmed = true;

    hub.togglePayment('pidgey-1');

    expect(hub.outfitterArmed).toBe(false);
  });

  it('builds the locker, releases exactly what was named, and protects a wider container from then on', () => {
    const { hub, storage } = createOutfittedHub();
    expect(hub.flow.secureGrid).toEqual({ width: 2, height: 2 });

    hub.setView('outfitter');
    hub.choosePayment('secure-locker-1');
    hub.togglePayment('pidgey-1');
    hub.togglePayment('pidgey-2');
    hub.outfitterArmed = true;
    hub.confirmPayment();

    expect(statusOf(hub)).toBe('Secure locker I built. Pidgey and Pidgey released.');
    expect(hub.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'bulbasaur-9']);
    expect(hub.stash.itemCount('parts-crate')).toBe(1);
    expect(hub.stash.itemCount('poke-ball')).toBe(9);
    expect(hub.stash.itemCount('potion')).toBe(7);
    expect(hub.flow.secureGrid).toEqual({ width: 3, height: 2 });
    expect(markupOf(hub)).toMatch(/data-built="secure-locker-1"[\s\S]*?has-tick">Built</);
    // The upgrade is in storage, not just on screen.
    expect(new SaveManager(storage).load()?.raidProgress.outfitterUpgrades).toEqual(['secure-locker-1']);
  });

  it('offers a player with one Pokémon nothing to spend', () => {
    const { hub } = createHub();
    for (const stored of hub.stash.listPokemon().slice(1)) {
      hub.stash.removePokemon(stored.id);
    }
    const outfitter = hub as OutfitterInternals;

    hub.setView('outfitter');
    expect(markupOf(hub)).not.toMatch(/data-outfit="[a-z0-9-]+"(?! aria-disabled="true")/);

    // Choosing a rung that cannot be paid for is answered, and goes nowhere.
    outfitter.choosePayment('radio-mast');
    const refused = markupOf(hub);
    expect(refused).toContain('Radio mast still needs');
    expect(refused).not.toContain('data-pay-pokemon');
    expect(refused).not.toContain('data-pay-arm');
  });

  it('deploys with a second protected Pokémon, the beacon and the mast once they are built', () => {
    const { hub, start } = createOutfittedHub([
      'secure-locker-1',
      'secure-locker-2',
      'beacon',
      'radio-mast',
    ]);
    hub.flow.togglePokemon('charmander-1');
    hub.flow.togglePokemon('pidgey-1');
    hub.flow.togglePokemon('pidgey-2');
    hub.flow.toggleSecurePokemon('charmander-1');
    hub.flow.toggleSecurePokemon('pidgey-2');
    hub.setView('deploy');
    hub.flow.advance();
    expect(markupOf(hub)).toContain('2 secured · 0/6 squares');

    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.stashSecureSlot.pokemonIds).toEqual(['charmander-1', 'pidgey-2']);
    expect(runSession.secureSlot.pokemon).toHaveLength(2);
    expect(runSession.outfitterUpgrades).toContain('radio-mast');
    expect(runSession.plan?.extractionPoints.filter((point) => point.label === 'BEACON')).toMatchObject([
      { mapId: 'floodplain-relay', unlockAtMs: RAID_DURATION_MS / 2 },
    ]);
  });

  it('deploys from a base with nothing built exactly as before', () => {
    const { hub, start } = createOutfittedHub();
    hub.flow.togglePokemon('charmander-1');
    hub.setView('deploy');
    hub.flow.advance();

    deploy(hub, start);

    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.outfitterUpgrades).toEqual([]);
    expect(runSession.plan?.extractionPoints.some((point) => point.label === 'BEACON')).toBe(false);
  });

  it('quotes the bay at this base\'s prices and spends the ward bed once', () => {
    const { hub } = createOutfittedHub(['recovery-bay-1', 'quarantine-ward']);
    const hurt = hub.stash.listPokemon().find(({ id }) => id === 'pidgey-1')!;
    const down = hub.stash.listPokemon().find(({ id }) => id === 'pidgey-2')!;
    hurt.pokemon.takeDamage(3);
    down.pokemon.takeDamage(down.pokemon.maxHp);
    const terms = { priceShare: 0.75, wardTreatments: 0 };

    // The bill is in the stash, beside the Pokémon it is for.
    hub.setView('stash');
    expect(markupOf(hub)).toContain('Ward bed: ');

    // The bed goes to the worse case. It waives the refill; the revive is still
    // charged, at the better bay's price.
    hub.recover(['pidgey-2']);
    expect(hub.pendingRecoveryMs).toBe(recoveryPrices(0.75).reviveMs);

    // No bed left, so the second treatment is charged in full at the bay's discount.
    const hurtPriceMs = recoveryCostMs(hurt.pokemon, terms);
    hub.recover(['pidgey-1']);
    expect(hub.pendingRecoveryMs).toBe(recoveryPrices(0.75).reviveMs + hurtPriceMs);
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
      overlay: { root, focus: vi.fn(), refocus: vi.fn() },
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
  // help bar on the Outfitter, a screen that had said nothing.
  it('leaves a status line on the screen that raised it', () => {
    const { hub, internals, timers } = hubWithRenderCount();
    const views = hub as unknown as { setView(view: string): void };
    views.setView('stash');
    internals.setStatus('Charmander recovered for 0:50 of raid time. Next raid clock: 4:10.');

    views.setView('outfitter');

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
