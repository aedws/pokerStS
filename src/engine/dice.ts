// 주사위 = 1D6 (설계 문서 5장)
// 한 번의 굴림이 장전 수 + 선공 + 데미지 보너스를 동시에 좌우한다.

export interface DieConfig {
  min: number; // 앞숫자 (보스 처치로 증감)
  max: number; // 뒷숫자 (보스 처치로 증감)
}

export const BASE_DIE: DieConfig = { min: 1, max: 6 };

export interface RollResult {
  value: number;
  /** 이번 사격의 데미지 배수 보너스: 눈이 높을수록 증가 */
  damageBonus: number;
  /** 선공 판정 기준값 (낮을수록 빠름). 적 speed 와 비교. */
  initiative: number;
}

export function rollDie(cfg: DieConfig, rng: () => number = Math.random): number {
  const span = cfg.max - cfg.min + 1;
  return cfg.min + Math.floor(rng() * span);
}

// 눈 → 데미지 보너스 배수 (초안: 1=×1.0 ... 6=×1.5, 면당 +0.1)
export function damageBonusFor(value: number): number {
  return 1 + (value - 1) * 0.1;
}

export function roll(cfg: DieConfig, rng: () => number = Math.random): RollResult {
  const value = rollDie(cfg, rng);
  return {
    value,
    damageBonus: damageBonusFor(value),
    initiative: value, // 낮을수록 선공
  };
}
