/**
 * What `world.mts` says about a world: the plan's own problems, every seam, the
 * hard checks on the stitched map, and each drawn district's own report.
 */
import { allPassed, hardChecks, type HardCheck } from './checks';
import { formatReport, reportOn, type MapcraftReport, type MapcraftResult } from './report';
import { stitch, type StitchResult } from './stitch';
import {
  checkPlan,
  districtsOutOfReach,
  planBounds,
  planLimits,
  unreachableDistricts,
  type WorldPlan,
} from './worldPlan';

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
  const checks = hardChecks(stitched.file, { limits: planLimits(world.plan) });
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

/** A plan before anything is drawn: its districts, ways through, landmarks and caves, and what is wrong with it. */
export function formatPlan(plan: WorldPlan, from?: string): string {
  const bounds = planBounds(plan);
  const lines = [
    `${plan.name}: ${plan.districts.length} districts, ${bounds.columns * plan.districtSize}x${bounds.rows * plan.districtSize} tiles`,
    '',
    'Districts:',
    ...plan.districts.map(
      (district) =>
        `  ${district.name} (${district.terrain ?? 'unset'}, cell ${district.cell.join(',')}): ${district.idea}`,
    ),
    '',
    'Ways through:',
    ...plan.crossings.map(
      (crossing) =>
        `  ${crossing.hidden ? 'hidden ' : ''}${crossing.opens === 'night' ? 'night-only ' : ''}${crossing.kind} ${crossing.between.join(' - ')} at ${crossing.at}`,
    ),
    ...plan.exits.map(
      (exit) => `  way out '${exit.name}': ${exit.district}, ${exit.side} edge at ${exit.at}`,
    ),
  ];
  if ((plan.landmarks ?? []).length > 0) {
    lines.push(
      '',
      'Landmarks:',
      ...(plan.landmarks ?? []).map(
        (landmark) =>
          `  ${landmark.kind} '${landmark.name}' in ${landmark.district} near ${landmark.at.join(',')}`,
      ),
    );
  }
  for (const cave of plan.caves ?? []) {
    const mouths = cave.mouths.map(
      (mouth) =>
        `${mouth.district}${mouth.floor === undefined ? '' : ` onto floor ${mouth.floor}`}${mouth.locked ? ', locked to the Card Key' : ''}`,
    );
    lines.push(
      '',
      `${cave.name}: ${cave.floors} floors${cave.style && cave.style !== 'cave' ? ` (${cave.style})` : ''}, mouths in ${mouths.join('; ')}`,
    );
    if (cave.idea) lines.push(`  ${cave.idea}`);
  }
  if ((plan.sailings ?? []).length > 0) {
    lines.push(
      '',
      'Boats:',
      ...(plan.sailings ?? []).map(
        (sailing) =>
          `  ${sailing.name}: ${sailing.from.district} - ${sailing.to.district} across ${sailing.via.map((cell) => cell.join(',')).join(' then ')}, sails ${sailing.runs.from}s-${sailing.runs.until}s`,
      ),
    );
  }
  const far = [
    ...plan.districts.map((district) => ({ name: district.name, reach: district.reach })),
    ...(plan.caves ?? []).map((cave) => ({ name: cave.name, reach: cave.reach })),
  ].filter((place) => place.reach);
  for (const { name, reach } of far) {
    lines.push(
      '',
      `${name}, a far place:`,
      `  way in: ${reach!.wayIn}`,
      `  hard: ${reach!.hard}`,
      `  only here: ${reach!.onlyHere}`,
      ...reach!.needs.map((need) => `  needs: ${need}`),
    );
  }
  const problems = checkPlan(plan);
  const cutOff = from ? unreachableDistricts(plan, from) : [];
  const outOfReach = from ? districtsOutOfReach(plan, from) : [];
  lines.push(
    '',
    problems.length === 0 ? 'Plan: no problems' : 'Plan: FAILING',
    ...problems.map((problem) => `  x ${problem}`),
  );
  if (cutOff.length > 0)
    lines.push(`  note: no road or trail reaches ${cutOff.join(', ')} from ${from}`);
  if (outOfReach.length > 0)
    lines.push(`  x nothing - no road, boat or cave - reaches ${outOfReach.join(', ')} from ${from}`);
  return lines.join('\n');
}
