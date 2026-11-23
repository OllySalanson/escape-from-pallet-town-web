# A touch-only device's yard hint says it needs a keyboard

A tablet (a finger for a pointer, no key pressed) can tap past the title's keyboard notice and through Oak's lab: a tapped Poké Ball walks there and asks. In the yard the hint then said "[ARROWS] WALK" (or "[SPACE] CHARMANDER" with the partner in front), and nothing a finger could do moved anybody. Now the yard's line says "PLUG IN A KEYBOARD TO WALK" until a key goes down.

- `before.png`: main, 1024x768 with touch emulation, the yard after the starter.
- `after.png`: the same device after CONTINUE, partner in front.

Made with Chrome DevTools touch emulation and `Input.dispatchTouchEvent` taps on a test-mode build.
