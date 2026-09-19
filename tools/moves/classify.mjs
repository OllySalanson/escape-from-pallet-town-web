// What this engine can say about one move, as one function.
//
// `coverage.mjs` counts with it and `tools/species/generate.mjs` builds the move
// catalogue with it, so the number in the README and the moves a Pokemon
// actually knows can never disagree: a move the count calls expressible is a
// move the catalogue holds, and one it does not is a move no species learns.
//
// The capability list is the contract. It is what `MoveBase` declares and
// `battleEngine.ts` reads, and nothing else - so a row moves out of `missing`
// only when the engine really grew.

/**
 * The 42 moves the audit found that no generic mechanism covers: each needs its
 * own hand-written rule behind a named effect id, and several (Metronome, Mimic,
 * Mirror Move, Sleep Talk, Transform) need the engine to run a move it was not
 * given, which is a structural ask rather than a field.
 */
export const BESPOKE = new Set([
  'aromatherapy', 'baton-pass', 'belly-drum', 'block', 'camouflage', 'conversion',
  'conversion-2', 'curse', 'destiny-bond', 'detect', 'disable', 'encore', 'endure',
  'focus-energy', 'follow-me', 'future-sight', 'grudge', 'helping-hand', 'imprison',
  'lock-on', 'mean-look', 'memento', 'metronome', 'mimic', 'mind-reader', 'mirror-move',
  'protect', 'psych-up', 'recycle', 'refresh', 'rest', 'role-play', 'sleep-talk', 'spite',
  'stockpile', 'substitute', 'teleport', 'transform', 'trick', 'roar', 'whirlwind',
  // Splash was on this list and should never have been: a move that does
  // nothing at all is exactly what a 0-power status move with no effects does,
  // and leaving it out took every move away from a level-1 Magikarp.
  // Swallow is Stockpile's other half: what it heals is what was stored, and
  // PokeAPI's flat 25% is only the first stack. It reads as expressible from
  // its own row alone, which is exactly why it is named here.
  'swallow',
]);

/** PokeAPI flags neither, so both are named by hand - the audit's own warning. */
export const CHARGE = new Set(['solar-beam', 'dig', 'fly', 'razor-wind', 'sky-attack', 'skull-bash', 'bounce']);
export const RECHARGE = new Set(['hyper-beam', 'blast-burn', 'frenzy-plant', 'hydro-cannon']);
/** Repeats for two or three turns and then confuses the user. Not modelled. */
const LOCK_IN = new Set(['thrash', 'petal-dance', 'outrage', 'rollout', 'ice-ball', 'uproar', 'bide']);

/**
 * Weather is a whole-field effect PokeAPI cannot tell apart from Light Screen
 * or Spikes, so the four are named here. `MoveEffects.weather` expresses all of
 * them; of the 151, seven learn Rain Dance by level, three Sandstorm, one Sunny
 * Day and none Hail.
 */
export const WEATHER = new Set(['rain-dance', 'sunny-day', 'sandstorm', 'hail']);

/** Volatile conditions with a lifetime of their own. Flinch is the one modelled. */
const VOLATILE = new Set([
  'trap', 'leech-seed', 'nightmare', 'perish-song', 'yawn', 'ingrain', 'disable',
  'protect', 'no-type-immunity', 'unknown',
]);

/**
 * A move whose damage is not the damage formula. PokeAPI gives each of these a
 * null power because there is no power to give - Seismic Toss deals the user's
 * level, Super Fang halves what is in front of it, Flail and Reversal read the
 * user's own health, Counter and Mirror Coat return what was just dealt. The
 * count used to call them plain damage and they would have imported as 0-power
 * moves that do nothing at all, which is the one outcome worse than leaving
 * them out.
 */
const OWN_FORMULA = new Set([
  'counter', 'dragon-rage', 'endeavor', 'flail', 'low-kick', 'magnitude', 'mirror-coat',
  'night-shade', 'reversal', 'seismic-toss', 'sonic-boom', 'spit-up', 'super-fang',
]);

export const classify = (move) => {
  if (BESPOKE.has(move.name)) return { ok: false, why: 'bespoke' };
  if (LOCK_IN.has(move.name)) return { ok: false, why: 'lock-in' };
  if (move.meta === 'ohko') return { ok: false, why: 'one-hit KO' };
  if (OWN_FORMULA.has(move.name)) return { ok: false, why: 'damage formula of its own' };
  if (WEATHER.has(move.name)) return { ok: true, why: 'weather' };
  if (move.meta === 'whole-field-effect' || move.meta === 'field-effect') {
    return { ok: false, why: 'field or side effect' };
  }
  if (move.meta === 'force-switch') return { ok: false, why: 'forced switch' };
  if (VOLATILE.has(move.ailment)) return { ok: false, why: 'volatile status' };

  // Everything below is a field on `MoveBase` and a branch in `applyMove`.
  const needs = [];
  if (CHARGE.has(move.name)) needs.push('two-turn charge');
  if (RECHARGE.has(move.name)) needs.push('recharge');
  if (move.priority !== 0) needs.push('priority');
  if (move.min_hits) needs.push('multi-hit');
  if (move.crit_rate > 0) needs.push('raised crit rate');
  if (move.drain > 0) needs.push('drain');
  if (move.drain < 0) needs.push('recoil');
  if (move.healing > 0) needs.push('healing');
  if (move.flinch_chance > 0) needs.push('flinch');
  if (move.ailment !== 'none') {
    needs.push(move.ailment_chance > 0 || move.effect_chance ? 'status on a chance' : 'status');
  }
  if (move.stat_changes.length > 0) {
    const accuracy = move.stat_changes.some((s) => s.stat === 'accuracy' || s.stat === 'evasion');
    needs.push(accuracy ? 'accuracy or evasion stage' : 'stat stage');
    if (move.target === 'user') needs.push('stat stage on the user');
    if (move.stat_chance > 0) needs.push('stat stage on a chance');
  }
  if (move.accuracy === null) needs.push('always hits');
  return { ok: true, why: needs.length === 0 ? 'plain damage' : needs.join(' + ') };
};
