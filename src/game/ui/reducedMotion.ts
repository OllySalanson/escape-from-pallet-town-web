/**
 * Whether the browser asks for reduced motion, as the title screen and the
 * harbour ask it (`TitleScene.still`, `BaseScene.still`). False wherever there
 * is no window to ask, so a test harness reads the ordinary motion.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
