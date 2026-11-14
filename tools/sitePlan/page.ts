/**
 * The site plan's page put together: `viewer.html` with the view's motion
 * (`viewMotion.mjs`) written into its script, and the plan into its slot.
 */

/** Where the page takes its plan, however a formatter has spaced it. */
const PLAN_SLOT = /\/\*__PLAN__\*\/\s*null/;
/** Where the page takes the functions that move its view. */
const MOTION_SLOT = '/*__MOTION__*/';

/** `viewMotion.mjs` as plain script: the same functions, declared in the page's own scope. */
export function motionScript(source: string): string {
  return source.replace(/^export /gm, '');
}

export function assemblePage(viewer: string, motion: string, plan: unknown): string {
  if (!viewer.includes(MOTION_SLOT) || !PLAN_SLOT.test(viewer)) {
    throw new Error('viewer.html has lost its /*__MOTION__*/ or /*__PLAN__*/ slot');
  }
  return viewer
    .replace(MOTION_SLOT, () => motionScript(motion))
    .replace(PLAN_SLOT, () => JSON.stringify(plan).replace(/</g, '\\u003c'));
}
