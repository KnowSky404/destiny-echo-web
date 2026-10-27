# Builds and stages

This contract describes the current simulation. The Chinese player guide and GitHub Wiki share `scripts/game-guide.ts`. Local tests, browser acceptance, Wiki publication, PRE and PRO are separate results.

## Arena geometry

Portrait starts at 450×800 with four minion lanes. Desktop computes its logical width from the available viewport (`(width−28)/(height−74)×800`, bounded to 800…2400). At 1920×1080 this yields about 1505×800 and six lanes. Wider screens can add more lanes. Geometry is previewed at page entry and recalculated when starting or restarting a run. Window resize, pause, stage transitions and Endless continuation keep that run's geometry fixed; DPR never changes combat. `arenaDisplayMetrics` uses actual canvas CSS bounds to convert lane spacing and 68×84 formation cells into screen pixels. A geometry change rebuilds the renderer while keeping the same World and PRE profile/session.

`arenaLayout` reserves a 136-unit center corridor for the boss, distributes minion lanes across both wings, and uses those exact positions for campaign spawns, endless formations and the lower attack markers. Six rows fit at 84-unit spacing. Thus portrait admits 24 minions plus a boss; six-lane desktop admits 36 plus a boss. The bounded pool has 65 objects to cover the largest supported layout. All bodies and persistent bars/rings/stars fit their slots; fusion preserves body size.

Ordinary budgets, escort batches and budget ceilings scale by `laneCount/4`. Campaign simultaneous counts cannot exceed the physical encounter capacity. Initial player damage is `12×laneCount/4` to match the wider population; other initial stats are unchanged. Friendly projectile speed is `620×sqrt(arena.width/450)` so wider shots retain useful travel time. AOE radii, lightning jumps and fusion proximity scale by `laneGap/69.5`; monster bodies, row spacing and timers retain their own units. This gives desktop its own geometry and capacity while sharing combat rules with portrait.

## Expanding endless attack regions

The enemy field is a `laneCount×7` grid of 100-unit-high cells at logical `y=0…700`. The player's row at `y=700…800` is excluded from selection and cell counts. The two baseline rows at `y=500…700` start active, covering the first two defense rows. Every completed endless stage chooses two distinct inactive cells, uniformly without replacement, using an independent seeded RNG; baseline cells and every previously activated cell are excluded. They persist through subsequent stages; fewer than two remaining cells are all activated, and coverage of the entire enemy field stops growth. Campaign clearance and entering endless do not add cells. Restart restores the baseline. Pause, rewards and resizing do not reroll.

All active regions, including the baseline, use blue/gold star positions, corner marks and faint connecting lines at their actual bounds; the HUD reports active/total. Endless melee enemies may prepare and attack inside an active cell before reaching their stopping position. Their existing arrival permission remains; ranged enemies retain their ranged permission and the boss retains anywhere permission. Target priority, secondary allocation and homing use the same permission predicate. Leaving a region before arrival revokes preparation. Sanctuary still freezes hostile action and disables taunts.

## Endless spawn positions and attack-region quota

Ordinary minions, boss escorts and enhanced summons share one per-stage successful-admission counter. After any N successful admissions, at least `ceil(N×CONFIG.endless.attackRegionSpawnRatio)` must have spawned inside active attack regions; the default ratio is **30%**. A naturally random spawn inside an active region counts toward that quota and can avoid a later forced admission. The counter resets for each endless stage; bosses do not participate and still enter from the top center.

When the next successful admission needs an attack-region spawn, choose a random legal empty lane position inside an active region. Otherwise, choose from all legal empty positions in the upper-half wing lanes on every admission, including gaps ahead of existing minions. Candidates are discrete lane positions with body clearance, rather than every pixel or every attack cell; the center corridor stays reserved for the boss. Full capacity, no legal position, or no legal attack-region position when the quota requires one delays admission without consuming successful counts, species order or pending summons. Existing movement and formation compaction continue after spawning.

## Cards, families and first-stage restrictions

There are **51 augments across 12 families**, including one once-per-run epic per family. Augments add one family layer per selection; duplicate upgrades count. All families have 3/6/9 thresholds, retain lower-tier benefits, and can coexist. Eight numeric trainings change base stats without adding family layers.

Stage one only offers barrage, might, precision and storm cards, including their epics. All other families unlock in stage two: self-explosion, blood, bastion, judgment, frost, dominion, giant slayer and erosion. Filtering applies before focused offers and epic promotion, including the boss augment. First-stage score/boss training excludes lifesteal. This prevents a plain blast-family damage card from accidentally unlocking early self-explosions.

