# Brand and logo versions

*Rewrite fate in the echoes.*

<img src="../assets/brand/echoes-mark-v2.svg" width="240" alt="Echo Compass, scalable game and documentation logo">

The documentation logo refines the existing four-point star and circular orbit into **Echo Compass**: a midnight field, antique gold, a negative-space diamond and offset echo rings. The SVG has a 512-unit viewBox and 2048×2048 default size; it remains sharp at any export resolution. The game header, modal emblems and favicon now share this exact SVG master with the README and Wiki. Combat sprites remain original procedural geometry; their source and raster dimensions are listed below.

| Version | Asset | Purpose |
| --- | --- | --- |
| v0 | [Original SVG](../assets/brand/echoes-mark-v0.svg) | Archived original game favicon |
| v1 | [AI concept PNG](../assets/brand/echoes-emblem-ai-v1.png) | Built-in image_gen exploration, native 1254×1254 transparent RGBA |
| v2 | [Editable SVG](../assets/brand/echoes-mark-v2.svg) | Hand-authored game and documentation mark, informed by v0/v1; resolution-independent |

![Preserved native AI concept, v1](../assets/brand/echoes-emblem-ai-v1.png)

The v1 prompt requested at least 2048 px, but the built-in tool delivered 1254 px. The original is preserved without claiming it is a 2K/4K image. v2 supplies a scalable master for high-resolution documentation. The tool did not expose a model version or seed; generation is not deterministic.

## Exact v1 prompt

{{LOGO_PROMPT}}

Generated 2026-10-22 through the built-in image_gen tool. Files and prompt are committed together. Future versions should keep prior masters and add a filename, date, prompt, tool, actual dimensions and usage record before changing references. The hand-authored v2 source is the SVG itself. These original project documentation assets use the repository's AGPL-3.0-or-later terms. [Asset registry](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/assets/brand/README.md).

## Game asset resolutions

Original geometric commands in `src/game/scenes/textures.ts` rasterize these sprites directly at 2× resolution, without upscaling old bitmaps. Display scale compensates for that factor, preserving body sizes and collision radii. These are actual texture-cache pixels, not on-screen dimensions.

| Texture | Logical canvas | Raster cache pixels |
| --- | --- | --- |
| `player` | 64×72 | 128×144 |
| `hexer` | 56×60 | 112×120 |
| `wisp` | 48×56 | 96×112 |
| `sentinel` | 64×64 | 128×128 |
| `tank` | 64×68 | 128×136 |
| `wizard` | 60×68 | 120×136 |
| `chest` | 72×64 | 144×128 |
| `boss` | 144×144 | 288×288 |
| `friendly-shot` | 16×32 | 32×64 |
| `hostile-shot` | 20×20 | 40×40 |
| `spark` | 8×8 | 16×16 |

The sigil cache grows from 420×420 to 840×840. The static background rasterizes at 2× with a 4096px width cap. The logical arena stays 800 units high, with desktop width 800–2400. The canvas backing scale follows its actual CSS display area within 1–2×, independently of DPR, avoiding enlargement of an 800px-high backing on a 1080p screen.

The defense-line marker uses native DOM text and an SVG shield, rendered at 12 CSS pixels on desktop and 11 CSS pixels on mobile. Its anchor follows the actual FIT canvas bounds, including letterboxing, and rounds to whole CSS pixels. The marker does not read DPR or intercept pointer input. Shield values use 12px desktop / 11px mobile text; reward changes and synergy previews keep an 11px minimum. Build-family progress uses 11px text with 12px details, stronger small-icon strokes and a visible keyboard focus outline.

A body slot is the 68×84 logical formation cell: on-screen footprint = logical size × actual canvas CSS scale. Lane spacing is measured separately; each monster's own radius determines its body diameter. Resizing updates display pixels without moving existing enemies or changing capacity or attack cells. In-game Help covers the core loop; the Wiki keeps the full reference.

Build attribute values use 16px native sans-serif text and tabular numerals, with brighter contrast than their labels.
