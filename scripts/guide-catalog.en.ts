// Documentation translations only. In-game labels remain unchanged.
export const CARD_EN: Record<string, readonly [name: string, effect: string]> = {
  overload: [
    "Overload Sigil",
    "Increase spell output; briefly suspend common sense. Base damage increases as shown below.",
  ],
  haste: [
    "Swift Chant",
    "Skip the incantation, including its punctuation. Reduce the firing interval as shown below.",
  ],
  multishot: [
    "Forked Prayer",
    "Add one homing secondary shot at 60% primary damage; prefer other targets.",
  ],
  piercing: ["Causal Pierce", "A hit is not the end of the story. Add one extra penetration."],
  vitality: ["Refill Ritual", "Increase maximum health by 20 and heal 30 before wound penalties."],
  execution: [
    "Defense Verdict",
    "+20% damage per stack against enemies in the Attacking state; no bonus during approach or preparation.",
  ],
  ward: [
    "Nightwatch Pact",
    "Immediately gain 24 shield before wound penalties. Shield absorbs damage first.",
  ],
  fuse: [
    "Ember Fuse",
    "Kills explode for 16 damage plus 3% of the source monster's maximum HP per stack. Chains unlock at blast tier 6.",
  ],
  bloodpact: [
    "Starfall Pact",
    "With enemies present, sacrifice 3 HP every 5s, nonlethally. Explode at a target using base damage, player maximum HP and 2% target maximum HP per stack.",
  ],
  thorns: [
    "Thorn Covenant",
    "Each effective hit received retaliates against every enemy for 18 damage per stack. Shield hits also trigger it.",
  ],
  focus: [
    "Gaze of Weakness",
    "+20% boss damage per stack. Focus fire during the gold charge telegraph.",
  ],
  harvest: [
    "Final Echo",
    "Each kill heals 2 HP per stack, capped at maximum health. Chain kills count.",
  ],
  force: ["Might Sigil", "+5 base damage. Heavy strikes and critical hits amplify it."],
  momentum: [
    "Titan Will",
    "+12 percentage points of attack power, multiplied with flat damage bonuses.",
  ],
  crush: [
    "Siegebreaker",
    "Every fifth volley is a heavy strike, with +25% damage per stack. Synergy can shorten the cycle.",
  ],
  leech: [
    "Bloodthirst Sigil",
    "Basic attacks heal from actual enemy HP removed: 4% base, 3.4% effective per stack. Chests grant no lifesteal.",
  ],
  renewal: [
    "Unending Spring",
    "Regenerate 1.2 HP/s in combat; stop during pause and reward selection.",
  ],
  recovery: [
    "Crimson Grace",
    "+15 percentage points to healing from lifesteal, kills and regeneration.",
  ],
  keen: [
    "Fated Edge",
    "+8 percentage points of critical chance per basic projectile. Base critical multiplier is 1.5.",
  ],
  lethal: [
    "Lethal Prayer",
    "+0.25 critical damage multiplier; combines with critical chance and guaranteed-critical synergies.",
  ],
  expose: ["Weakness Anatomy", "+12% damage per stack against enemies below half health."],
  chain: [
    "Arc Lightning",
    "Basic hits jump to one additional nearby enemy for 30% basic damage, without revisiting targets.",
  ],
  splash: [
    "Resonant Arc",
    "Basic hits splash nearby enemies for 15% basic damage per stack, excluding the primary victim.",
  ],
  stormcall: [
    "Storm Ritual",
    "Every 6s, strike an enemy area for attack damage × (1 + 0.5 × stacks).",
  ],
  chill: [
    "Frost Sigil",
    "Basic hits slow for 2s by 10% per stack, affecting movement, preparation and attack timing.",
  ],
  frostbite: ["Shatter Hex", "+12% damage per stack against slowed enemies."],
  icefield: [
    "Winter Pulse",
    "Every 6s, slow all enemies for 2s: 20% base plus 5% per stack. Synergy extends duration.",
  ],
  impact: [
    "Dread Sigil",
    "Every fourth primary hit on the same enemy stuns for 0.15s per stack; bosses receive one quarter duration.",
  ],
  suppression: ["Suppression Edict", "+12% damage per stack against stunned or charging enemies."],
  edict: [
    "Silent Dominion",
    "Every 8s of hostile time, trigger Sanctuary to cleanse poison, wounds and attack-speed penalties. First stack freezes hostile time for 0.75s, disabling taunt and freezing fusion/skills while the player attacks.",
  ],
  overflow: [
    "Overflow Ward",
    "Convert 10% of combat overhealing into shield, with a base storage cap of 20% player maximum HP.",
  ],
  reservoir: [
    "Bloodforged Vessel",
    "+5 percentage points of overheal conversion and +10% maximum-HP storage. Can activate conversion by itself.",
  ],
  "shield-leech": [
    "Crimson Siphon",
    "While shielded, gain 2 percentage points of base lifesteal (1.7 effective). Ends when shield is exhausted.",
  ],
  "giant-slayer": [
    "Giant Slayer",
    "Primary direct hits add 0.25% of the victim's maximum HP as damage.",
  ],
  "titan-breaker": [
    "Mountain Breaker",
    "Basic damage bonus: 4% × log₂(1 + enemy maximum HP / player maximum HP).",
  ],
  "colossus-hunt": [
    "Godhunter Oath",
    "+15% basic damage per stack against enemies with at least five times the player's maximum HP.",
  ],
  "life-rend": [
    "Life Rend",
    "Primary direct hits add 0.2% victim maximum HP damage. Combined with Giant Slayer, capped at 5%.",
  ],
  decay: [
    "Decay Mark",
    "Primary direct hits add 1% victim current HP damage, capped at 10% after synergy.",
  ],
  entropy: [
    "Entropy Pulse",
    "Every 4s, deal 0.5% of each enemy's maximum HP per stack across the arena; synergy shortens the interval, capped at 5% per pulse.",
  ],
  "nova-heart": [
    "Supernova Heart",
    "+8 base damage, +2 explosion stacks and +1 sacrifice stack. Once per run.",
  ],
  "heavenly-barrage": [
    "Heavenly Barrage",
    "+2 projectiles and +1 penetration. Final projectile count remains capped at six. Once per run.",
  ],
  "aegis-core": [
    "Undying Citadel",
    "+60 maximum HP, heal 80, gain 60 shield and +1 thorns stack. Recovery follows wounds. Once per run.",
  ],
  "final-verdict": [
    "Final Edict",
    "+40% boss damage, +40% damage against Attacking enemies and +4 HP per kill. Once per run.",
  ],
  "titan-heart": [
    "Titan Heart",
    "+18 base damage and +30 percentage points of attack power. Once per run.",
  ],
  "crimson-grail": [
    "Crimson Grail",
    "+10.2% effective lifesteal, +3 HP/s regeneration and +25% healing bonus. Once per run.",
  ],
  "fate-eye": [
    "Eye of Fate",
    "+20 percentage points of critical chance and +0.75 critical multiplier. Once per run.",
  ],
  "tempest-core": [
    "Tempest Core",
    "+2 lightning jumps, +2 splash stacks and +2 storm stacks. Once per run.",
  ],
  "absolute-zero": [
    "Absolute Zero",
    "+20% on-hit slow, +35% damage against slowed enemies and +2 winter pulse stacks. Boss slow resistance remains. Once per run.",
  ],
  chronocrown: [
    "Chronocrown",
    "+2 Sanctuary enhancement stacks, +35% control damage and +0.3s hit stun. Alone, grants a 1s Sanctuary; adds 0.5s to an existing one before Dominion scaling. Once per run.",
  ],
  godfall: [
    "Godfall",
    "+0.75% primary maximum-HP damage, +8% size coefficient and +20% giant-target damage. Once per run.",
  ],
  "event-horizon": [
    "Event Horizon",
    "+0.6% primary maximum-HP damage, +2% current-HP damage and +1% arena pulse. Once per run.",
  ],
};

