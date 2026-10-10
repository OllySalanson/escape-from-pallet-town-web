import { BUILD_DATE, BUILD_VERSION } from './buildInfo';

/**
 * Where the player was when they pressed FEEDBACK, said in words a person can
 * read - so a message that only says "I got stuck" still says where.
 *
 * What is never in here is as deliberate as what is: no name, no address, no
 * location, nothing typed anywhere else. The browser line is the user agent,
 * which every web server is already sent, kept because a layout bug is so
 * often one browser's.
 */
export interface FeedbackDetail {
  readonly label: string;
  readonly value: string;
}

export interface FeedbackContext {
  /** The build the game came from: a commit, or `dev` on a local server. */
  readonly version: string;
  /** When that build was made, ISO 8601, or empty on a local server. */
  readonly builtAt: string;
  /** The screen in front of the player, in the game's own words. */
  readonly screen: string;
  /** Every scene that was running or paused, top last. */
  readonly scenes: readonly string[];
  /** What the screen itself knows: the map, the tile, the clock, the fight. */
  readonly details: readonly FeedbackDetail[];
  /** The browser window and the game's stage inside it. */
  readonly window: string;
  readonly browser: string;
  /** `normal`, `playtest` (the explorer run) or `try-it` (a map maker's try). */
  readonly mode: string;
  /** When the tab was pressed, ISO 8601. */
  readonly takenAt: string;
}

/**
 * A scene that can say more about where the player is than its own name.
 * Asked once, at the instant the tab is pressed, of every scene that is running
 * or paused - so a raid paused under the pack still says where the raid is.
 */
export interface ProvidesFeedbackContext {
  feedbackContext(): readonly FeedbackDetail[];
}

export function providesFeedbackContext(scene: unknown): scene is ProvidesFeedbackContext {
  return typeof (scene as Partial<ProvidesFeedbackContext> | null)?.feedbackContext === 'function';
}

/** Scene keys as a player would name the screen. */
const SCREEN_NAMES: Readonly<Record<string, string>> = {
  boot: 'Loading',
  title: 'Title screen',
  starter: 'Choosing a starter',
  base: 'The Harbour',
  hub: 'Base screen',
  world: 'Raid',
  battle: 'Battle',
  party: 'Raid party',
  bag: 'Raid pack',
  objectives: 'Field guide',
  extraction: 'Raid result',
  mapmaker: 'Map maker',
  'test-lab': 'Test lab',
};

/** The screen in front of the player: the top scene that is not the panel itself. */
export function screenName(scenes: readonly string[]): string {
  const top = [...scenes].reverse().find((key) => key !== 'feedback');
  return top ? (SCREEN_NAMES[top] ?? top) : 'Unknown';
}

export interface ContextInputs {
  readonly scenes: readonly string[];
  readonly details: readonly FeedbackDetail[];
  readonly viewport: { readonly width: number; readonly height: number; readonly pixelRatio: number };
  readonly stage: { readonly width: number; readonly height: number; readonly zoom: number } | null;
  readonly browser: string;
  readonly mode: string;
  readonly now: Date;
}

export function buildFeedbackContext(inputs: ContextInputs): FeedbackContext {
  const { viewport, stage } = inputs;
  const windowLine = `${viewport.width}x${viewport.height} at ${viewport.pixelRatio}x${
    stage ? `, game ${stage.width}x${stage.height} drawn ${stage.zoom}x` : ''
  }`;
  return {
    version: BUILD_VERSION,
    builtAt: BUILD_DATE,
    screen: screenName(inputs.scenes),
    scenes: [...inputs.scenes],
    details: inputs.details.map((detail) => ({ ...detail })),
    window: windowLine,
    browser: inputs.browser,
    mode: inputs.mode,
    takenAt: inputs.now.toISOString(),
  };
}

/** Everything that rides along with a message, one line each: what SEE IT ALL shows. */
export function contextLines(context: FeedbackContext): readonly FeedbackDetail[] {
  return [
    { label: 'Game version', value: context.builtAt ? `${context.version}, built ${context.builtAt}` : context.version },
    { label: 'Screen', value: context.screen },
    ...context.details,
    ...(context.mode === 'normal' ? [] : [{ label: 'Mode', value: context.mode }]),
    { label: 'Window', value: context.window },
    { label: 'Browser', value: context.browser },
  ];
}
