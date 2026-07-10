# VerisKit brand assets

The logo kit for VerisKit, part of Baseframe Labs. Everything here derives from
two vector sources; the PNGs are exports for places that cannot use SVG.

## Files

```
svg/
  veriskit-icon.svg        App tile: dark rounded square + teal check-V. Use where a filled icon reads best (app icons, favicons, avatars).
  veriskit-mark.svg        The check-V alone on a transparent background. Use on your own colored surface.
  veriskit-mark-mono.svg   Single-color mark. Inherits currentColor, so set the color in CSS to recolor it.
  veriskit-wordmark.svg    Horizontal lockup: mark + "VerisKit". For light backgrounds.
png/
  icon-{16,32,48,64,128,256,512,1024}.png
  mark-{64,128,256,512,1024}.png
  wordmark-{512,1024}.png
favicon/
  favicon.png (32)         Browser tab icon.
  apple-touch-icon.png (180)
social/
  veriskit-og.svg / .png   1200x630 share card for Open Graph and Twitter.
```

## Palette

| Token | Hex | Use |
|---|---|---|
| Ink | `#0A2E33` | Wordmark text on light backgrounds, tile top |
| Ink deep | `#041418` | Tile bottom (gradient end) |
| Teal light | `#5EEAD4` | Mark gradient start |
| Teal | `#14B8A6` | Mark gradient end, accent, badges |
| Paper | `#EAFAF6` | Text on dark backgrounds |

The mark gradient runs `#5EEAD4` to `#14B8A6` on a diagonal. The tile background
runs `#0A2E33` to `#041418` top to bottom.

## Usage

- **Clear space.** Keep padding around the mark equal to at least half the
  height of the check-V. Do not crowd it with other elements.
- **Minimum size.** Do not render the mark below 24px, or the tile below 32px.
  Below that the stroke and corner radius stop reading.
- **On light backgrounds** use the wordmark or the tile as is.
- **On dark backgrounds** use the mark or `veriskit-mark-mono.svg` set to a
  light color. Do not place the dark-ink wordmark on a dark surface.
- **Do not** recolor the mark outside the palette, stretch it, rotate it, add a
  drop shadow, or reconstruct it from the letters. The check-V is the V in
  VerisKit lifting into a verification checkmark; keep that shape intact.

## Regenerating the PNGs

The PNGs are exported from the SVGs with `sharp`. There is no build step in the
package; regenerate them only when a source SVG changes, using a one-off script.
`sharp` is not a project dependency.
