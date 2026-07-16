// 적 정의 (설계 문서 MVP: 약점/저항 포함 2~3종)
import type { ElementReactions } from "./element";

export interface EnemyDef {
  key: string;
  name: string;
  emoji: string;
  maxHp: number;
  /** 선공 기준: 플레이어 주사위 initiative 가 이 값 이하이면 플레이어 선공 */
  speed: number;
  attack: number; // 기본 공격력
  reactions: ElementReactions; // 약점(>1) / 저항(<1) / 면역(0)
  blurb: string;
}

export interface EnemyInstance extends EnemyDef {
  id: string;
  hp: number;
  statuses: StatusMap;
}

export interface StatusMap {
  burn: number; // 화상 도트 (턴당 피해 = 스택)
  chill: number; // 둔화/빙결 (남은 턴)
  shock: number; // 감전 (다음 피격 데미지 증폭 스택)
  poison: number; // 독 도트 (방어 무시)
}

export function emptyStatuses(): StatusMap {
  return { burn: 0, chill: 0, shock: 0, poison: 0 };
}

// 데스티니 포세이큰 st SF 카우보이 무드의 무법자 무리
export const ENEMY_DEFS: EnemyDef[] = [
  {
    key: "scorchHound",
    name: "스코치 하운드",
    emoji: "🐺",
    maxHp: 60,
    speed: 4,
    attack: 8,
    reactions: { ice: 1.8, fire: 0.5 }, // 냉기 약점, 화염 저항
    blurb: "타오르는 황무지의 사냥개. 얼음에 약하다.",
  },
  {
    key: "voidBandit",
    name: "보이드 밴딧",
    emoji: "🤠",
    maxHp: 45,
    speed: 3,
    attack: 11,
    reactions: { lightning: 1.6, poison: 0.5 }, // 번개 약점, 독 저항
    blurb: "공허를 두른 현상수배범. 빠르고 번개에 약하다.",
  },
  {
    key: "ironColossus",
    name: "아이언 콜로서스",
    emoji: "🤖",
    maxHp: 110,
    speed: 6, // 느림
    attack: 16,
    reactions: { lightning: 1.8, fire: 0.7, poison: 0 }, // 번개 약점, 독 면역(기계)
    blurb: "고철 거인. 느리지만 강하다. 독이 통하지 않는다.",
  },
];

// 런의 최종 보스
export const BOSS_DEF: EnemyDef = {
  key: "dredgenKing",
  name: "드렛전 킹",
  emoji: "👑",
  maxHp: 240,
  speed: 5,
  attack: 22,
  reactions: { fire: 0.7, ice: 0.7, lightning: 1.3 }, // 대부분 저항, 번개만 약점
  blurb: "현상금 사냥의 왕. 대부분의 속성에 강하다.",
};

export function makeEnemy(def: EnemyDef, idx = 0, scale = 1): EnemyInstance {
  const maxHp = Math.round(def.maxHp * scale);
  return {
    ...def,
    maxHp,
    attack: Math.round(def.attack * scale),
    id: `${def.key}-${idx}-${Math.floor(Math.random() * 1e6)}`,
    hp: maxHp,
    statuses: emptyStatuses(),
  };
}

// 노드 타입 + 깊이(row)로 인카운터 생성 — 위로 갈수록 강해진다
export function buildEncounter(
  type: "combat" | "elite" | "rest" | "boss",
  row: number,
  rng: () => number = Math.random
): EnemyInstance[] {
  const scale = 1 + row * 0.16;

  if (type === "boss") return [makeEnemy(BOSS_DEF, 0, 1)];

  if (type === "elite") {
    // 고철 거인(엘리트급)을 강화해서 1기
    return [makeEnemy(ENEMY_DEFS[2], 0, scale * 1.05)];
  }

  // 일반 전투: 하운드/밴딧 1~2기
  const pool = [ENEMY_DEFS[0], ENEMY_DEFS[1]];
  const count = row === 0 ? 2 : rng() < 0.5 ? 1 : 2;
  const out: EnemyInstance[] = [];
  for (let i = 0; i < count; i++) {
    const def = pool[Math.floor(rng() * pool.length)];
    out.push(makeEnemy(def, i, scale));
  }
  return out;
}
