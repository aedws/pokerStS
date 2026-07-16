import { describe, it, expect, beforeEach } from "vitest";
import { useGame } from "./gameStore";
import { WEAPONS } from "../engine/weapons";

// 스토어 초기화 헬퍼
beforeEach(() => {
  useGame.getState().restart();
});

describe("combat store — full loop", () => {
  it("starts a combat after choosing a weapon", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    const s = useGame.getState();
    expect(s.phase).toBe("player");
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.hand.length).toBeGreaterThan(0);
    expect(s.currentRoll).toBeGreaterThanOrEqual(1);
  });

  it("shooting deals damage and progresses the turn", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    const before = useGame.getState();
    const targetBefore = before.enemies.find((e) => e.id === before.targetId)!;
    const hpBefore = targetBefore.hp;

    // 손패 첫 카드 선택 후 발사
    useGame.getState().toggleSelect(before.hand[0].id);
    useGame.getState().shoot();

    const after = useGame.getState();
    const targetAfter = after.enemies.find((e) => e.id === targetBefore.id)!;
    // 적이 피해를 입었거나 처치됨
    expect(targetAfter.hp).toBeLessThan(hpBefore);
  });

  it("can play to a terminal state (win or lose) without crashing", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    let guard = 0;
    while (
      useGame.getState().phase !== "won" &&
      useGame.getState().phase !== "lost" &&
      guard < 500
    ) {
      const s = useGame.getState();
      if (s.phase === "player") {
        if (s.hand.length > 0) {
          // 가능한 만큼 카드 선택 (최대 5장)
          for (const c of s.hand.slice(0, 5)) {
            useGame.getState().toggleSelect(c.id);
          }
          if (useGame.getState().selected.length > 0) {
            useGame.getState().shoot();
          } else {
            useGame.getState().reload();
          }
        } else {
          useGame.getState().reload();
        }
      }
      guard++;
    }
    expect(["won", "lost"]).toContain(useGame.getState().phase);
    expect(guard).toBeLessThan(500);
  });
});
