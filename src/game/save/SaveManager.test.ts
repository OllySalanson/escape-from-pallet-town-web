import { describe, expect, it } from 'vitest';
import { Pokemon, PokemonParty, CHARMANDER, PIDGEY } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { SAVE_KEY, SaveManager } from './SaveManager';

class MemoryStorage {
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

describe('SaveManager', () => {
  it('round-trips party state and world position', () => {
    const charmander = new Pokemon(CHARMANDER, 12);
    charmander.takeDamage(9);
    charmander.primaryStatus = PrimaryStatus.Burn;
    const pidgey = new Pokemon(PIDGEY, 8);
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);

    expect(
      saves.save({
        party: new PokemonParty([charmander, pidgey]),
        mapId: 'route-1',
        position: { x: 7, y: 21 },
        items: ['potion'],
        stash: { items: ['poke-ball'] },
      }),
    ).toBe(true);

    const restored = saves.load();

    expect(restored).not.toBeNull();
    expect(restored?.mapId).toBe('route-1');
    expect(restored?.position).toEqual({ x: 7, y: 21 });
    expect(restored?.items).toEqual(['potion']);
    expect(restored?.stash.items).toEqual(['poke-ball']);
    expect(restored?.party.pokemon).toHaveLength(2);
    expect(restored?.party.pokemon[0]).toMatchObject({
      base: { id: 'charmander' },
      level: 12,
      currentHp: charmander.currentHp,
      primaryStatus: PrimaryStatus.Burn,
    });
    expect(restored?.party.pokemon[0].moves.map((move) => move.base.name)).toEqual(
      charmander.moves.map((move) => move.base.name),
    );
  });

  it('returns no save for corrupt or unsupported stored data', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);

    storage.setItem(SAVE_KEY, '{broken json');
    expect(saves.load()).toBeNull();
    expect(saves.hasSave()).toBe(false);

    storage.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
    expect(saves.load()).toBeNull();
  });
});
