import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { FIRST_CONTRACT_ID } from '../objectives';
import { activeRunManager, RunPhase } from '../run';
import { RAID_DURATION_MS } from '../run/raidClock';
import type { ActiveRunSession } from '../run/RunSession';
import { createStartingStash, type Stash, type StashedPokemon } from '../stash';
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
import { HubScene, type HubSceneData } from './HubScene';

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
    expect(finalCheck).toContain('data-hunter-tier="3"');
    expect(finalCheck).toContain('matched to your Lv 16 Charmander');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(2);
  });

  it('prices the same save a tier-one hunter when the veteran stays at base', () => {
    const { hub, start } = createHub();
    hub.stash.addPokemon(new Pokemon(CHARMANDER, 16), 'veteran-1');
    hub.flow.togglePokemon('bulbasaur-1');
    expect(hub.flow.party.map((stored) => stored.pokemon.level)).toEqual([5]);

    const finalCheck = finalCheckOf(hub);
    expect(finalCheck).toContain('data-hunter-tier="1"');
    expect(finalCheck).toContain('nothing you are bringing out-levels it');

    deploy(hub, start);
    const { runSession } = start.mock.calls[0][1] as WorldSceneData;
    expect(runSession.plan?.hunter.teamTierOffset).toBe(0);
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

    expect(markupOf(hub)).toContain('swap your last partner');
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
    expect(bar).toContain('Charmander · 2 supplies packed · 0 protected');
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
    expect(ladder).toContain('Costs 2 Pokémon + 2× Poke Ball + 1× Potion');
    expect(ladder).toContain('After Secure locker I: ');
    // Three spendable catches cannot pay the four the second locker asks.
    expect(ladder).toContain('<span class="cost-short" title="Not enough spare at base yet">4 Pokémon</span>');
    expect(ladder).toMatch(/data-outfit="secure-locker-1">Build/);
    expect(ladder).toMatch(/data-outfit="secure-locker-2" disabled>Build/);
  });

  it('names the Pokémon and the supplies it is spending, and asks before it spends them', () => {
    const { hub, storage } = createOutfittedHub();
    const before = storage.getItem(SAVE_KEY);

    hub.setView('outfitter');
    hub.choosePayment('secure-locker-1');
    const empty = markupOf(hub);
    // Nothing is picked on the player's behalf, and the partner cannot be picked at all.
    expect(empty).toContain('Choose 2 more Pokémon to release.');
    expect(empty).toMatch(/data-pay-pokemon="charmander-1" disabled/);
    expect(empty).toContain('Your partner is never payment');
    expect(empty).not.toContain('data-pay-arm');

    hub.togglePayment('pidgey-1');
    hub.togglePayment('bulbasaur-9');
    const chosen = markupOf(hub);
    expect(chosen).toContain('Release Pidgey (Level 4) and Bulbasaur (Level 6) and spend 2× Poke Ball, 1× Potion');
    expect(chosen).toContain('data-pay-arm');
    expect(chosen).not.toContain('data-pay-confirm');

    // A confirmation that was never armed does nothing at all.
    hub.confirmPayment();
    expect(storage.getItem(SAVE_KEY)).toBe(before);

    hub.outfitterArmed = true;
    const armed = markupOf(hub);
    expect(armed).toContain('This cannot be undone');
    expect(armed).toContain('Release Pidgey (Level 4) and Bulbasaur (Level 6) and spend 2× Poke Ball, 1× Potion?');
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

  it('builds the locker, releases exactly what was named, and protects a third stack from then on', () => {
    const { hub, storage } = createOutfittedHub();
    expect(hub.flow.secureItemStacks).toBe(2);

    hub.setView('outfitter');
    hub.choosePayment('secure-locker-1');
    hub.togglePayment('pidgey-1');
    hub.togglePayment('pidgey-2');
    hub.outfitterArmed = true;
    hub.confirmPayment();

    expect(statusOf(hub)).toBe('Secure locker I built. Pidgey and Pidgey released.');
    expect(hub.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'bulbasaur-9']);
    expect(hub.stash.itemCount('poke-ball')).toBe(7);
    expect(hub.stash.itemCount('potion')).toBe(6);
    expect(hub.flow.secureItemStacks).toBe(3);
    expect(markupOf(hub)).toContain('Built ✓');
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
    expect(markupOf(hub)).not.toMatch(/data-outfit="[a-z0-9-]+">/);

    outfitter.choosePayment('radio-mast');
    const payment = markupOf(hub);
    expect(payment).toMatch(/data-pay-pokemon="[a-z0-9-]+" disabled/);
    expect(payment).not.toMatch(/data-pay-pokemon="[a-z0-9-]+">/);
    expect(payment).not.toContain('data-pay-arm');
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
    expect(markupOf(hub)).toContain('<b>2/5</b>');

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

    const home = markupOf(hub);
    expect(home).toContain('ward bed');

    // The bed goes to the worse case. It waives the refill; the revive is still
    // charged, at the better bay's price.
    hub.recover(['pidgey-2']);
    expect(hub.pendingRecoveryMs).toBe(recoveryPrices(0.75).reviveMs);

    // No bed left, so the second treatment is charged in full at the bay's discount.
    const hurtPriceMs = recoveryCostMs(hurt.pokemon, terms);
    hub.recover(['pidgey-1']);
    expect(hub.pendingRecoveryMs).toBe(recoveryPrices(0.75).reviveMs + hurtPriceMs);
    expect(markupOf(hub)).not.toContain('ward bed');
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
      querySelector: (selector: string) => (selector === '.menu-status' ? { remove: removed } : null),
      querySelectorAll: () => [],
    };
    const timers: { callback: () => void; remove: ReturnType<typeof vi.fn> }[] = [];
    Object.assign(hub as unknown as Record<string, unknown>, {
      overlay: { root, focus: vi.fn() },
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

  it('keeps one timer, so an old message cannot cut a new one short', () => {
    const { internals, timers } = hubWithRenderCount();
    internals.setStatus('first');
    internals.setStatus('second');

    expect(timers).toHaveLength(2);
    expect(timers[0].remove).toHaveBeenCalledOnce();
    expect(timers[1].remove).not.toHaveBeenCalled();
  });
});
