import { describe, it, expect } from "vitest";
import type { Card } from "./cards";
import { evaluateHand } from "./poker";
import { elementSplit, isSingleSuit, elementMultiplier } from "./element";
import { computeAttack } from "./damage";
import { damageBonusFor, rollDie } from "./dice";

function c(rank: number, suit: Card["suit"]): Card {
  return { id: `${suit}-${rank}`, rank, suit };
}

describe("poker evaluation", () => {
  it("detects a flush", () => {
    const hand = evaluateHand([
      c(2, "hearts"),
      c(5, "hearts"),
      c(9, "hearts"),
      c(11, "hearts"),
      c(13, "hearts"),
    ]);
    expect(hand.type.key).toBe("flush");
  });

  it("detects a straight (with wheel A-2-3-4-5)", () => {
    const hand = evaluateHand([
      c(14, "hearts"),
      c(2, "clubs"),
      c(3, "spades"),
      c(4, "diamonds"),
      c(5, "hearts"),
    ]);
    expect(hand.type.key).toBe("straight");
  });

  it("detects royal flush", () => {
    const hand = evaluateHand([
      c(10, "spades"),
      c(11, "spades"),
      c(12, "spades"),
      c(13, "spades"),
      c(14, "spades"),
    ]);
    expect(hand.type.key).toBe("royalFlush");
  });

  it("detects four of a kind and scores only the quad cards", () => {
    const hand = evaluateHand([
      c(7, "spades"),
      c(7, "hearts"),
      c(7, "clubs"),
      c(7, "diamonds"),
      c(2, "spades"),
    ]);
    expect(hand.type.key).toBe("quads");
    expect(hand.scoringCards).toHaveLength(4);
  });

  it("two pair scores four cards", () => {
    const hand = evaluateHand([
      c(7, "spades"),
      c(7, "hearts"),
      c(3, "clubs"),
      c(3, "diamonds"),
      c(2, "spades"),
    ]);
    expect(hand.type.key).toBe("twoPair");
    expect(hand.scoringCards).toHaveLength(4);
  });
});

describe("element split", () => {
  it("splits mixed suits proportionally", () => {
    const shares = elementSplit([
      c(3, "hearts"),
      c(4, "hearts"),
      c(5, "hearts"),
      c(9, "spades"),
      c(10, "spades"),
    ]);
    const fire = shares.find((s) => s.element === "fire")!;
    const lightning = shares.find((s) => s.element === "lightning")!;
    expect(fire.fraction).toBeCloseTo(0.6);
    expect(lightning.fraction).toBeCloseTo(0.4);
  });

  it("single suit detected", () => {
    expect(isSingleSuit([c(3, "hearts"), c(4, "hearts")])).toBe(true);
    expect(isSingleSuit([c(3, "hearts"), c(4, "spades")])).toBe(false);
  });

  it("weakness raises element multiplier", () => {
    const shares = elementSplit([c(3, "diamonds"), c(4, "diamonds")]);
    const mult = elementMultiplier(shares, { ice: 1.8 });
    expect(mult).toBeCloseTo(1.8);
  });
});

describe("dice", () => {
  it("damage bonus scales with pips", () => {
    expect(damageBonusFor(1)).toBeCloseTo(1.0);
    expect(damageBonusFor(6)).toBeCloseTo(1.5);
  });

  it("respects die min/max range", () => {
    for (let i = 0; i < 200; i++) {
      const v = rollDie({ min: 2, max: 7 });
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe("damage computation", () => {
  it("single-suit fire flush hits an ice-weak enemy hard", () => {
    const cards = [
      c(10, "hearts"),
      c(11, "hearts"),
      c(12, "hearts"),
      c(13, "hearts"),
      c(2, "hearts"),
    ];
    const atk = computeAttack(cards, { fire: 1.0 }, {
      damageBonus: 1.5,
      crit: false,
      singleSuitMult: 2.2,
    });
    expect(atk.hand.type.key).toBe("flush");
    expect(atk.singleSuitBonus).toBe(2.2);
    expect(atk.total).toBeGreaterThan(0);
  });

  it("crit increases total", () => {
    const cards = [c(9, "spades"), c(9, "hearts")];
    const base = computeAttack(cards, {}, { damageBonus: 1, crit: false });
    const crit = computeAttack(cards, {}, { damageBonus: 1, crit: true });
    expect(crit.total).toBeGreaterThan(base.total);
  });
});
