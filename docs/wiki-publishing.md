# Bilingual guide and Wiki maintenance

[English guide](game-guide/Home.md) · [简体中文](game-guide/Home-zh-CN.md) · [Native Wiki](https://github.com/KnowSky404/destiny-echo-web/wiki)

`scripts/game-guide.ts` owns Chinese rule prose and runtime-derived reference data. `scripts/guide-pages.ts` assembles both languages; English catalog translations are shared with the game in `src/i18n/content.ts` (re-exported by `scripts/guide-catalog.en.ts`), while maintained English prose and supplementary bilingual pages live in `docs/wiki-content/`. Generated output is checked into `docs/game-guide/`.

## Change rules and documentation together

1. Review the Chinese prose against runtime rules. Review English prose/catalog and related specifications at the same time.
2. If the rules digest changed, inspect the English translation before updating `docs/wiki-content/reviewed-rules.txt` to the digest reported by the generator. The marker prevents silently carrying old English prose into a new rules revision; changing it alone is not translation review.
3. Run `bun run docs:generate`. Both languages, implementation and specifications belong in one atomic commit. Default page slugs are English; Chinese slugs end in `-zh-CN`.
4. Run `bun run docs:check`, `bun run typecheck`, `bun run lint`, `bun test` and `bun run build`. Follow [Development](game-guide/Development.md) for browser checks when required.
5. Update both changelog sources on each release. Record source and Wiki/PRE/PRO separately. Keep game language and language-persistence claims aligned with the implementation and browser verification.

The generator derives card IDs, stack limits, rarity, starting previews, enemy numbers and stage tables from runtime data, with English numeric tables translated from those same tables. Narrative translations are human maintained. The digest covers rule sources, not merely generated prose. `docs:check` validates generated content and local documentation asset references; navigation and language symmetry are covered by Bun tests.

## Images and logo

Versioned source assets live under `docs/assets/`: lossless screenshots and brand sources/prompts. See [Gallery](game-guide/Gallery.md) for capture instructions and actual dimensions, and [Brand](game-guide/Brand.md) for provenance. To refresh captures, build PRO and PRE, start loopback previews at 4197/4198 and run `bun run docs:screenshots`. This explicitly refreshes v1 filenames; create new version names before capture when preserving a new visual revision. Inspect every image. Debug stage-jump illustrations must be labeled as such.

## Publish after merge

Use a clean, verified main matching the reviewed merge. The Wiki is the separate Git repository `https://github.com/KnowSky404/destiny-echo-web.wiki.git`; GitHub requires the initial Home page to exist.

```sh
bun run wiki:publish --dry-run
bun run wiki:publish
```

Dry-run checks content/assets and lists the managed pages/files without accessing or modifying the remote. Normal publication clones the Wiki default branch, syncs the 22 bilingual content pages plus shared `_Sidebar.md` / `_Footer.md`, and copies versioned assets without resizing. Local guide links become native Wiki slugs; asset references become `raw.githubusercontent.com/wiki/...` URLs, so they work in both language pages. The script preserves unmanaged pages/assets, skips empty commits, uses a normal non-force push and confirms the remote SHA. It does not remove old asset versions.

Reuse the OS user's existing Git credential helper or GitHub CLI login. Never store tokens in source. If a concurrent push rejects publication, inspect the new remote edits before retrying; do not force push. Publication is explicit and independently verified from source push and PRE/PRO deployment. This documentation update authorizes Wiki publication, not game deployment.

GitHub reference: [Adding or editing Wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages).
