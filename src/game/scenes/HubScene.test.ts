import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { activeRunManager, RunPhase } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import type { ActiveRunSession } from '../run/RunSession';
import { createStartingStash, type Stash, type StashedPokemon } from '../stash';
import {
  FAINTED_TREATMENT_NOTE,
  MAX_PENDING_RECOVERY_MS,
  raidClockAfterRecovery,
  recoveryCostMs,
  type DeploymentFlow,
} from '../hub';
import {
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RaidProgress,
  type StorageLike,
} from '../save/SaveManager';
import { HubScene, type HubSceneData } from './HubScene';

interface WorldSceneData {
  readonly party: PokemonParty;
  readonly bag: Bag;
  readonly runSession: ActiveRunSession;
}

interface HubInternals {
  init(data?: HubSceneData): void;
  startRun(): void;
  render(): void;
  recover(ids: readonly string[]): void;
  treat(pokemonId: string, itemId: string): void;
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
    hub.flow.toggleSecureItem('potion');
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
      firstContractExtracted: true,
      unlockedInsertions: ['floodplain-relay', 'town-square', 'south-verge'],
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
        firstContractExtracted: true,
        unlockedInsertions: ['floodplain-relay', 'town-square', 'south-verge'],
      },
    });
    const { hub } = createHub(DEFAULT_RAID_PROGRESS, storage);

    expect((hub as unknown as { savedGame: { raidProgress: RaidProgress } }).savedGame.raidProgress)
      .toEqual({
        firstContractExtracted: true,
        unlockedInsertions: ['floodplain-relay', 'town-square', 'south-verge'],
      });
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
    expect(data.runSession.stashSecureSlot).toEqual({ pokemonId: 'charmander-1', items: [] });
    expect(activeRunManager.snapshot().loadout?.party.map((pokemon) => pokemon.base.id)).toEqual([
      'charmander',
    ]);
  });
});
