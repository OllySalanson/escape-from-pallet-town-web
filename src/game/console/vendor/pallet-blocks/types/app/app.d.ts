/** What a finished game reports to its host. */
export interface GameOverResult {
    readonly score: number;
    readonly lines: number;
    readonly level: number;
    /** The name the score was recorded under, or null if no name was asked for. */
    readonly name: string | null;
    /** Time spent playing, not counting pauses. */
    readonly durationMs: number;
}
export interface LeaderboardEntry {
    readonly name: string;
    readonly score: number;
}
export interface PalletBlocksOptions {
    /**
     * Who is playing. When set, scores are recorded under this name and nobody is
     * asked to type one; it is also shown in the title bar.
     */
    readonly playerName?: string;
    /** Called once at the end of every game, after any name entry. */
    readonly onGameOver?: (result: GameOverResult) => void | Promise<void>;
    /**
     * Called when the player chooses EXIT on the title screen (or presses Esc
     * there). Without it, the title screen has no EXIT.
     */
    readonly onExit?: () => void;
    /**
     * Supplies a shared leaderboard to show in place of this browser's own high
     * scores. Called on start, after each game's `onGameOver` settles, and on
     * returning to the title screen.
     */
    readonly loadLeaderboard?: () => Promise<readonly LeaderboardEntry[]>;
    /** The level the LEVEL option starts on, 1 to 15. Default: the one this browser last picked, else 1. */
    readonly startLevel?: number;
    /** Start with sound off. The player can still toggle it with M. */
    readonly muted?: boolean;
    /** localStorage key for this browser's high-score table. */
    readonly storageKey?: string;
    /** Take keyboard focus on mount. Defaults to true. */
    readonly autoFocus?: boolean;
    /**
     * Deal every game from this seed, so the same pieces come in the same order.
     * For practice, races and tests; leave unset for a fresh shuffle each game.
     */
    readonly seed?: number;
}
/**
 * The whole game, mounted into one element: a canvas, the keyboard, the loop,
 * the screens, the sound and the scores.
 */
export declare class PalletBlocksApp {
    private readonly root;
    private readonly options;
    private readonly display;
    private readonly displayCtx;
    private readonly buffer;
    private readonly bufferCtx;
    private readonly sfx;
    private readonly localScores;
    private readonly resizeObserver;
    /** Puts the host's element back as it was before the game was mounted. */
    private readonly giveBack;
    private renderer;
    private current;
    /** Keys are ignored until this time, so a player still mashing drop at the end of a game does not skip what comes next. */
    private inputGuardUntil;
    private game;
    private startLevel;
    private nowMs;
    /** Like `nowMs`, but stopped while paused: in-play effects are timed by it. */
    private effectsMs;
    private lastFrame;
    private frame;
    private destroyed;
    private table;
    private leaderboard;
    private highlight;
    private reported;
    private lastName;
    private callout;
    private banner;
    /** Banners waiting for the one up now to finish. */
    private bannerQueue;
    private trail;
    private flash;
    private holdRefusedAtMs;
    /** Set by a hard drop, for the lock that follows it in the same batch of events. */
    private pendingDropDistance;
    private lastSoftDropSound;
    private readonly held;
    private readonly fresh;
    constructor(root: HTMLElement, options?: PalletBlocksOptions);
    private get screen();
    /** A new screen starts with no keys of its own: keys already down are not its. */
    private set screen(value);
    pause(): void;
    resume(): void;
    restart(): void;
    focus(): void;
    destroy(): void;
    private readonly tick;
    private update;
    private stepGame;
    private render;
    private handleEvents;
    /** Puts a banner up, or queues it behind the one already up. */
    private showBanner;
    private updateBanner;
    /** A level banner brings the jingle with it (and the renderer flashes the LEVEL row). */
    private raiseBanner;
    private onLock;
    private startGame;
    private finishGame;
    /** Saves the score under a name (if any), reports the game, and shows the results. */
    private record;
    private report;
    private refreshLeaderboard;
    private toTitle;
    private toPlaying;
    /** Move and soft-drop keys held while the game could not take them act now. */
    private pressHeld;
    private isLive;
    private acceptsGameInput;
    private titleItems;
    private titleLabel;
    private titleKey;
    private pausedKey;
    private resultsKey;
    private nameKey;
    /** The LEVEL choice is kept in this browser, like the sound setting, for next time. */
    private setStartLevel;
    private toggleMute;
    private readonly onKeyDown;
    private handleKeyDown;
    private readonly onKeyUp;
    private readonly onPointerDown;
    private readonly onFocusOut;
    private readonly onVisibilityChange;
    private readonly onWindowResize;
    private resize;
}
