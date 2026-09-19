/**
 * What the map says about a drop-in point: an insertion a raid can start from
 * once the player has stood on it. The rule itself is `availableInsertionIds()`
 * in `../run/runGeneration`; this is only the wording, kept Phaser-free so it
 * can be tested as text.
 */

/**
 * The caption over a drop-in point. One short line, because a landing is
 * usually in a corner of the map that an exit, a gate and a boss are already
 * captioning: it says what the mark is and whether the lobby offers it yet. The
 * landing's own name is for the lobby and for the line spoken on reaching it.
 */
export function dropInCaption(reached: boolean): string {
  return reached ? 'DROP-IN READY' : 'DROP-IN POINT';
}

/** Said once, on the step that reaches a new drop-in point. */
export function dropInReachedLine(label: string): string {
  return `${label.toUpperCase()} reached. You can start a raid from here - it is yours whether or not this one gets home.`;
}
