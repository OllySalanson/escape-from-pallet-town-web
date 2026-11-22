/**
 * What a job asks, as the rim says it after the job's name.
 *
 * The rim offered SEALED DISPATCH beside a Line survey by name alone, and a
 * newcomer could not tell what either meant (scenario loop, 22 Nov 2026). The
 * contract's own objective sentence, the one the field guide and the report
 * print, is what follows the name: its first letter lowered, its full stop
 * left to the line. Phaser-free, so it is tested here.
 */
export function jobAsks(description: string): string {
  const said = description.trim().replace(/\.$/, '');
  return said.charAt(0).toLowerCase() + said.slice(1);
}
