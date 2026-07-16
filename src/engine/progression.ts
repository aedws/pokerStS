// 레벨업 & XP (설계 문서 8장)
import type { EnemyInstance } from "./enemies";

// 레벨업 필요 XP: 50 + (N-1)*25
export function xpForLevel(level: number): number {
  return 50 + (level - 1) * 25;
}

// 적 등급별 XP (초안): 일반 10 / 엘리트 30 / 보스 100 — maxHp 로 등급 추정
export function xpReward(enemy: EnemyInstance): number {
  if (enemy.maxHp >= 150) return 100; // 보스
  if (enemy.maxHp >= 90) return 30; // 엘리트
  return 10; // 일반
}
