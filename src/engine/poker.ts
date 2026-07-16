// 포커 족보 판정 → 기본 칩 / 배수 (설계 문서 3장)
import type { Card } from "./cards";

export type HandType =
  | "high"
  | "pair"
  | "twoPair"
  | "trips"
  | "straight"
  | "flush"
  | "fullHouse"
  | "quads"
  | "straightFlush"
  | "royalFlush";

export interface HandTypeInfo {
  key: HandType;
  name: string;
  chips: number;
  mult: number;
}

export const HAND_TABLE: Record<HandType, HandTypeInfo> = {
  high: { key: "high", name: "하이카드", chips: 5, mult: 1 },
  pair: { key: "pair", name: "원페어", chips: 10, mult: 2 },
  twoPair: { key: "twoPair", name: "투페어", chips: 20, mult: 2 },
  trips: { key: "trips", name: "트리플", chips: 30, mult: 3 },
  straight: { key: "straight", name: "스트레이트", chips: 30, mult: 4 },
  flush: { key: "flush", name: "플러시", chips: 35, mult: 4 },
  fullHouse: { key: "fullHouse", name: "풀하우스", chips: 40, mult: 4 },
  quads: { key: "quads", name: "포카드", chips: 60, mult: 7 },
  straightFlush: { key: "straightFlush", name: "스트레이트 플러시", chips: 100, mult: 8 },
  royalFlush: { key: "royalFlush", name: "로열 플러시", chips: 100, mult: 8 },
};

export interface HandResult {
  type: HandTypeInfo;
  /** 족보를 구성하는 실제 사용 카드 (속성 비례 분배에 사용) */
  scoringCards: Card[];
}

function countBy<T, K extends string | number>(
  arr: T[],
  key: (t: T) => K
): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = m.get(k);
    if (list) list.push(item);
    else m.set(k, [item]);
  }
  return m;
}

function isStraight(ranks: number[]): boolean {
  if (ranks.length !== 5) return false;
  const uniq = Array.from(new Set(ranks)).sort((a, b) => a - b);
  if (uniq.length !== 5) return false;
  // 일반 연속
  if (uniq[4] - uniq[0] === 4) return true;
  // A(14)를 1로 쓰는 A-2-3-4-5
  const wheel = [2, 3, 4, 5, 14];
  return wheel.every((r, i) => uniq[i] === r);
}

/** 선택된 카드(1~5장)에서 최고 족보를 판정한다. */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) {
    return { type: HAND_TABLE.high, scoringCards: [] };
  }

  const byRank = countBy(cards, (c) => c.rank);
  const bySuit = countBy(cards, (c) => c.suit);
  const ranks = cards.map((c) => c.rank);

  const isFlush = cards.length === 5 && bySuit.size === 1;
  const straight = isStraight(ranks);

  // 무늬별/숫자별 그룹 (많은 순)
  const rankGroups = Array.from(byRank.values()).sort((a, b) => b.length - a.length);
  const counts = rankGroups.map((g) => g.length);

  const highestCard = cards.slice().sort((a, b) => b.rank - a.rank)[0];

  // 스트레이트 플러시 / 로열
  if (isFlush && straight) {
    const sorted = ranks.slice().sort((a, b) => a - b);
    const isRoyal = sorted[0] === 10 && sorted[4] === 14;
    return {
      type: isRoyal ? HAND_TABLE.royalFlush : HAND_TABLE.straightFlush,
      scoringCards: cards.slice(),
    };
  }
  if (counts[0] === 4) {
    return { type: HAND_TABLE.quads, scoringCards: rankGroups[0] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { type: HAND_TABLE.fullHouse, scoringCards: cards.slice() };
  }
  if (isFlush) {
    return { type: HAND_TABLE.flush, scoringCards: cards.slice() };
  }
  if (straight) {
    return { type: HAND_TABLE.straight, scoringCards: cards.slice() };
  }
  if (counts[0] === 3) {
    return { type: HAND_TABLE.trips, scoringCards: rankGroups[0] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    return {
      type: HAND_TABLE.twoPair,
      scoringCards: [...rankGroups[0], ...rankGroups[1]],
    };
  }
  if (counts[0] === 2) {
    return { type: HAND_TABLE.pair, scoringCards: rankGroups[0] };
  }
  return { type: HAND_TABLE.high, scoringCards: [highestCard] };
}
