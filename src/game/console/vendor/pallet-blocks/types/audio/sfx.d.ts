/**
 * Sound effects, synthesised in the browser with Web Audio: square and
 * triangle voices and a little noise, the palette of a handheld's sound chip.
 * There are no audio files and no music.
 *
 * Browsers only let a page make sound after the player has done something, so
 * the audio context is created on the first key press (`unlock`). Until then,
 * and whenever Web Audio is missing, every call is a silent no-op.
 */
export type SoundName = 'move' | 'rotate' | 'softDrop' | 'hardDrop' | 'lock' | 'hold' | 'holdRefused' | 'clear1' | 'clear2' | 'clear3' | 'clear4' | 'spin' | 'allClear' | 'levelUp' | 'gameOver' | 'menuMove' | 'menuSelect' | 'pause' | 'ready' | 'go' | 'type';
export declare class Sfx {
    private isMuted;
    private context;
    private master;
    private noiseBuffer;
    constructor(muted?: boolean);
    get muted(): boolean;
    /** Muting also cuts what is still sounding or due, such as the end of a jingle. */
    set muted(muted: boolean);
    /** Creates (or resumes) the audio context. Call from a user gesture. */
    unlock(): void;
    /** Plays a sound now, or `delaySeconds` from now. */
    play(name: SoundName, delaySeconds?: number): void;
    close(): void;
    /** Every sound goes through the master volume, so dropping it silences them all. */
    private createMaster;
    private tone;
    private noise;
}
