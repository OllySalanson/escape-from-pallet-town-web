import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false } },
  },
}));

import { boutParty } from '../base/arenaBouts';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { BattleScene } from './BattleScene';

/**
 * The promise a bout for show in THE RAID ARENA rests on: it can never write to
 * the save. The fight is the real `BattleScene`, so it is held here against the
 * scene itself rather than against a stand-in, three ways: there is no code in the
 * scene that could do it without a run session, a bout has no run session and
 * cannot be started with one, and what happens to its fighters reaches nothing.
 */

const SOURCE = readFileSync(new URL('./BattleScene.ts', import.meta.url), 'utf8');

/** Each method of the scene that names the save, by the method it is written inside. */
function methodsTouchingTheSave(): readonly string[] {
  const methods = new Set<string>();
  let inside = '';
  for (const line of SOURCE.split('\n')) {
    const method = /^ {2}(?:private |public |protected )(?:async )?([a-zA-Z]+)\(/.exec(line);
    if (method) {
      inside = method[1];
    }
    if (/new SaveManager\(|localStorage|sessionStorage|indexedDB/.test(line)) {
      methods.add(inside);
    }
  }
  return [...methods];
}

class CountingStorage implements StorageLike {
  public readonly writes: string[] = [];
  private readonly held = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.held.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.writes.push(key);
    this.held.set(key, value);
  }
  public removeItem(key: string): void {
    this.writes.push(key);
    this.held.delete(key);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('a bout for show', () => {
  it('reaches the save nowhere: the scene only names it where a raid is lost, behind a run session', () => {
    expect(methodsTouchingTheSave()).toEqual(['resolveRunWipe']);
    const wipe = SOURCE.slice(SOURCE.indexOf('private resolveRunWipe(): void {'));
    expect(wipe.split('\n')[1].trim()).toBe('if (!this.runSession || this.pendingHubTransition) {');
    // And the only way into that is a raid's.
    expect(SOURCE).toContain('if (this.party.isAllFainted() && this.runSession?.manager.phase === RunPhase.InRun) {');
  });

  it('cannot be started on a raid', () => {
    expect(SOURCE).toContain("throw new Error('A bout for show cannot be fought on a raid.');");
  });

  const fightingScene = (party: readonly Pokemon[]): BattleScene => {
    const scene = Object.create(BattleScene.prototype) as BattleScene;
    Object.assign(scene as unknown as Record<string, unknown>, {
      exhibition: { rival: 'blue', at: { x: 32, y: 8 } },
      party: new PokemonParty([...party]),
      runSession: undefined,
      pendingResultScreen: false,
      returnScene: undefined,
      state: { outcome: 'victory' },
      scene: { start: vi.fn(), manager: { keys: { base: {} } } },
    });
    return scene;
  };

  it('pays nothing: no experience, so no level, no move and no evolving', () => {
    const stash = createStartingStash(CHARMANDER);
    const [copy] = boutParty(stash.listPokemon().map((each) => each.pokemon));
    const before = copy.experience;
    const scene = fightingScene([copy]) as unknown as { awardVictoryExperience(pokemon: Pokemon): unknown[] };
    expect(scene.awardVictoryExperience(new Pokemon(CHARMANDER, 50))).toEqual([]);
    expect(copy.experience).toBe(before);
  });

  it.each([[true], [false]])('goes home with only which way it went (won: %s), and writes nothing on the way', (won) => {
    const storage = new CountingStorage();
    vi.stubGlobal('localStorage', storage);
    const stash = createStartingStash(CHARMANDER);
    const saves = new SaveManager(storage);
    saves.save({ party: new PokemonParty([]), mapId: 'greystone-vale', position: { x: 1, y: 1 }, stash, starterSpeciesId: 'charmander', raidProgress: DEFAULT_RAID_PROGRESS });
    const written = storage.writes.length;
    const scene = fightingScene(boutParty(stash.listPokemon().map((each) => each.pokemon))) as unknown as {
      completeReturnToWorld(): void;
      state: { outcome: string };
      scene: { start: ReturnType<typeof vi.fn> };
    };
    scene.state = { outcome: won ? 'victory' : 'defeat' };
    scene.completeReturnToWorld();
    expect(storage.writes.length).toBe(written);
    expect(scene.scene.start).toHaveBeenCalledWith('base', {
      room: 'raid-arena',
      at: { x: 32, y: 8 },
      bout: { rival: 'blue', won },
    });
  });

  it('leaves one field of the save for the hall to write, and only that', () => {
    const storage = new CountingStorage();
    const saves = new SaveManager(storage);
    const stash = createStartingStash(CHARMANDER);
    saves.save({ party: new PokemonParty([]), mapId: 'greystone-vale', position: { x: 1, y: 1 }, stash, starterSpeciesId: 'charmander', raidProgress: DEFAULT_RAID_PROGRESS });
    const read = (): Record<string, unknown> & { raidProgress: Record<string, unknown> } => {
      const key = storage.writes[storage.writes.length - 1];
      return JSON.parse(storage.getItem(key)!) as Record<string, unknown> & { raidProgress: Record<string, unknown> };
    };
    const before = read();
    saves.recordBout('blue', true);
    const after = read();
    expect(after.raidProgress.bouts).toEqual({ beaten: ['blue'], ladders: 0 });
    delete after.raidProgress.bouts;
    delete before.raidProgress.bouts;
    expect(after).toEqual(before);
  });
});
