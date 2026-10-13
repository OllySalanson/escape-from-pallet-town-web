/**
 * What `look.mts` says about a map program's result: the hard checks it has to
 * pass, the design moves it makes, and the pattern-language advice - in that
 * order, because a map that does not work is not worth critiquing.
 */
import type { MapFile, MapFileLimits } from '../../src/game/world/mapFile';
import { allPassed, hardChecks, type HardCheck, type WalkRule } from './checks';
import { measureMoves, type DesignMoves } from './measures';
import { patternAdvice, type PatternAdvice } from './patterns';
import type { TileRect } from './tiles';

/** What a map program module's default export returns. */
export interface MapcraftResult {
  readonly file: MapFile;
  /**
   * The part of the map the program drew, when it drew under or beside ground
   * it did not (a shipped town's edge): measured, advised on and pictured alone.
   */
  readonly district?: TileRect;
  /** The brief's promises, in walking steps. */
  readonly rules?: readonly WalkRule[];
  /** What the brushes noticed (`MapProgram.notes`). */
  readonly notes?: readonly string[];
  /**
   * What the file may hold: a player's map's unless it is part of the game's
   * own (a district of a plan marked `builtIn` - `planLimits`), which may, for
   * one, stand a legend.
   */
  readonly limits?: MapFileLimits;
}

export interface MapcraftReport {
  readonly checks: readonly HardCheck[];
  readonly passed: boolean;
  readonly moves: DesignMoves;
  readonly advice: readonly PatternAdvice[];
  readonly notes: readonly string[];
}

export function reportOn(result: MapcraftResult, limits = result.limits): MapcraftReport {
  const checks = hardChecks(result.file, { rules: result.rules, trees: result.district, limits });
  return {
    checks,
    passed: allPassed(checks),
    moves: measureMoves(result.file, result.district),
    advice: patternAdvice(result.file, { crop: result.district }),
    notes: result.notes ?? [],
  };
}

export function formatReport(report: MapcraftReport): string {
  const lines: string[] = [report.passed ? 'Hard checks: all pass' : 'Hard checks: FAILING'];
  for (const check of report.checks) {
    if (check.passed) continue;
    lines.push(`  x ${check.label}`);
    for (const problem of check.problems) lines.push(`      ${problem}`);
  }
  const m = report.moves;
  lines.push(
    '',
    'Design moves:',
    `  border ${m.frameDepth} deep, road ${Math.round(m.roadShare * 100)}%, lawn ${Math.round(m.plainShare * 100)}%, tall grass ${Math.round(m.tallShare * 100)}% in ${m.beds} beds`,
    `  ${m.ledges} ledge pieces, median ${m.ledgeLen} long, ${Math.round((m.ledgeParallel ?? 0) * 100)}% stacked; ${m.fenceRuns} fence runs; ${m.clusters} free-standing groups`,
    `  biggest open patch ${Math.round(m.biggestQuiet * 100)}%; ${m.eventsPer10} changes per ten steps along the main walk`,
    '',
    'Pattern language:',
  );
  for (const advice of report.advice) {
    lines.push(`  ${advice.ok ? 'ok' : '->'} ${advice.move}: ${advice.found}`);
    if (!advice.ok) lines.push(`       ${advice.advice}`);
  }
  if (report.notes.length > 0)
    lines.push('', 'Brush notes:', ...report.notes.map((note) => `  ${note}`));
  return lines.join('\n');
}
