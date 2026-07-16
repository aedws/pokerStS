// 카드 = 탄환. 숫자(포커용) + 무늬(속성) 를 함께 가진다.

export type Element = "fire" | "ice" | "lightning" | "poison";
export type Suit = "hearts" | "diamonds" | "spades" | "clubs";

// 무늬 ↔ 속성 매핑 (설계 문서 4.2)
export const SUIT_ELEMENT: Record<Suit, Element> = {
  hearts: "fire", // ♥ 화염
  diamonds: "ice", // ♦ 냉기
  spades: "lightning", // ♠ 번개
  clubs: "poison", // ♣ 독
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  spades: "♠",
  clubs: "♣",
};

export const ELEMENT_INFO: Record<
  Element,
  { name: string; color: string; glow: string; symbol: string }
> = {
  fire: { name: "화염", color: "#ff7b3d", glow: "#ff5a1f", symbol: "🔥" },
  ice: { name: "냉기", color: "#4fc3ff", glow: "#2aa8ff", symbol: "❄️" },
  lightning: { name: "번개", color: "#ffd633", glow: "#ffcc00", symbol: "⚡" },
  poison: { name: "독", color: "#8be34a", glow: "#5fce1f", symbol: "☠️" },
};

// 카드 숫자값: 2~10 그대로, J=11 Q=12 K=13 A=14
export type Rank = number; // 2..14

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export const RANK_LABEL: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function cardElement(card: Card): Element {
  return SUIT_ELEMENT[card.suit];
}

export const SUITS: Suit[] = ["hearts", "diamonds", "spades", "clubs"];

// 카드 인스턴스마다 고유 id (같은 숫자/무늬 카드를 덱에 여러 장 넣을 수 있게)
let cardUid = 0;
export function makeCard(suit: Suit, rank: Rank): Card {
  return { id: `c${++cardUid}`, rank, suit };
}

// 표준 52장 덱 생성 (덱빌딩의 시작점 — 넣고 빼며 특화한다)
export function buildStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}

// 전투 보상용 카드 후보 n장 (덱에 추가할 후보)
export function randomRewardCards(n: number, rng: () => number = Math.random): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    const suit = SUITS[Math.floor(rng() * SUITS.length)];
    const rank = 2 + Math.floor(rng() * 13); // 2..14
    out.push(makeCard(suit, rank));
  }
  return out;
}

// Fisher-Yates 셔플 (주입된 rng 사용 — 테스트 가능)
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
