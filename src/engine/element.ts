// 속성 상성 & 혼합 무늬 비례 분배 (설계 문서 4.2)
import type { Card, Element } from "./cards";
import { cardElement } from "./cards";

// 적의 속성 반응 배수. 정의 안 된 속성은 1(보통).
export type ElementReactions = Partial<Record<Element, number>>;

export interface ElementShare {
  element: Element;
  fraction: number; // 0..1
  count: number;
}

/** 사용 카드들의 무늬 비율대로 속성 분배 */
export function elementSplit(scoringCards: Card[]): ElementShare[] {
  if (scoringCards.length === 0) return [];
  const counts = new Map<Element, number>();
  for (const c of scoringCards) {
    const el = cardElement(c);
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  const total = scoringCards.length;
  return Array.from(counts.entries())
    .map(([element, count]) => ({ element, count, fraction: count / total }))
    .sort((a, b) => b.count - a.count);
}

export function isSingleSuit(scoringCards: Card[]): boolean {
  if (scoringCards.length === 0) return false;
  const first = scoringCards[0].suit;
  return scoringCards.every((c) => c.suit === first);
}

/**
 * 속성 배수 계산:
 *  - 각 속성 조각(fraction)에 적의 반응 배수를 곱해 가중합
 *  - 단일 무늬면 +50% 보너스
 */
export function elementMultiplier(
  shares: ElementShare[],
  reactions: ElementReactions
): number {
  if (shares.length === 0) return 1;
  let mult = 0;
  for (const s of shares) {
    const react = reactions[s.element] ?? 1;
    mult += s.fraction * react;
  }
  return mult;
}

export const SINGLE_SUIT_BONUS = 1.5;
