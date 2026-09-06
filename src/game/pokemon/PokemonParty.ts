import type { Pokemon } from './Pokemon';

export class PokemonParty {
  private readonly members: Pokemon[];

  public constructor(initialPokemon: readonly Pokemon[] = []) {
    this.members = [...initialPokemon];
  }

  public get pokemon(): readonly Pokemon[] {
    return this.members;
  }

  public addPokemon(pokemon: Pokemon): void {
    this.members.push(pokemon);
  }

  public removePokemon(pokemon: Pokemon): boolean {
    const index = this.members.indexOf(pokemon);
    if (index < 0) {
      return false;
    }

    this.members.splice(index, 1);
    return true;
  }

  public movePokemon(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.members.length ||
      toIndex < 0 ||
      toIndex >= this.members.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const [pokemon] = this.members.splice(fromIndex, 1);
    this.members.splice(toIndex, 0, pokemon);
    return true;
  }

  public getHealthyPokemon(): Pokemon | null {
    return this.members.find((pokemon) => !pokemon.isFainted) ?? null;
  }

  public isAllFainted(): boolean {
    return this.members.length > 0 && this.members.every((pokemon) => pokemon.isFainted);
  }
}
