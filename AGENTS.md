# Development principles

- Use Bun for dependencies, tool execution and tests. Run JS CLIs with `bunx --bun`; commit `bun.lock`. Validate new stable Bun releases without an upper major-version restriction.
- Keep TypeScript strict. Browser modules must not import Bun-only or server-only APIs.
- Keep simulation rules in `src/game`, content in `src/data`, Phaser rendering in `src/game/scenes`, and DOM presentation in `src/ui`.
- Define cards and enemies as data. Use seconds, the fixed-step simulation, bounded pools and independent input coordinates; do not couple movement to frame counts or CSS pixels.
- Preserve touch controls, safe areas, narrow reward layouts, pause on background, and keyboard access. Keep rendering resolution independent of device DPR.
- Maintain meaningful Bun tests for changes to combat, cards, rewards, states and restart behavior. Use browser tests for input, rendering and responsive behavior.
- Keep README claims and validation boundaries aligned with the implementation. Use original or appropriately licensed assets; preserve `LICENSE` and third-party notices.
- This is a static frontend. Do not introduce accounts, databases or backend services without a concrete requirement.
- Keep dev / preview servers on loopback unless a protected access path is explicitly configured. Do not change firewall, DNS or production configuration as part of routine development.

Before committing: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`. For browser verification, build first, install the matching Playwright browsers, then run `bun run test:browser`. See README for environment and browser limitations.
