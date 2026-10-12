/**
 * What `world.mts` says about a world: the plan's own problems, every seam, the
 * hard checks on the stitched map, and each drawn district's own report.
 */
import { allPassed, hardChecks, type HardCheck } from './checks';
import { formatReport, reportOn, type MapcraftReport, type MapcraftResult } from './report';
import { stitch, type StitchResult } from './stitch';
import type { WorldPlan } from './worldPlan';

/** What a world program module's default export returns: the plan, and the districts drawn so far. */
export interface WorldResult {
  readonly plan: WorldPlan;
  readonly districts: Readonly<Record<string, MapcraftResult>>;
}

export interface WorldReport {
  readonly stitched: StitchResult;
  readonly checks: readonly HardCheck[];
  readonly passed: boolean;
  readonly districts: Readonly<Record<string, MapcraftReport>>;
}

export function reportOnWorld(world: WorldResult): WorldReport {
  const stitched = stitch(
    world.plan,
    Object.fromEntries(Object.entries(world.districts).map(([id, result]) => [id, result.file])),
  );
  const checks = hardChecks(stitched.file);
  const districts = Object.fromEntries(
    Object.entries(world.districts).map(([id, result]) => [id, reportOn(result)]),
  );
  return {
    stitched,
    checks,
    passed:
      stitched.problems.length === 0 &&
      allPassed(checks) &&
      Object.values(districts).every((district) => district.passed),
    districts,
  };
}

export function formatWorldReport(world: WorldResult, report: WorldReport): string {
  const { plan } = world;
  const lines = [
    `${plan.name}: ${Object.keys(world.districts).length} of ${plan.districts.length} districts drawn, ${report.stitched.file.width}x${report.stitched.file.height} tiles`,
  ];
  lines.push(report.passed ? 'World: all pass' : 'World: FAILING');
  for (const problem of report.stitched.problems) lines.push(`  x ${problem}`);
  for (const check of report.checks.filter((entry) => !entry.passed)) {
    lines.push(`  x ${check.label}`, ...check.problems.map((problem) => `      ${problem}`));
  }
  lines.push(
    '',
    'Seams:',
    ...report.stitched.seams.map(
      (seam) =>
        `  ${seam.status === 'joined' ? 'ok' : seam.status === 'waiting' ? '..' : 'x '} ${seam.detail}`,
    ),
  );
  for (const [id, district] of Object.entries(report.districts)) {
    lines.push('', `== ${id} ==`, formatReport(district));
  }
  return lines.join('\n');
}
