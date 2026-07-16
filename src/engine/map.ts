// 분기 맵 (설계 문서 9장) — 노드를 골라 위로 오른다.

export type NodeType = "combat" | "elite" | "rest" | "boss";

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  next: string[]; // 다음 행에서 이동 가능한 노드 id
}

export interface GameMap {
  nodes: Record<string, MapNode>;
  rows: string[][]; // 행별 노드 id
}

export const NODE_INFO: Record<NodeType, { emoji: string; name: string }> = {
  combat: { emoji: "⚔️", name: "전투" },
  elite: { emoji: "☠️", name: "엘리트" },
  rest: { emoji: "🔥", name: "휴식" },
  boss: { emoji: "👑", name: "보스" },
};

const ROW_WIDTHS = [2, 3, 2, 3, 1]; // 마지막 행 = 보스

export function generateMap(rng: () => number = Math.random): GameMap {
  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];

  ROW_WIDTHS.forEach((w, row) => {
    const ids: string[] = [];
    for (let col = 0; col < w; col++) {
      const id = `n${row}-${col}`;
      let type: NodeType;
      if (row === ROW_WIDTHS.length - 1) type = "boss";
      else if (row === 0) type = "combat"; // 부드러운 시작
      else {
        const r = rng();
        type = r < 0.6 ? "combat" : r < 0.8 ? "elite" : "rest";
      }
      nodes[id] = { id, row, col, type, next: [] };
      ids.push(id);
    }
    rows.push(ids);
  });

  // 간선 연결
  for (let row = 0; row < ROW_WIDTHS.length - 1; row++) {
    const cur = rows[row];
    const nxt = rows[row + 1];

    cur.forEach((id, i) => {
      const ratio = cur.length > 1 ? i / (cur.length - 1) : 0.5;
      const center = Math.round(ratio * (nxt.length - 1));
      const targets = new Set<number>([center]);
      if (rng() < 0.55) targets.add(Math.min(nxt.length - 1, center + 1));
      if (rng() < 0.35) targets.add(Math.max(0, center - 1));
      targets.forEach((t) => {
        if (!nodes[id].next.includes(nxt[t])) nodes[id].next.push(nxt[t]);
      });
    });

    // 다음 행의 모든 노드가 최소 1개 진입로를 갖도록 보정
    nxt.forEach((nid, j) => {
      const hasIncoming = cur.some((id) => nodes[id].next.includes(nid));
      if (!hasIncoming) {
        const ratio = nxt.length > 1 ? j / (nxt.length - 1) : 0.5;
        const ci = Math.round(ratio * (cur.length - 1));
        if (!nodes[cur[ci]].next.includes(nid)) nodes[cur[ci]].next.push(nid);
      }
    });
  }

  return { nodes, rows };
}
