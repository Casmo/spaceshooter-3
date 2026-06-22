/**
 * Tracks XP and level-up thresholds. The threshold grows geometrically, so
 * early levels come fast and later ones space out.
 */
export class Leveling {
  level = 0;
  /** XP accumulated toward the next level. */
  xp = 0;
  /** XP required for the next level. */
  threshold: number;

  constructor(
    private readonly base: number,
    private readonly growth: number,
  ) {
    this.threshold = base;
  }

  /** Add XP; returns how many level-ups it triggered (may be >1). */
  addXp(amount: number): number {
    this.xp += amount;
    let ups = 0;
    while (this.xp >= this.threshold) {
      this.xp -= this.threshold;
      this.level += 1;
      this.threshold = this.base * Math.pow(this.growth, this.level);
      ups += 1;
    }
    return ups;
  }

  /** Progress to the next level, 0..1 (for the XP bar in #7). */
  get progress(): number {
    return this.xp / this.threshold;
  }
}
