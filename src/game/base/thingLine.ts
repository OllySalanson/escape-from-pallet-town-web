/**
 * What a thing in the harbour says when it is faced: its name, then its
 * caption as the rest of the sentence - "MEDICINE BAG - back where Joy can
 * reach it." Only the caption's first letter is lowered, and not even that
 * when its first word is a name or written in capitals: lowering the whole
 * caption turned Nurse Joy into "joy" (veteran playtest, 20 Nov 2026).
 */
export function thingLine(name: string, note: string): string {
  return `${name} - ${asClause(note)}.`;
}

/** People a caption may open with, whose names keep their capital. */
const OPENING_NAMES = new Set(['Joy', 'Oak', 'Bill', 'Brock', 'Misty', 'Marlow']);

function asClause(note: string): string {
  const first = note.split(/[\s,.;:!?'’]/, 1)[0] ?? '';
  const shouted = first.length > 1 && first === first.toUpperCase() && /[A-Z]/.test(first);
  if (shouted || OPENING_NAMES.has(first)) {
    return note;
  }
  return note.charAt(0).toLowerCase() + note.slice(1);
}