export const FAMILY_EN: Record<string, readonly [string, readonly string[]]> = {
  blast: [
    "Starfall Blast",
    [
      "Ordinary kills explode, including source maximum-HP damage; +40% total explosion damage, radius 160.",
      "Explosion kills can chain; automatic sacrifice every 4s.",
      "+100% explosion damage, radius 190; sacrifice every 3s with an extra 45% maximum-HP component.",
    ],
  ],
  barrage: [
    "Prayer Barrage",
    [
      "Firing interval reduced another 12%; secondaries deal 80% primary damage.",
      "Every fourth volley adds a full volley; secondaries deal 100%.",
      "Firing interval reduced 25%, +1 projectile, full extra volley every third volley.",
    ],
  ],
  bastion: [
    "Unfallen Bastion",
    [
      "Regenerate 10 shield every 3s up to 60% maximum HP.",
      "Double thorns; each hit reflects 25% player maximum HP to all enemies.",
      "Regenerate 20 shield every 3s up to 100% maximum HP; arena reflection rises to 50% maximum HP.",
    ],
  ],
  judgment: [
    "Final Judgment",
    [
      "+20% damage against Preparing or Attacking enemies.",
      "Execute enemies, including bosses, below 8% HP; +50% damage against charging bosses.",
      "Execution threshold rises to 15%; double damage against charging bosses.",
    ],
  ],
  might: [
    "Titan Might",
    [
      "Multiply base attack damage by 1.2.",
      "Heavy strike every fourth volley: +30% damage to the entire volley, stacking with the card.",
      "Heavy strike every third volley: +80% damage to the entire volley.",
    ],
  ],
  blood: [
    "Crimson Hunger",
    [
      "+4.25 percentage points of effective lifesteal.",
      "Convert 50% combat overhealing into shield, capped at 40% maximum HP.",
      "+8.5 percentage points of effective lifesteal, double regeneration; convert all combat overhealing, capped at 80% maximum HP.",
    ],
  ],
  precision: [
    "Fated Critical",
    [
      "+10 percentage points of critical chance.",
      "+0.25 critical multiplier.",
      "Another +0.5 critical multiplier; every third volley is guaranteed critical.",
    ],
  ],
  storm: [
    "Storm Resonance",
    [
      "Basic hits jump to one additional target; splash radius +20.",
      "Another two chain targets; automatic storm every 4s.",
      "Storm every 3s; double storm and chain damage.",
    ],
  ],
  frost: [
    "Eternal Winter",
    [
      "+10 percentage points of on-hit slow; duration 3s.",
      "Every four basic hits on one enemy freeze it for 0.6s; bosses receive one quarter duration.",
      "Freeze every three hits for 1s; +30% damage against slowed enemies.",
    ],
  ],
  dominion: [
    "Royal Dominion",
    [
      "Stun and Sanctuary duration +30%; +20% damage against controlled or charging enemies.",
      "Sanctuary every 6s, cleansing poison, wounds and attack-speed penalties, clearing hostile shots and disabling taunt; bosses receive full duration.",
      "Stun and Sanctuary duration +60%; controlled kills grant 8 shield; +50% boss interruption damage.",
    ],
  ],
  giantslayer: [
    "Giant Slayer",
    [
      "Giant Slayer primary maximum-HP damage +25%.",
      "+50% basic damage against enemies with at least five times player maximum HP.",
      "Double Giant Slayer maximum-HP component; combined with erosion, capped at 5%.",
    ],
  ],
  erosion: [
    "Percentage Erosion",
    [
      "Percentage damage from erosion cards +25%.",
      "Arena erosion pulse interval falls from 4s to 3s.",
      "Double erosion percentage damage; pulse interval 2s.",
    ],
  ],
};

