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

export function makeEnemy(def: EnemyDef, idx = 0): EnemyInstance {
  return {
    ...def,
    id: `${def.key}-${idx}`,
    hp: def.maxHp,
    statuses: emptyStatuses(),
  };
}

// MVP 인카운터: 하운드 + 밴딧 조합 (약점이 서로 달라 속성 선택을 유도)
export function defaultEncounter(): EnemyInstance[] {
  return [
    makeEnemy(ENEMY_DEFS[0], 0),
    makeEnemy(ENEMY_DEFS[1], 1),
  ];
}
