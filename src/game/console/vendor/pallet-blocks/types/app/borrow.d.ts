/** The parts of a host element the game changes while it is mounted. */
export interface BorrowedElement {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    readonly classList: Pick<DOMTokenList, 'add' | 'remove' | 'contains'>;
    readonly style: Pick<CSSStyleDeclaration, 'getPropertyValue' | 'getPropertyPriority' | 'setProperty' | 'removeProperty'>;
}
export interface Borrowing {
    readonly className: string;
    readonly attributes: Readonly<Record<string, string>>;
    /**
     * Inline styles by CSS property name. Use longhands only: putting back a
     * shorthand the host never set would also wipe the longhands it did set.
     */
    readonly style: Readonly<Record<string, string>>;
}
/**
 * Applies a class, attributes and inline styles to a host's element, and
 * returns a function that puts back exactly what was there before, so an
 * unmounted game leaves no focusable, labelled, dark box on the host page.
 */
export declare function borrowElement(element: BorrowedElement, borrowing: Borrowing): () => void;
