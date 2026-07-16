// 유물 = 빌드 시너지 레이어 (발라트로 조커 / 슬더슬 유물에 해당)
// 덱을 특정 무늬·족보로 특화할수록 폭발하는 조건부 데미지 배수를 준다.
import type { AttackBreakdown } from "./damage";

export interface RelicCtx {
  handKey: string; // 족보 key
  fireFraction: number; // 화염(하트) 비중 0..1
  singleSuit: boolean; // 단일 무늬 여부
  cardCount: number; // 이번 사격에 쓴 카드 수
  crit: boolean;
}

export interface Relic {
  key: string;
  name: string;
  emoji: string;
  desc: string;
  mult: (c: RelicCtx) => number; // 조건 충족 시 데미지 배수 (1 = 무효과)
}

const BIG_HANDS = [
  "trips",
  "straight",
  "flush",
  "fullHouse",
  "quads",
  "straightFlush",
  "royalFlush",
];

export const RELICS: Relic[] = [
  {
    key: "flushMaster",
    name: "플러시 마스터",
    emoji: "🌊",
    desc: "플러시 계열 완성 시 데미지 ×1.6",
    mult: (c) => (c.handKey.includes("flush") ? 1.6 : 1),
  },
  {
    key: "heartsAblaze",
    name: "불타는 심장",
    emoji: "❤️‍🔥",
    desc: "화염(하트) 비중 50%↑ 시 ×1.4",
    mult: (c) => (c.fireFraction >= 0.5 ? 1.4 : 1),
  },
  {
    key: "fullChamber",
    name: "풀 챔버",
    emoji: "🧰",
    desc: "5장으로 쏘면 데미지 ×1.5",
    mult: (c) => (c.cardCount >= 5 ? 1.5 : 1),
  },
  {
    key: "deadeye",
    name: "데드아이",
    emoji: "🎯",
    desc: "단일 무늬로 쏘면 ×1.3 (속성 특화 강화)",
    mult: (c) => (c.singleSuit ? 1.3 : 1),
  },
  {
    key: "gamblersHeart",
    name: "도박꾼의 심장",
    emoji: "🃏",
    desc: "크리티컬 시 추가 ×1.5",
    mult: (c) => (c.crit ? 1.5 : 1),
  },
  {
    key: "highRoller",
    name: "하이 롤러",
    emoji: "💰",
    desc: "트리플 이상 족보면 ×1.4",
    mult: (c) => (BIG_HANDS.includes(c.handKey) ? 1.4 : 1),
  },
];

export function relicByKey(key: string): Relic | undefined {
  return RELICS.find((r) => r.key === key);
}

export function relicCtx(
  atk: AttackBreakdown,
  cardCount: number,
  crit: boolean
): RelicCtx {
  const fire = atk.shares.find((s) => s.element === "fire")?.fraction ?? 0;
  return {
    handKey: atk.hand.type.key,
    fireFraction: fire,
    singleSuit: atk.singleSuitBonus > 1,
    cardCount,
    crit,
  };
}

export function applyRelics(
  relicKeys: string[],
  ctx: RelicCtx
): { mult: number; notes: { emoji: string; mult: number }[] } {
  let mult = 1;
  const notes: { emoji: string; mult: number }[] = [];
  for (const key of relicKeys) {
    const r = relicByKey(key);
    if (!r) continue;
    const m = r.mult(ctx);
    if (m !== 1) {
      mult *= m;
      notes.push({ emoji: r.emoji, mult: m });
    }
  }
  return { mult, notes };
}

// 소유하지 않은 유물 중 n개 제시 (엘리트 보상)
export function randomRelics(
  n: number,
  owned: string[],
  rng: () => number = Math.random
): Relic[] {
  const pool = RELICS.filter((r) => !owned.includes(r.key));
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
