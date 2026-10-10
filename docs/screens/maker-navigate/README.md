# Finding your way round a huge map

`tools/playtest/makerNav.mjs` against a test-mode build, 1280x800, on a
256x256 map.

- `before-no-overview.png`: a 256x256 map with nothing to say where in it the
  window is, and a quarter as the furthest zoom - four screens across.
- `after-1-overview.png`: the overview in the corner, the window's view
  outlined on it; a press or a drag on it moves the window there.
- `after-2-fit.png`: FIT, standing back to the new 1/8 zoom.

Also played there, with real input: Ctrl and the wheel zoom a step about the
tile under the pointer (it stays under the pointer to a fifth of a tile), the
middle button and Space-and-drag move the map with the pointer and draw
nothing, and a Fill of a whole 256x256 field takes milliseconds rather than
the 33 seconds it took.
