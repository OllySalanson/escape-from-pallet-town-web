/**
 * What Oak's radio says when a fight leaves somebody nearly out and the pack
 * could heal them before the next one.
 *
 * The in-fight hint (`battlePresentation.lowHpItemHint`) cannot help when the
 * next wild Pokémon moves first: a scripted newcomer came out of a fight with
 * Bulbasaur on 4 HP, walked on through the grass, and a Pidgey's opening Tackle
 * took the raid before a command was asked for (scenario loop, 22 Nov 2026).
 * Nothing between fights said a Potion can be given from the pack. This says
 * it, after a fight, until the player has opened the pack once (B is learned):
 * then they know where the Potions are. Phaser-free, so it is tested here.
 */

/**
 * Below this share of its HP, a Pokémon is worn out enough to be named: the
 * rim's own "hurt" (`hub/railWarning.ts`). It was a quarter, and a Squirtle
 * came out of its first wild fight on 6/22, walked on unwarned, and the first
 * raid's hunter took the raid at 0:43 (scenario loop, 22 Nov 2026). The line
 * only speaks until the pack has been opened once, so it cannot nag.
 */
export const FIELD_HEAL_SHARE = 1 / 2;

export interface FieldHealMember {
  readonly name: string;
  readonly currentHp: number;
  readonly maxHp: number;
}

/** The line, or null when nobody standing is below half, there is nothing to give, or the pack is already known. */
export function fieldHealHint(
  team: readonly FieldHealMember[],
  medicine: string | null,
  packKnown: boolean,
): string | null {
  if (packKnown || medicine === null) {
    return null;
  }
  const worn = team.find((member) => member.currentHp > 0 && member.currentHp < member.maxHp * FIELD_HEAL_SHARE);
  return worn
    ? `OAK: ${worn.name.toUpperCase()} is worn out! Press B for your pack and give it a ${medicine.toUpperCase()} before the next fight.`
    : null;
}
