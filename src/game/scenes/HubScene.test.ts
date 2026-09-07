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
import type { ActiveRunSession } from '../run/RunSession';
import { createStartingStash } from '../stash';
import type { DeploymentFlow } from '../hub';
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
  readonly flow: DeploymentFlow;
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

describe('hub deployment route', () => {
  // The hub shares one process-wide run manager, so a started raid has to be
  // resolved before the next test can deploy again.
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
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
