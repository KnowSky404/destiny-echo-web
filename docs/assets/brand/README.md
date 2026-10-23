# Brand asset versions / 品牌素材版本

English · [中文说明](#中文说明)

**Tagline:** Rewrite fate in the echoes. / 在残响中，改写命运。

| Version | Asset | Source and resolution | Use |
| --- | --- | --- | --- |
| v0 | [Original mark](echoes-mark-v0.svg) | Archived copy of the existing 64-unit SVG favicon | Historical reference |
| v1 | [AI emblem](echoes-emblem-ai-v1.png) | Built-in image_gen; native 1254 × 1254 RGBA PNG | Concept artwork, preserved without resizing |
| v2 | [Echo Compass](echoes-mark-v2.svg) | Hand-authored SVG, 512-unit viewBox, 2048 × 2048 default output | Current game / favicon / README / Wiki logo; resolution-independent |

![Documentation logo](echoes-mark-v2.svg)

v2 refines the original four-point star and circular orbit, informed by the v1 exploration. It uses a midnight background, restrained gold, an open diamond center, and offset echo rings. SVG remains sharp at any export size. The AI concept is **1254 px native**, not a 2K/4K master; no upscaled file is presented as a new original.

[Exact v1 prompt](prompt-v1.txt). Generated 2026-10-22 with the built-in image_gen tool; the tool did not expose a model/version selector or seed. Its requested 2048 px size was not honored. Preserve this prompt and the original PNG when iterating; generation is not deterministic. v2 source is the editable SVG itself. These original project documentation assets are distributed under the repository's AGPL-3.0-or-later terms; no third-party branding is used.

For a new version, add a sibling filename, record its prompt/tool/date/native dimensions and purpose, and update consumers deliberately. Do not overwrite older masters. The game uses an identical v2 SVG at `public/brand/echoes-mark.svg` and `public/favicon.svg`; keep both consumers synchronized with this master.

## 中文说明

v0 归档原游戏图标；v1 是内置 image_gen 生成的原生 1254×1254 透明 PNG，完整提示词保存在 `prompt-v1.txt`；工具没有提供模型版本和种子选项，也没有按提示词输出 2048px，因此明确保留实际分辨率，不冒充 2K/4K 原图。

v2 为文档采用的「回响罗盘」SVG，以原四芒星与圆环为基础，参考 v1 的轨道意象，重新手工绘制为清晰、可编辑、可任意分辨率导出的矢量标志。默认尺寸 2048×2048，现同步用于游戏页头、弹窗徽记、favicon、README 和 Wiki。游戏文件 `public/brand/echoes-mark.svg` 与 `public/favicon.svg` 保持与此母版一致。素材按仓库 AGPL-3.0-or-later 条款提供；

后续新增版本时保留旧文件，记录提示词、工具、日期、原始尺寸和用途，再更新引用。

Runtime sprite and canvas sizes: [English registry](../../game-guide/Brand.md#game-asset-resolutions) · [游戏素材分辨率](../../game-guide/Brand-zh-CN.md#游戏素材分辨率).