// Longest phrases are replaced first. Numbers and arrows come from live previews.
export const TERMS_EN: Record<string, string> = {
  攻击间隔: "Firing interval",
  过量转盾储量上限: "Overheal shield capacity",
  玩家生命加成: "Player HP bonus",
  来源怪物最大生命: "Source maximum HP",
  目标最大生命: "Target maximum HP",
  主弹最大生命侵蚀: "Primary maximum-HP erosion",
  主弹最大生命伤害: "Primary maximum-HP damage",
  主弹当前生命伤害: "Primary current-HP damage",
  全场最大生命侵蚀: "Arena maximum-HP erosion",
  主弹最大生命: "Primary maximum HP",
  遗世庇护强化层数: "Sanctuary enhancement stacks",
  攻击阶段增伤: "Attacking-state damage bonus",
  战斗治疗加成: "Combat healing bonus",
  献祭基础伤害: "Sacrifice base damage",
  基础暴击率: "Base critical chance",
  过量转盾: "Overheal conversion",
  有盾额外吸血: "Shielded bonus lifesteal",
  体量增伤系数: "Size damage coefficient",
  巨物普攻增伤: "Giant basic damage bonus",
  转盾储量上限: "Conversion capacity",
  额外穿透: "Extra penetration",
  受击反击: "Hit retaliation",
  击杀爆炸: "Kill explosion",
  生命上限: "Maximum HP",
  最大生命: "Maximum HP",
  基础伤害: "Base damage",
  攻击加成: "Attack power",
  重击增伤: "Heavy-strike bonus",
  普攻吸血: "Basic lifesteal",
  每秒回复: "HP/s",
  暴击倍率: "Critical multiplier",
  半血增伤: "Below-half bonus",
  闪电跳跃: "Lightning jumps",
  溅射层数: "Splash stacks",
  雷暴层数: "Storm stacks",
  命中减速: "On-hit slow",
  减速增伤: "Slowed-target bonus",
  寒潮层数: "Winter stacks",
  命中眩晕: "On-hit stun",
  控制增伤: "Control bonus",
  遗世庇护: "Sanctuary",
  击杀回复: "Kill healing",
  首领增伤: "Boss bonus",
  实际吸血: "Effective lifesteal",
  治疗加成: "Healing bonus",
  暴击率: "Critical chance",
  当前生命: "Current HP",
  体量系数: "Size coefficient",
  巨物增伤: "Giant bonus",
  个百分点: "percentage points",
  护盾: "Shield",
  伤害: "Damage",
  间隔: "Interval",
  弹幕: "Projectiles",
  治疗: "Heal",
  爆炸: "Explosion",
  献祭: "Sacrifice",
  荆棘: "Thorns",
  溅射: "Splash",
  雷暴: "Storm",
  寒潮: "Winter",
  脉冲: "Pulse",
  层: "stacks",
  枚: "shots",
  个: "targets",
};

export function previewEnglish(source: string): string {
  let text = source;
  for (const [zh, en] of Object.entries(TERMS_EN).sort((a, b) => b[0].length - a[0].length))
    text = text.replaceAll(zh, en);
  if (/[\u3400-\u9fff]/u.test(text)) throw new Error(`Untranslated guide preview: ${source}`);
  return text;
}