Guided choices keep two main-family candidates while the main family has fewer than nine stacks, retaining a foundational upgrade. At nine stacks the slots become continuation / fixed complement / free; shortages use the remaining eligible pool. Complement pairs: barrage↔precision, might↔giantslayer, blast↔erosion, blood↔bastion, frost↔dominion, judgment↔storm. Ties for main family use fixed data order. Epic promotion replaces at most one slot.

Final guided-offer epic rates are 10/15/20/25% across campaign stages 1–4 and 30% in endless, with no three-acquisition gate. A boss offers two trainings plus a single augment that rolls its rarity directly at the same rate; it does not dilute the epic chance by selecting one of three drawn cards. No eligible epic means an ordinary fallback, without a deferred guarantee. PRE's explicit weighted mode remains a pure weighted pool, including epics. Eligibility, membership, phase and one-use reward tokens remain authoritative.

### Giant slayer and percentage erosion

| ID / family | Effect per layer | Cap |
| --- | --- | --- |
| giant-slayer / giantslayer | Primary direct hit adds 0.25% target maximum HP | 4 |
| titan-breaker / giantslayer | Direct shot bonus `4%×log₂(1+enemy.maxHP/player.maxHP)` | 4 |
| colossus-hunt / giantslayer | Direct shot +15% when target maxHP≥5×player maxHP | 4 |
| godfall / giantslayer, epic | Max-HP primary damage +0.75%; size coefficient +8%; giant bonus +20% | 1 |
| life-rend / erosion | Primary direct hit adds 0.2% target maximum HP | 4 |
| decay / erosion | Primary direct hit adds 1% target current HP | 4 |
| entropy / erosion | Every 4s, damage every enemy for 0.5% of its own maximum HP | 4 |
| event-horizon / erosion, epic | Max-HP primary damage +0.6%; current-HP damage +2%; pulse +1% | 1 |

Giant slayer tier 3 multiplies that family's max-HP coefficient by1.25; tier6 adds50% direct damage against giants; tier9 replaces the coefficient multiplier with2. Erosion tier3 multiplies its percentage coefficients by1.25; tier6 reduces pulse interval to3s; tier9 uses2× coefficients and2s pulses.

Primary max-HP coefficients from both families sum before a5% cap; current-HP coefficient caps10%. These components do not gain critical/heavy multipliers; victim-dependent stage/control bonuses and boss reduction still apply. Secondary shots, splash, lightning and counters do not recursively trigger the percentage components. Primary penetration can trigger once on each new victim. Pulses use each living victim's own maxHP and cap5% before victim-dependent bonuses/reduction. They do not damage chests. All enemy-HP-derived components share each main/elite boss's allowance after modifiers: 2.5%/5% maximum HP per second, storing at most 0.25 seconds. Weakness doubles the rate without refilling the bucket. This includes source-HP explosion terms and target-HP sacrifice terms; fixed and player-HP-derived components keep their ordinary path. Endless minions above one star divide received enemy-HP-derived components by their star count; fixed and player-HP components retain their path. Final-phase execution remains a separate threshold effect.

### Explosion and shield damage

A kill explosion uses `(16 + sourceMonster.maxHP×3%)×max(1,fuse layers)` before the blast-family multiplier. Sacrifice uses `(20 + targetMonster.maxHP×2%)×max(1,bloodpact layers) + player.maxHP×15%`; blast9 changes the player component to45%. Blast3/9 multiply the whole explosion by1.4/2; base radius130 becomes160/190. Blast6 permits iterative chain kills. Sacrifice costs at most3HP, leaves at least1HP, and repeats every5/4/3s depending on tier. Its cost is not an incoming hit.

Any effective incoming hit, including fully shielded hits, makes thorns damage **every active enemy** for18 per layer. Bastion6 doubles thorns and adds25% player maxHP to each victim; bastion9 uses50%. This has no radius cutoff or current-target requirement. Boss death midway through a counter does not erase or skip escorts. Invulnerable hits, poison ticks and sacrifice do not trigger counters. A lethal player hit ends the run before retaliation.

Bastion3 restores10 shield every3s up to60% maxHP; tier9 restores20 up to100%. Blood/card overheal conversion and shield leech keep their existing capacities; direct shields above the conversion cap are preserved.

## Wounds, poison and recovery

Wounds reduce **healing, health regeneration and new shields by90%**. Reapplication only extends duration, never increases the90% strength. Poison adds3s of wounds on every application. Existing HP, shields and max-HP upgrades are not removed by wounds.

