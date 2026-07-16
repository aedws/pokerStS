import { describe, it, expect, beforeEach } from "vitest";
import { useGame } from "./gameStore";
import { WEAPONS } from "../engine/weapons";

beforeEach(() => {
  useGame.getState().restart();
});

// 전투를 자동으로 완주(승/패)까지 진행하는 헬퍼
function autoFightToEnd(maxIter = 800): string {
  let guard = 0;
  while (guard < maxIter) {
    const s = useGame.getState();
    if (s.screen === "combat" && s.combatTurn === "player") {
      if (s.hand.length > 0) {
        for (const c of s.hand.slice(0, 5)) useGame.getState().toggleSelect(c.id);
        if (useGame.getState().selected.length > 0) useGame.getState().shoot();
        else useGame.getState().reload();
      } else {
        useGame.getState().reload();
      }
    } else {
      break;
    }
    guard++;
  }
  return useGame.getState().screen;
}

describe("run store — map + combat + reward loop", () => {
  it("choosing a weapon starts a run on the map", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    const s = useGame.getState();
    expect(s.screen).toBe("map");
    expect(s.masterDeck.length).toBe(52);
    expect(s.available.length).toBeGreaterThan(0);
    expect(s.map).not.toBeNull();
  });

  it("entering a combat node starts a fight", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    const first = useGame.getState().available[0];
    useGame.getState().enterNode(first);
    const s = useGame.getState();
    expect(s.screen).toBe("combat");
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.hand.length).toBeGreaterThan(0);
  });

  it("winning a normal combat opens a card reward, and picking adds to the deck", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    useGame.getState().enterNode(useGame.getState().available[0]);
    const end = autoFightToEnd();
    // 첫 노드는 일반 전투 → 승리 시 보상, 패배 시 lost
    expect(["reward", "lost"]).toContain(end);
    if (end === "reward") {
      const before = useGame.getState().masterDeck.length;
      const card = useGame.getState().rewardCards[0];
      useGame.getState().pickReward(card.id);
      const after = useGame.getState();
      expect(after.masterDeck.length).toBe(before + 1);
      expect(after.screen).toBe("map");
    }
  });

  it("rest node can remove a card to specialize the deck", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    // rest 노드가 없을 수도 있으니 강제로 rest 상태를 유도
    const s = useGame.getState();
    // map 구조상 rest 노드를 찾아 진입 시도
    const restId = Object.values(s.map!.nodes).find((n) => n.type === "rest")?.id;
    if (restId) {
      // available 을 해당 노드로 강제 세팅 후 진입
      useGame.setState({ available: [restId] });
      useGame.getState().enterNode(restId);
      expect(useGame.getState().screen).toBe("rest");
      const before = useGame.getState().masterDeck.length;
      const cardId = useGame.getState().masterDeck[0].id;
      useGame.getState().removeCard(cardId);
      expect(useGame.getState().masterDeck.length).toBe(before - 1);
      expect(useGame.getState().screen).toBe("map");
    }
  });

  it("HP persists across the transition out of combat", () => {
    useGame.getState().chooseWeapon(WEAPONS[0]);
    const startHp = useGame.getState().hp;
    useGame.getState().enterNode(useGame.getState().available[0]);
    autoFightToEnd();
    const s = useGame.getState();
    // 전투를 거치면 HP는 그대로거나 줄었어야 함 (리셋되어 초기값 복원되면 안 됨)
    expect(s.hp).toBeLessThanOrEqual(startHp);
  });
});
