import { UPGRADES, type Rarity } from "../config";
import { Player } from "./Player";

/** A single offerable upgrade. `cap` of 0 means unlimited. */
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  cap: number;
  weight: number;
  /** Apply one level of this upgrade to the player. */
  apply(player: Player): void;
}

/** A drawn card: the upgrade plus the level the player would reach by taking it. */
export interface UpgradeChoice {
  def: UpgradeDef;
  nextLevel: number;
}

/** The non-modifier upgrade pool. Bullet modifiers are appended in #6. */
export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "damage",
    name: "Shooting Power",
    description: `+${UPGRADES.damage.amount} bullet damage`,
    rarity: UPGRADES.damage.rarity,
    cap: UPGRADES.damage.cap,
    weight: UPGRADES.damage.weight,
    apply: (p) => {
      p.damage += UPGRADES.damage.amount;
    },
  },
  {
    id: "moveSpeed",
    name: "Engine",
    description: "Faster, more responsive movement",
    rarity: UPGRADES.moveSpeed.rarity,
    cap: UPGRADES.moveSpeed.cap,
    weight: UPGRADES.moveSpeed.weight,
    apply: (p) => {
      p.maxSpeed += UPGRADES.moveSpeed.speedAmount;
      p.followResponse += UPGRADES.moveSpeed.responseAmount;
    },
  },
  {
    id: "fireRate",
    name: "Rapid Fire",
    description: "Shorter cooldown between shots",
    rarity: UPGRADES.fireRate.rarity,
    cap: UPGRADES.fireRate.cap,
    weight: UPGRADES.fireRate.weight,
    apply: (p) => {
      p.cooldown *= UPGRADES.fireRate.mult;
    },
  },
  {
    id: "maxHp",
    name: "Reinforced Hull",
    description: `+${UPGRADES.maxHp.amount} max HP (and heal)`,
    rarity: UPGRADES.maxHp.rarity,
    cap: UPGRADES.maxHp.cap,
    weight: UPGRADES.maxHp.weight,
    apply: (p) => {
      p.maxHp += UPGRADES.maxHp.amount;
      p.hp = Math.min(p.maxHp, p.hp + UPGRADES.maxHp.amount);
    },
  },
  {
    id: "extraLife",
    name: "Extra Life",
    description: "+1 life",
    rarity: UPGRADES.extraLife.rarity,
    cap: UPGRADES.extraLife.cap,
    weight: UPGRADES.extraLife.weight,
    apply: (p) => {
      p.lives += 1;
    },
  },
  {
    id: "pickupRange",
    name: "Tractor Beam",
    description: "Larger star pickup range",
    rarity: UPGRADES.pickupRange.rarity,
    cap: UPGRADES.pickupRange.cap,
    weight: UPGRADES.pickupRange.weight,
    apply: (p) => {
      p.pickupRange += UPGRADES.pickupRange.amount;
    },
  },
];

/**
 * Tracks how many levels of each upgrade the player has taken and draws the
 * weighted, distinct, not-yet-maxed choices for a level-up.
 */
export class Upgrades {
  private readonly levels = new Map<string, number>();

  constructor(private readonly defs: UpgradeDef[]) {}

  levelOf(id: string): number {
    return this.levels.get(id) ?? 0;
  }

  private isMaxed(def: UpgradeDef): boolean {
    return def.cap !== 0 && this.levelOf(def.id) >= def.cap;
  }

  /** Weighted-random draw of `count` distinct, not-yet-maxed upgrades. */
  draw(count = 3): UpgradeChoice[] {
    const pool = this.defs
      .filter((d) => !this.isMaxed(d))
      .map((d) => ({ def: d, weight: d.weight }));
    const choices: UpgradeChoice[] = [];
    while (choices.length < count && pool.length > 0) {
      const total = pool.reduce((sum, e) => sum + e.weight, 0);
      let r = Math.random() * total;
      let idx = 0;
      while (idx < pool.length - 1 && r > pool[idx].weight) {
        r -= pool[idx].weight;
        idx += 1;
      }
      const [picked] = pool.splice(idx, 1);
      choices.push({
        def: picked.def,
        nextLevel: this.levelOf(picked.def.id) + 1,
      });
    }
    return choices;
  }

  /** Record and apply a chosen upgrade. */
  apply(def: UpgradeDef, player: Player): void {
    this.levels.set(def.id, this.levelOf(def.id) + 1);
    def.apply(player);
  }
}