All recovery paths share the penalty: fixed card heals/shields, lifesteal, kill healing, regeneration, timed bastion shields and dominion kill shields. Overheal is calculated from already-reduced healing; conversion does not pay a second wound penalty. Between-stage restoration cleanses first. Examples: vitality heal30→3, ward shield24→2.4, aegis heal80→8 and shield60→6.

From endless depth4, raw lifesteal requests share a per-player allowance of `player.maxHP × effectiveLifesteal ×0.25` per player combat second, with0.25s capacity. Spend it before recovery bonus, wounds and overheal conversion; other healing keeps its existing path. Pause/rewards/visual-only clearance do not refill it, while Sanctuary retains player time and refill. Rate/maximum-HP changes clip or refill normally without granting a fresh bucket; stage entry/restart creates at most one quarter-second allowance. Campaign and depths1–3 are unchanged.

Poison starts at **10 damage/s for3s**, consumes shield first, bypasses hit invulnerability and does not trigger retaliation. It no longer inherits concentration, star, summon or ordinary damage multipliers. Each repeat adds3s to remaining duration and independently chooses exactly one: **+1 damage/s or +1 percentage point of total attack-speed reduction**. Existing poison bonuses persist until expiry/cleanse.

With poison active and no shield, final attack speed is reduced by30% plus accumulated percentage points, capped90% so the firing interval stays finite. The interval is divided by the remaining speed fraction. Obtaining any shield immediately suppresses this penalty; exhausting shield restores it. Poison expiry removes the slow and escalation; there is no separate trailing slow. HUD shows remaining poison/wounds, actual DPS and current total speed reduction. Pause/rewards freeze statuses. Sanctuary cleanses before that step's damage.

## Stage lifecycle and boss health

The four encounters retain their authored themes, boss appearance times, gold-charge interruption and half-health patterns. The adopted profile in `src/data/balance/official.json` independently calibrates campaign minion HP, boss HP, damage, movement and attack timing; inspect the generated [stage tables](game-guide/Stages.md) for the resolved values. Campaign base budgets are 40/60/90/135; escort packs are 4/6/9/14 every 2 s. Values shown here are portrait baselines before lane scaling. Campaign species remain wisp/sentinel/hexer in equal successful-admission bags; endless uses wisp/tank/wizard. Boss entrance preserves current enemies, statuses and bullets, and uses the reserved corridor.

**Main-boss death stops recurring reinforcements and queued skill summons, while all surviving minions and hostile shots stay active.** Unfinished finite endless initial escorts must still enter and clear. Only after the final minion dies does the stage clear: grant display-only clearance score, cancel hazards and stale locks, cleanse, retain the0.8s visual afterglow, then offer rewards. The player can die during cleanup. Fourth-stage reward precedes Victory; other stage reward claims restore up to35HP and retain build/shield/score before advancing. Ending/restart behavior remains one-use and run-local.

Endless uses the **resolved official fourth encounter** as its baseline, including minion/boss HP overrides. For depth d≥1, shared health growth is `G=(1+0.3d+0.2d²)×(1+0.08max(0,d−5))`. Remove time-wave HP and population compression from endless; campaign retains its own time-wave HP behavior. Main-boss HP is the rounded larger of resolved-finale boss HP×G and 1.8×same-layer enhanced three-star tank HP, followed by the configured boss-base HP adjustment. Refer to generated [stage tables](game-guide/Stages.md) for the actual current profile rather than copying an old 11,000 HP constant.

A four-lane endless layer has at most 72 ordinary basic-unit credits, split between two waves; batches use at most four escorts, with geometry scaling and configured caps. Native one/two/three stars spend 1/3/9 credits. Layers 1–2 use weights100/0/0, 3–5 use75/25/0, 6–10 use45/45/10 and 11+ use20/50/30, excluding unaffordable stars before sampling. HP multipliers are1/3.5/12.25, ordinary damage1/2.5/6.25. Physical capacity and legal spawn positions remain bounded.

Layers1–3 follow wave1→elite→wave2→main, with a tank on odd layers / wizard on even layers. Layer4+ follows wave1→tank+wizard together→wave2→main. Preserve the original two elite allocations, finite escorts, three supplies and physical capacity. Admit both leaders before their fixed initial escorts; only successful admissions advance the cursor, deaths do not rewind it, and failure spends no quota. Every allocated leader/initial escort must enter and the field must clear before a1.5s break. Elites have2×the corresponding same-star minion HP, two stars until layer5 and three from layer6, and cannot fuse. There is no fixed endless boss timer.

