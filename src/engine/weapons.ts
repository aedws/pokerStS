// 무기 = 탄창 상한 + 발사 방식 + 속성 규칙 (설계 문서 6장)

export type FireMode = "single" | "all";

export interface Weapon {
  key: string;
  name: string;
  emoji: string;
  magazineCap: number; // 손패 상한 (주사위 눈이 이보다 크면 클램프)
  fireMode: FireMode; // single: 단일 대상 / all: 전체 대상
  /** 단일 무늬 손패일 때 속성 보너스 배수 */
  singleSuitMult: number;
  blurb: string;
}

export const WEAPONS: Weapon[] = [
  {
    key: "revolver",
    name: "리볼버",
    emoji: "🔫",
    magazineCap: 6,
    fireMode: "single",
    singleSuitMult: 1.5,
    blurb: "자유 혼합 · 밸런스. 6연발 실린더.",
  },
  {
    key: "rifle",
    name: "소총",
    emoji: "🎯",
    magazineCap: 5,
    fireMode: "single",
    singleSuitMult: 2.2, // 단일 무늬(불만 채우기)면 대폭 보너스
    blurb: "단일 무늬로 꽉 채우면 속성 특화 대폭 보너스.",
  },
  {
    key: "shotgun",
    name: "샷건",
    emoji: "💥",
    magazineCap: 5,
    fireMode: "all",
    singleSuitMult: 1.4,
    blurb: "전체 대상 분산 사격. 다수 적에게 강하다.",
  },
];

export function weaponByKey(key: string): Weapon {
  return WEAPONS.find((w) => w.key === key) ?? WEAPONS[0];
}
