# Enemies

![Real early campaign encounter; blue rings indicate approach](../assets/screenshots/combat-desktop-v1.png)

## Numeric reference

{{ENEMY_TABLES}}

Values are base numbers. Minion HP also receives stage, wave, population compression, star and enhanced-summon multipliers. Speed = base × stage speed × (1 + 0.05 × (wave − 1)). Ordinary damage = base × stage damage. Compression P multiplies HP by P and ordinary damage by √P; each fusion star multiplies HP by 3.5 and ordinary damage by 2.5; enhanced summons multiply both by 1.5. Poison remains independently based at 10/s with repeat escalation. Boss HP and fan use the [stage table](Stages.md). Speed uses logical arena units per second.

## Campaign

Wisp / Sentinel / Hexer spawn in a balanced 1:1:1 mix for routine enemies and escorts.

- **Wisp:** basic melee; arrives at its assigned defense position, prepares, then deals direct damage.
- **Prism Sentinel:** tougher melee with the same arrival requirement; does not fire ranged fans.
- **Light Hexer:** prepares after y ≥ 120, can shoot while advancing and stops in a lane slot. Fires one aimed hostile shot; it has no poison skill.
- Stage-three melee can prepare early, but cannot damage the player before arrival.

## Endless

Wisp / Taunting Colossus / Venom Wizard use a balanced 1:1:1 mix across routine waves, escorts and enhanced summons. These sources share an attack-region spawn guarantee: after N successful admissions, at least ceil(N × 30%) have spawned inside open attack cells. Natural random spawns there count too. Others choose a legal free upper-half side-lane slot each time. Positions are discrete, spaced, and exclude the center boss corridor. When full or lacking a required attack-region vacancy, wait without consuming the admission, mix or summon slot.

- **Taunting Colossus:** 10× Wisp base HP. Taunt lasts 2.5s. Before entering an attack region, it first waits a random delay, then attempts every `{{ENDLESS_APPROACH_BASE}} × {{ENDLESS_TIMING}}` seconds (d is the endless layer, starting at 1): {{ENDLESS_APPROACH_FIRST}}s in the first endless layer, down to {{ENDLESS_APPROACH_MIN}}s, with 40% probability. In attack phase each action chooses taunt with 40%, otherwise melee, never both. Attack-region priority still wins. Sanctuary disables taunt restrictions.
- **Venom Wizard:** 5× Wisp base HP. Each action chooses 40% poison, otherwise a ranged shot. Shooting/death do not poison. Poison lasts 3s, starts at 10/s, consumes shield first and applies 90% wounds. Without shield it slows total attack speed by 30%. Repeats add 3s and either +1/s damage or +1 percentage point speed reduction. See [Mechanics](Mechanics.md).

## Fusion

Endless only: three non-boss units of the same kind and star, each alive for at least 4s, must all stay within the fusion radius continuously for 3s. Purple progress rings show the process. Separation or group changes reset it, stun blocks it, Sanctuary/pause freezes it. Base proximity is 150 logical units and scales with lane spacing. Maximum three stars; body size and anchor ID stay unchanged.

New maximum HP = highest donor maximum HP ×3.5, immediately healed to full. Ordinary damage scale = highest donor scale ×2.5. Enhanced flags persist. Absorption is not a kill and grants no score, healing, explosion or poison. Killing the fused unit scores ×3^(stars−1). Gold stars and health bars show its level.

## Bosses and escorts

A boss preserves existing enemies and hostile shots on entry, occupies its reserved space and tries to add escorts; later batches arrive every 2s. Escorts do not spend the routine budget but respect physical capacity.

Campaign bosses fire fans after arriving and preparing. Damage during gold charge can interrupt. Below half HP, ordinary attacks accelerate and charge becomes shorter/harder to interrupt. Endless bosses attack anywhere on-screen, double ordinary shot damage after arriving, and use HP-threshold skills; below-half ordinary intervals also multiply by 0.8. Boss death cancels pending summons and future escorts, but minions, statuses and fired shots remain until full cleanup. See [Stages](Stages.md).
