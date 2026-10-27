# Enemies

![Earlier early-campaign encounter; blue rings indicate approach](../assets/screenshots/combat-desktop-v1.png)

## Numeric reference

{{ENEMY_TABLES}}

These are base numbers. Minion HP receives stage, star and enhanced-summon multipliers; only campaign HP adds the time-wave factor. Endless removes population compression and the time-wave HP multiplier. Each star promotion multiplies HP by 3.5 and ordinary damage by 2.5; enhanced summons multiply both by 1.5. Ordinary damage also receives stage damage. Poison independently starts at 10/s. Boss HP uses the resolved [stage table](Stages.md); elites have twice the same-star minion HP. Speeds use logical arena units per second.

## Campaign

Wisp / Sentinel / Hexer use a balanced 1:1:1 mix for routine enemies and escorts.

- **Wisp:** melee; arrives at its assigned defense position, prepares, then deals direct damage.
- **Prism Sentinel:** tougher melee with the same arrival requirement, without ranged fans.
- **Light Hexer:** prepares after y ≥120, shoots while advancing and stops in a lane slot. Fires one aimed shot and has no poison skill.
- Stage-three melee can prepare early, but cannot damage the player before arrival.

## Endless waves

Wisp / Colossus / Wizard retain the balanced species mix. Routine enemies, escorts and enhanced summons share the attack-region guarantee: after N successful admissions, at least ceil(N ×30%) spawned within open attack cells, including natural spawns there. Other admissions choose legal side-lane space; positions remain discrete and spaced, with the center boss corridor reserved. Full capacity or missing required-region space waits without consuming a budget credit or species/summon slot.

- **Taunting Colossus:** 10× Wisp base HP. Taunt lasts 2.5s. Before entering an attack region, attempts follow `{{ENDLESS_APPROACH_BASE}} × {{ENDLESS_TIMING}}` seconds after the initial random delay: first-layer {{ENDLESS_APPROACH_FIRST}}s, minimum {{ENDLESS_APPROACH_MIN}}s, 40% chance. Once attacking, each action chooses 40% taunt or otherwise melee. Attack-region priority remains; dangerous boss/elite charges stay selectable for interruption. Sanctuary disables taunt restrictions.
- **Venom Wizard:** 5× Wisp base HP. Each action chooses 40% poison or a ranged shot. Shooting and death do not poison. Poison lasts 3s, starts at 10/s, drains shield first and applies 90% wounds. Without shield it slows attack speed by 30%. Repeats add 3s and either +1/s damage or +1 percentage point slow. See [Mechanics](Mechanics.md).

Native one/two/three-star weights: layers 1–2 =100/0/0, 3–5 =75/25/0, 6–10 =45/45/10, 11+ =20/50/30. Stars cost 1/3/9 wave credits; exclude unaffordable choices before drawing. Display score scales with the represented units, while training credit is granted only from the finite encounter allocation. High-star endless minions divide received enemy-HP-derived damage, slow strength and stun duration by their star count. Fixed and player-HP damage, slow duration and all-basic-projectile Winter triggers remain; fusion preserves any already stronger effect.

## Fusion

Only ordinary endless minions fuse; elites and bosses cannot. Three same-kind, same-star units, alive at least 4s and mutually within the scaled 150-unit radius, must remain adjacent for 3s. Separation/group changes reset progress; stun blocks it, Sanctuary/pause freezes it. Maximum three stars; anchor ID and body size stay fixed.

New maximum HP is the highest donor maximum HP ×3.5, healed to full; ordinary damage takes the highest donor scale ×2.5. Enhanced flags persist. Absorption grants no kill, score, healing, explosion or poison. Display score on eventual death uses ×3^(stars−1). Training credit only sums the donors' existing credit, so adding an excess reinforcement cannot manufacture more training progress.

## Elites and main bosses

Layers 1–3 alternate waves and one elite before the main boss, with a Colossus on odd layers and Wizard on even layers. From depth 4, both elites share the segment between the two waves. Their total count, finite initial escorts, three supplies and pool capacity do not increase. Both leaders enter before their escort allocations; failed admissions wait and cannot repeat or spend a successful slot. Elites have two stars until layer 5 and three from layer 6, plus twice the equivalent ordinary HP.

Elites retain their Colossus or Wizard identity and ordinary control strength, using their own ward or ritual. Ordinary taunt and poison skills are cast only by minions. The boss bonus from Gaze of Weakness, Final Judgment's tier-6/9 charged-boss multiplier, half-strength slows and quarter-duration stuns apply only to main bosses. Elites do not inherit those exclusive modifiers or resistances. Eligible size-based, percentage-card and other judgment/control bonuses still apply, with enemy-HP components sharing the target's own percentage allowance.

An endless boss or elite keeps ordinary preparation and a full {{CHARGE_SECONDS}}s warning, without an additional 2.8s opening cooldown. From depth 4, the first preparation after attack permission and active charges advance through ordinary slow/stun, while movement and later recovery remain affected. Pause and Sanctuary still freeze the hostile clock. During an accepted effective stun and for {{LEADER_STUN_RECOVERY_SECONDS}}s afterward, it rejects further stun/freeze refreshes, including longer effects. The timer uses hostile time and freezes with pause, rewards and Sanctuary. Main bosses retain quarter-duration stuns/freezes, elites full-duration stuns/freezes, both with Dominion scaling. Damage, slow and cast interruption remain available; campaign control rules and Winter's all-basic-projectile hit counting remain. High-star minions use the resistance described above.

A Colossus elite charges a ward: successful release grants all living allies, including itself, 25% reduction for 3s. A Wizard elite charges a ritual: other allies heal 20% maximum HP and it fires three shots, without self-healing. Charges take {{CHARGE_SECONDS}}s. Depths 1–3 retain the displayed damage-or-{{INTERRUPT_HITS}}-hit rule. From depth 4, forming must finish before accumulation; the primary route needs fresh confirmation of that warning and current targeting, while damage interruption needs no confirmation. The thresholds and controls are detailed in [Mechanics](Mechanics.md). Successful casts recover for {{RECOVERY_SECONDS}}s; interruption consumes the cast and opens {{VULNERABLE_SECONDS}}s of weakness, with ordinary damage ×1.35 and percentage allowance ×{{VULNERABLE_MULTIPLIER}}. A primary hit during weakness adds a base {{WEAK_POINT_PERCENT}} target-maximum-HP component, sharing the same percentage bucket after modifiers. That new component grants no lifesteal; existing percentage-card basic damage remains eligible under the deep-endless recovery allowance.

Campaign boss arrival preserves existing enemies and hostile shots. Endless bosses arrive after their preceding segment is cleared. Initial escort allocations can grant training credit; recurring main-boss escorts and enhanced summons add display score only. Admission always respects physical space.

Campaign bosses retain their gold-charge and half-health patterns, with the same damage-or-{{INTERRUPT_HITS}}-primary-hit interruption and weak-point rules. Endless main bosses queue guard/summon/slam at 70/40/10% HP rather than releasing instant damage; the same charge/interruption lifecycle applies. With no threshold cast queued, the main boss charges one aimed projectile for {{CHARGE_SECONDS}}s and recovers for {{VOLLEY_RECOVERY_SECONDS}}s after releasing it. Queued threshold skills take precedence at the next cast; active casts are never replaced or overlapped. Main and elite enemy-HP damage components share their per-target allowance. Main-boss death cancels pending skill summons and recurring escorts, while any unfinished finite initial escort quota must still enter and clear. Living enemies and fired shots remain until cleanup. See [Stages](Stages.md) for resolved HP, damage and reward rules.
