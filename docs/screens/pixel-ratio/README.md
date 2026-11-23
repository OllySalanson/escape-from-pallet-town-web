# A display scaled to 125%

A 1080p laptop at Windows' 125% display scaling gives the browser a 1536x730
window at a pixel ratio of 1.25. Taken in the machine's headless Chromium with
`Emulation.setDeviceMetricsOverride` (1536x730, deviceScaleFactor 1.25) on a
test-mode build, `?testmode=pixels`, standing outside the Pokemon Center after
CONTINUE. The crops are 200x120 screen pixels from the middle, blown up five
times with nearest-neighbour (`ffmpeg -vf crop=200:120:860:400,scale=1000:600:flags=neighbor`).

- `before-125.png`, `before-125-crop.png`: main at 4fe41b69. The canvas is 3x in
  CSS pixels, which is 3.75 screen pixels: game pixels come out three and four
  wide by turns, and the letters of the caption have strokes of two weights.
- `after-125.png`, `after-125-crop.png`: 2.4x in CSS, 3 screen pixels, every game
  pixel the same size. 3.2x (4 screen pixels) would not fit 730 tall, so the
  game is drawn smaller than before in this window: that trade is the question.
