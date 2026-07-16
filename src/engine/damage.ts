// 최종 데미지 계산 (설계 문서 2장 공식)
import type { Card } from "./cards";
import { evaluateHand } from "./poker";
import type { HandResult } from "./poker";
import {
  elementSplit,
  elementMultiplier,
  isSingleSuit,
  SINGLE_SUIT_BONUS,
} from "./element";
import type { ElementShare, ElementReactions } from "./element";

export const CRIT_MULT = 1.5;

export interface AttackBreakdown {
  hand: HandResult;
  shares: ElementShare[];
  baseChips: number; // 족보칩 + Σ카드숫자
  handMult: number;
  elementMult: number;
  damageBonus: number; // 주사위 눈 보너스
  singleSuitBonus: number; // 1 또는 1.5
  critMult: number; // 1 또는 CRIT_MULT
  total: number;
  /** 속성별로 나뉜 실제 피해 (적 반응 반영, 상태이상 부여용) */
  perElement: { element: ElementShare["element"]; amount: number }[];
}

export function computeAttack(
  selected: Card[],
  reactions: ElementReactions,
  opts: {
    damageBonus: number;
    crit: boolean;
    /** 단일 무늬 보너스 배수 (무기별). 기본 1.5 */
    singleSuitMult?: number;
  }
): AttackBreakdown {
  const hand = evaluateHand(selected);
  const scoring = hand.scoringCards;
  const shares = elementSplit(scoring);

  const cardSum = scoring.reduce((s, c) => s + c.rank, 0);
  const baseChips = hand.type.chips + cardSum;
  const handMult = hand.type.mult;
  const elementMult = elementMultiplier(shares, reactions);
  const damageBonus = opts.damageBonus;
  const singleSuitBonus = isSingleSuit(scoring)
    ? opts.singleSuitMult ?? SINGLE_SUIT_BONUS
    : 1;
  const critMult = opts.crit ? CRIT_MULT : 1;

  const total = Math.round(
    baseChips * handMult * elementMult * damageBonus * singleSuitBonus * critMult
  );

  // 속성별 피해 = 총합 × (조각비율 × 반응) / elementMult 로 재분배
  const perElement = shares.map((s) => {
    const react = reactions[s.element] ?? 1;
    const weight = elementMult > 0 ? (s.fraction * react) / elementMult : s.fraction;
    return { element: s.element, amount: Math.round(total * weight) };
  });

  return {
    hand,
    shares,
    baseChips,
    handMult,
    elementMult,
    damageBonus,
    singleSuitBonus,
    critMult,
    total,
    perElement,
  };
}
