/**
 * Where a species' battle sprites are and what a battle calls them - its own
 * colours, and its shiny ones (`shiny.ts`). Nothing imported, so a menu can
 * name a picture without pulling in the species tables.
 */
export type SpriteSide = 'front' | 'back';

/** Where a species' battle sprite is, in its own colours or its shiny ones. */
export function pokemonSpritePath(side: SpriteSide, dexId: number, shiny = false): string {
  return `assets/pokemon/${shiny ? 'shiny/' : ''}${side}/${dexId}.png`;
}

/** The texture a battle draws a species from, by side and colours. */
export function pokemonTextureKey(side: SpriteSide, dexId: number, shiny = false): string {
  return `pokemon-${shiny ? 'shiny-' : ''}${side}-${dexId}`;
}