Main-boss HP crossings at70/40/10% enqueue guard/summon/slam with equal independent probabilities. Each cast charges2.4s, accepts focused interruption, then either releases and recovers1.5s or is consumed by interruption. Interruption opens2s weakness: ordinary damage×1.35 and enemy-HP allowance×2. Guard gives90% self reduction for3s; summons add6 enhanced minions with a bounded queue; slam goes through ordinary damage, respecting shield and invulnerability. Tank-elite ward gives all living allies25% reduction for3s; wizard ritual heals other allies20%maxHP and fires three shots. From depth4, each slam is further capped at45% player maximum HP before the ordinary shield/invulnerability path. This is a single-slam limit, not a ceiling on combined incoming damage. Death clears pending casts.

Campaign and depths1–3 retain the original damage-or-four-primary interruption. From depth4, the first `min(0.8s, chargeSeconds/3)` of a warning accumulates no interruption damage/hits, while attacks still damage and trigger Frost. Afterward, damage needs no input confirmation and has a floor of10% main-boss /25% elite maximum HP. The primary route needs a fresh native selection during this warning, plus the leader remaining the current target; its threshold is `max(profileHits,min(12,6+floor((d−1)/4)))`. Tap/reselect, T or F can confirm even during forming; auto targeting and an old sticky selection cannot confirm the next cast. Either route consumes the cast.

From depth4, the first preparation after attack permission and active leader charges use hostile time through slow/stun. Movement and subsequent recovery retain the affected enemy clock. Pause, selection and Sanctuary freeze hostile time. Endless leaders also reject stun refreshes during the accepted duration and0.4 hostile seconds afterward. Main-boss stuns retain quarter duration, elites full duration, with Dominion scaling. High-star endless minions divide new slow strength and stun duration by stars, preserving slow duration, existing stronger effects and all-basic-projectile Frost procs.

Display score and training credit are separate. Only finite-budget kills add training credit; clearance HP bonuses, recurring excess escorts and enhanced skill summons add display score only. Record credit at admission; fusion sums existing credit without synthesizing more. Cumulative automatic threshold is `T(n)=5000n+750n(n−1)`, with marginal costs5000,6500,8000,… . Manual boss training does not raise the automatic count. Grants stay automatic, deterministic, repeatable and run-local; capped options leave the pool and unavailable milestones are consumed without deferred rewards. Effective firing interval floors at0.12s under the official profile, before poison penalties.

Ordinary/elite/boss deaths leave0.5/0.6/0.8s bounded cosmetic snapshots and immediately free their combat slot. Whole-stage cleanup clears hazards and retains0.8s visual afterglow before rewards; during it only cosmetic time advances, with no damage, statuses, rewards or player/stage-clock progress. Paths, pulses and death animations consume no gameplay RNG. See the [endless evolution contract](endless-evolution.md) for acceptance and evidence boundaries.

## Validation boundary

Bun tests cover geometry, capacities, separate seeded region expansion to full coverage, real early melee in regions, boss cleanup and failure, all rarity outcomes, first-stage allowlist, strongest-tank/boss comparisons, escalating poison, every recovery path, max/current-HP damage and non-recursion, global counters, all12 family thresholds, one-use rewards, fixed-frame-rate invariance and natural campaign/endless outcomes. Browser checks cover desktop/mobile presentation, logical input coordinates, added attack cells, cleanup, card previews, status labels, pause and reward selection.

Natural seeded simulations demonstrate possible builds and failures; they are not human win rates. Browser software rendering is not physical-device or long-session performance acceptance. Wiki, PRE and PRO must be verified separately.

## PRE 数值方案

上述为仓库正式配置的规则。PRE 个人方案可以覆盖初始角色、敌人数值、关卡范围、无尽成长和卡池权重；只有应用 JSON 到正式配置并验证、发布之后才会影响玩家。临时战斗修改不会自动进入方案。v2方案包含独立训练门槛、基础二次成长、首领时序和额度；第五层后的生命尾项、双精英编排、每次预警确认、深层吸血与共享战斗回复额度、高星/深层百分比抗性、波次编组及普通受击上限为代码规则，导出数值方案不会切回旧行为；原v1记录保留，只能显式迁移新身份副本，不自动启用。配置卡池全部耗尽时允许明确选择无奖励继续。操作与格式见 [PRE 数值实验室](balance-debugger.md)。
