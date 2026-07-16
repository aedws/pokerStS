import { create } from "zustand";
import type { Card, Element } from "../engine/cards";
import {
  buildStandardDeck,
  shuffle,
  randomRewardCards,
} from "../engine/cards";
import { BASE_DIE, rollDie, damageBonusFor } from "../engine/dice";
import type { DieConfig } from "../engine/dice";
import { computeAttack } from "../engine/damage";
import type { AttackBreakdown } from "../engine/damage";
import type { EnemyInstance } from "../engine/enemies";
import { buildEncounter } from "../engine/enemies";
import type { Weapon } from "../engine/weapons";
import { WEAPONS } from "../engine/weapons";
import { xpForLevel, xpReward } from "../engine/progression";
import { generateMap } from "../engine/map";
import type { GameMap, NodeType } from "../engine/map";
import { applyRelics, relicCtx, randomRelics } from "../engine/relics";
import type { Relic } from "../engine/relics";

// 화면(런 전체 흐름)
export type Screen =
  | "intro"
  | "map"
  | "combat"
  | "reward"
  | "cull"
  | "relicReward"
  | "rest"
  | "won"
  | "lost";
export type CombatTurn = "player" | "enemy";

export interface AttackView extends AttackBreakdown {
  relicMult: number;
  relicNotes: { emoji: string; mult: number }[];
}

const START_HP = 80;
const REST_HEAL = 0.3;
const LEVELUP_HP = 6;
const RELOADS_PER_SHOT = 2;
const DECK_CAP = 52; // 이 이상이면 강제로 한 장 교체(cull)
const INITIATIVE_MAX = 3; // 주사위 눈이 이 값 이하이면 선공(반격 무효)

const STATUS_ON_HIT: Record<Element, Partial<EnemyInstance["statuses"]>> = {
  fire: { burn: 3 },
  ice: { chill: 1 },
  lightning: { shock: 1 },
  poison: { poison: 3 },
};

export interface HitFx {
  id: number;
  enemyId: string;
  amount: number;
  crit: boolean;
  element: Element;
}
let fxCounter = 0;

interface GameState {
  screen: Screen;
  combatTurn: CombatTurn;

  // ---- 런(run) 지속 상태 ----
  weapon: Weapon | null;
  masterDeck: Card[]; // 넣고 빼며 특화하는 마스터 덱
  hp: number;
  maxHp: number;
  level: number;
  xp: number;

  relics: string[]; // 보유 유물 key

  map: GameMap | null;
  available: string[]; // 지금 진입 가능한 노드 id
  currentRow: number;
  currentNodeId: string | null;
  currentNodeType: NodeType | null;

  rewardCards: Card[]; // 전투 보상 후보 (카드)
  relicChoices: Relic[]; // 엘리트 보상 후보 (유물)

  // ---- 전투(combat) 일시 상태 ----
  drawPile: Card[];
  discard: Card[];
  hand: Card[];
  selected: string[];
  die: DieConfig;
  currentRoll: number | null;
  crit: boolean;
  reloadsLeft: number;
  shotsLeft: number;
  shotsPerTurn: number;
  turn: number;
  enemies: EnemyInstance[];
  targetId: string | null;

  // ---- 이펙트 트리거 ----
  fx: HitFx[];
  fxSeq: number;
  rollSeq: number;
  flash: "crit" | "flush" | null;
  playerHitSeq: number;
  playerHitAmount: number;

  log: string[];

  // ---- 액션 ----
  chooseWeapon: (w: Weapon) => void;
  enterNode: (id: string) => void;
  toggleSelect: (id: string) => void;
  setTarget: (id: string) => void;
  reload: () => void;
  shoot: () => void;
  pickReward: (cardId: string) => void;
  skipReward: () => void;
  cullCard: (cardId: string) => void;
  pickRelic: (key: string) => void;
  restHeal: () => void;
  removeCard: (cardId: string) => void;
  restart: () => void;

  preview: () => AttackView | null;
}

function drawCards(
  pile: Card[],
  discard: Card[],
  n: number
): { hand: Card[]; pile: Card[]; discard: Card[] } {
  let d = pile.slice();
  let dis = discard.slice();
  const hand: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (d.length === 0) {
      if (dis.length === 0) break;
      d = shuffle(dis);
      dis = [];
    }
    hand.push(d.shift()!);
  }
  return { hand, pile: d, discard: dis };
}

function liveEnemies(enemies: EnemyInstance[]): EnemyInstance[] {
  return enemies.filter((e) => e.hp > 0);
}

function retarget(enemies: EnemyInstance[], current: string | null): string | null {
  const cur = enemies.find((e) => e.id === current);
  if (cur && cur.hp > 0) return current;
  return liveEnemies(enemies)[0]?.id ?? null;
}

// 포커 데미지 + 유물 시너지까지 합친 최종 공격 계산 (preview / shoot 공용)
function finalAttack(
  s: { weapon: Weapon | null; currentRoll: number | null; crit: boolean; relics: string[] },
  selectedCards: Card[],
  reactions: EnemyInstance["reactions"]
): AttackView {
  const atk = computeAttack(selectedCards, reactions, {
    damageBonus: damageBonusFor(s.currentRoll ?? 1),
    crit: s.crit,
    singleSuitMult: s.weapon!.singleSuitMult,
  });
  const { mult, notes } = applyRelics(
    s.relics,
    relicCtx(atk, selectedCards.length, s.crit)
  );
  const total = Math.round(atk.total * mult);
  const perElement = atk.perElement.map((p) => ({
    element: p.element,
    amount: Math.round(p.amount * mult),
  }));
  return { ...atk, total, perElement, relicMult: mult, relicNotes: notes };
}

export const useGame = create<GameState>((set, get) => ({
  screen: "intro",
  combatTurn: "player",
  weapon: null,
  masterDeck: [],
  hp: START_HP,
  maxHp: START_HP,
  level: 1,
  xp: 0,
  relics: [],
  map: null,
  available: [],
  currentRow: 0,
  currentNodeId: null,
  currentNodeType: null,
  rewardCards: [],
  relicChoices: [],
  drawPile: [],
  discard: [],
  hand: [],
  selected: [],
  die: { ...BASE_DIE },
  currentRoll: null,
  crit: false,
  reloadsLeft: 0,
  shotsLeft: 0,
  shotsPerTurn: 1,
  turn: 0,
  enemies: [],
  targetId: null,
  fx: [],
  fxSeq: 0,
  rollSeq: 0,
  flash: null,
  playerHitSeq: 0,
  playerHitAmount: 0,
  log: [],

  chooseWeapon: (w) => {
    const map = generateMap();
    set({
      weapon: w,
      masterDeck: buildStandardDeck(),
      hp: START_HP,
      maxHp: START_HP,
      level: 1,
      xp: 0,
      relics: [],
      map,
      available: map.rows[0],
      currentRow: 0,
      currentNodeId: null,
      currentNodeType: null,
      screen: "map",
      log: [`${w.emoji} ${w.name} 장비. 황무지의 탑을 오른다.`],
    });
  },

  enterNode: (id) => {
    const s = get();
    if (!s.map || !s.available.includes(id)) return;
    const node = s.map.nodes[id];
    set({ currentNodeId: id, currentNodeType: node.type });
    if (node.type === "rest") {
      set({
        screen: "rest",
        log: [...s.log, `🔥 휴식 지점에 도착했다.`],
      });
    } else {
      startCombat(set, get, node.type, node.row);
    }
  },

  toggleSelect: (id) => {
    const { selected, weapon } = get();
    const cap = weapon?.magazineCap ?? 5;
    if (selected.includes(id)) {
      set({ selected: selected.filter((s) => s !== id) });
    } else {
      if (selected.length >= Math.min(5, cap)) return;
      set({ selected: [...selected, id] });
    }
  },

  setTarget: (id) => set({ targetId: id }),

  reload: () => {
    const s = get();
    if (s.screen !== "combat" || s.combatTurn !== "player" || s.reloadsLeft <= 0)
      return;
    const prev = s.currentRoll;
    const value = rollDie(s.die);
    const crit = prev !== null && prev === value;
    const cap = s.weapon!.magazineCap;
    const loadCount = Math.min(value, cap);
    const drawn = drawCards(s.drawPile, [...s.discard, ...s.hand], loadCount);
    set({
      currentRoll: value,
      crit,
      reloadsLeft: s.reloadsLeft - 1,
      hand: drawn.hand,
      drawPile: drawn.pile,
      discard: drawn.discard,
      selected: [],
      rollSeq: s.rollSeq + 1,
      log: [
        ...s.log,
        `🎲 재장전 → ${value} (${loadCount}발 장전)` +
          (crit ? " · 같은 눈! 크리티컬 장전!" : ""),
      ],
    });
  },

  shoot: () => {
    const s = get();
    if (s.screen !== "combat" || s.combatTurn !== "player") return;
    const selectedCards = s.hand.filter((c) => s.selected.includes(c.id));
    if (selectedCards.length === 0) return;

    let targets: EnemyInstance[];
    if (s.weapon!.fireMode === "all") {
      targets = liveEnemies(s.enemies);
    } else {
      const aimed =
        s.enemies.find((e) => e.id === s.targetId && e.hp > 0) ??
        liveEnemies(s.enemies)[0];
      targets = aimed ? [aimed] : [];
    }
    if (targets.length === 0) return;

    const log = [...s.log];
    const enemies = s.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } }));
    const fx: HitFx[] = [];
    let sawFlush = false;

    for (const t of targets) {
      const idx = enemies.findIndex((e) => e.id === t.id);
      if (idx < 0 || enemies[idx].hp <= 0) continue;
      const enemy = enemies[idx];
      const atk = finalAttack(s, selectedCards, enemy.reactions);
      if (atk.hand.type.key.includes("flush")) sawFlush = true;

      let dmg = atk.total; // 유물 배수까지 반영된 값
      if (enemy.statuses.shock > 0) {
        dmg = Math.round(dmg * (1 + 0.3 * enemy.statuses.shock));
        enemy.statuses.shock = 0;
      }
      enemy.hp = Math.max(0, enemy.hp - dmg);

      fx.push({
        id: ++fxCounter,
        enemyId: enemy.id,
        amount: dmg,
        crit: s.crit,
        element: atk.shares[0]?.element ?? "fire",
      });

      for (const share of atk.shares) {
        const add = STATUS_ON_HIT[share.element];
        for (const k of Object.keys(add) as (keyof typeof add)[]) {
          enemy.statuses[k] = (enemy.statuses[k] ?? 0) + (add[k] ?? 0);
        }
      }

      log.push(
        `${s.weapon!.emoji} ${atk.hand.type.name} → ${enemy.name}에게 ${dmg} 피해` +
          (s.crit ? " (크리티컬!)" : "") +
          (enemy.hp <= 0 ? " · 처치!" : ` (남은 HP ${enemy.hp})`)
      );
    }

    set({
      enemies,
      discard: [...s.discard, ...s.hand],
      hand: [],
      selected: [],
      log,
      targetId: retarget(enemies, s.targetId),
      fx,
      fxSeq: s.fxSeq + 1,
      flash: s.crit ? "crit" : sawFlush ? "flush" : null,
    });
    afterShoot(set, get);
  },

  pickReward: (cardId) => {
    const s = get();
    const card = s.rewardCards.find((c) => c.id === cardId);
    if (!card) return;
    const deck = [...s.masterDeck, card];
    const log = [...s.log, `🃏 카드 획득: 덱에 추가 (덱 ${deck.length}장)`];
    set({ masterDeck: deck, rewardCards: [], log });
    // 52장을 넘으면 강제로 한 장 교체(cull)해서 덱을 특화 상태로 유지
    if (deck.length > DECK_CAP) {
      set({ screen: "cull", log: [...log, `덱이 ${DECK_CAP}장을 넘었다 — 뺄 카드를 고르세요.`] });
    } else {
      advanceMap(set, get);
    }
  },

  skipReward: () => {
    const s = get();
    set({ rewardCards: [], log: [...s.log, `보상을 건너뛰었다.`] });
    advanceMap(set, get);
  },

  cullCard: (cardId) => {
    const s = get();
    if (s.masterDeck.length <= 5) return;
    const deck = s.masterDeck.filter((c) => c.id !== cardId);
    set({
      masterDeck: deck,
      log: [...s.log, `🔁 카드 교체 · 덱 특화 (덱 ${deck.length}장)`],
    });
    if (deck.length > DECK_CAP) return; // 여전히 초과면 cull 유지
    advanceMap(set, get);
  },

  pickRelic: (key) => {
    const s = get();
    if (s.relics.includes(key)) return;
    const relic = s.relicChoices.find((r) => r.key === key);
    set({
      relics: [...s.relics, key],
      relicChoices: [],
      log: [...s.log, `🏺 유물 획득: ${relic?.name ?? key}`],
    });
    advanceMap(set, get);
  },

  restHeal: () => {
    const s = get();
    const heal = Math.round(s.maxHp * REST_HEAL);
    const hp = Math.min(s.maxHp, s.hp + heal);
    set({ hp, log: [...s.log, `🔥 휴식 · HP +${hp - s.hp === 0 ? heal : hp - s.hp} 회복`] });
    advanceMap(set, get);
  },

  removeCard: (cardId) => {
    const s = get();
    if (s.masterDeck.length <= 5) return; // 최소 덱 크기 보호
    set({
      masterDeck: s.masterDeck.filter((c) => c.id !== cardId),
      log: [...s.log, `🗑️ 카드 제거 · 덱 특화 (덱 ${s.masterDeck.length - 1}장)`],
    });
    advanceMap(set, get);
  },

  restart: () => {
    set({
      screen: "intro",
      weapon: null,
      masterDeck: [],
      relics: [],
      enemies: [],
      hand: [],
      selected: [],
      map: null,
      log: [],
    });
  },

  preview: () => {
    const s = get();
    if (s.screen !== "combat" || s.combatTurn !== "player" || !s.weapon)
      return null;
    const selectedCards = s.hand.filter((c) => s.selected.includes(c.id));
    if (selectedCards.length === 0) return null;
    const target =
      s.enemies.find((e) => e.id === s.targetId && e.hp > 0) ??
      liveEnemies(s.enemies)[0];
    return finalAttack(s, selectedCards, target?.reactions ?? {});
  },
}));

// ---- 헬퍼 (스토어 외부) ----
type SetFn = (partial: Partial<GameState>) => void;
type GetFn = () => GameState;

function startCombat(set: SetFn, get: GetFn, type: NodeType, row: number) {
  const s = get();
  const enemies = buildEncounter(type, row);
  const shotsPerTurn = Math.min(6, 1 + Math.floor((s.level - 1) / 3));
  set({
    screen: "combat",
    combatTurn: "player",
    drawPile: shuffle(s.masterDeck),
    discard: [],
    hand: [],
    selected: [],
    enemies,
    targetId: enemies[0]?.id ?? null,
    shotsPerTurn,
    turn: 0,
    currentRoll: null,
    crit: false,
    fx: [],
    flash: null,
    log: [
      ...s.log,
      `⚔️ ${enemies.map((e) => e.name).join(", ")} 등장! (덱 ${s.masterDeck.length}장)`,
    ],
  });
  startPlayerTurn(set, get);
}

function startPlayerTurn(set: SetFn, get: GetFn) {
  const s = get();
  set({ combatTurn: "player", turn: s.turn + 1, shotsLeft: s.shotsPerTurn });
  beginShot(set, get);
}

function beginShot(set: SetFn, get: GetFn) {
  const s = get();
  const value = rollDie(s.die);
  const cap = s.weapon!.magazineCap;
  const loadCount = Math.min(value, cap);
  const drawn = drawCards(s.drawPile, s.discard, loadCount);
  set({
    currentRoll: value,
    crit: false,
    reloadsLeft: RELOADS_PER_SHOT,
    hand: drawn.hand,
    drawPile: drawn.pile,
    discard: drawn.discard,
    selected: [],
    rollSeq: s.rollSeq + 1,
    flash: null,
    log: [...s.log, `🎲 장전 → ${value} (${loadCount}발 · 손패 ${drawn.hand.length}장)`],
  });
}

function grantXpAndLevel(
  enemies: EnemyInstance[],
  xp0: number,
  level0: number,
  maxHp0: number,
  hp0: number,
  log: string[]
) {
  let xp = xp0;
  let level = level0;
  let maxHp = maxHp0;
  let hp = hp0;
  for (const e of enemies) {
    if (e.hp <= 0 && !(e as any).counted) {
      const reward = xpReward(e);
      xp += reward;
      (e as any).counted = true;
      log.push(`💀 ${e.name} 처치 · +${reward} XP`);
    }
  }
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    maxHp += LEVELUP_HP;
    hp += LEVELUP_HP;
    log.push(`⭐ 레벨 업! Lv.${level} · 최대 HP +${LEVELUP_HP}`);
  }
  return { xp, level, maxHp, hp };
}

function winCombat(set: SetFn, get: GetFn, base: Partial<GameState>) {
  const s = get();
  const log = base.log ?? s.log;
  if (s.currentNodeType === "boss") {
    set({ ...base, screen: "won" });
    return;
  }
  // 엘리트 승리 = 유물(시너지) 보상
  if (s.currentNodeType === "elite") {
    const choices = randomRelics(3, s.relics);
    if (choices.length > 0) {
      set({
        ...base,
        screen: "relicReward",
        relicChoices: choices,
        log: [...log, `🏆 엘리트 격파! 유물을 고르세요.`],
      });
      return;
    }
  }
  // 일반 전투 승리 = 카드 보상
  set({
    ...base,
    screen: "reward",
    rewardCards: randomRewardCards(3),
    log: [...log, `🏆 승리! 보상 카드를 고르세요.`],
  });
}

function afterShoot(set: SetFn, get: GetFn) {
  const s = get();
  const log = [...s.log];
  const enemies = s.enemies;
  const g = grantXpAndLevel(enemies, s.xp, s.level, s.maxHp, s.hp, log);

  if (liveEnemies(enemies).length === 0) {
    winCombat(set, get, {
      enemies,
      hand: [],
      xp: g.xp,
      level: g.level,
      maxHp: g.maxHp,
      hp: g.hp,
      log,
    });
    return;
  }

  const shotsLeft = s.shotsLeft - 1;
  if (shotsLeft > 0) {
    set({
      enemies,
      xp: g.xp,
      level: g.level,
      maxHp: g.maxHp,
      hp: g.hp,
      log,
      shotsLeft,
    });
    beginShot(set, get);
  } else {
    set({
      enemies,
      xp: g.xp,
      level: g.level,
      maxHp: g.maxHp,
      hp: g.hp,
      log,
      shotsLeft: 0,
    });
    enemyTurn(set, get);
  }
}

function enemyTurn(set: SetFn, get: GetFn) {
  const s = get();
  set({ combatTurn: "enemy" });
  const lastRoll = s.currentRoll ?? 6;
  // 선공(이니셔티브): 마지막 사격의 눈이 낮으면 이번 턴 적 반격을 전부 무효화
  const hasInitiative = lastRoll <= INITIATIVE_MAX;
  const log = [...s.log];
  let hp = s.hp;
  let playerDamage = 0;

  const enemies = s.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } }));
  if (hasInitiative) {
    log.push(`⚡ 선공! (눈 ${lastRoll}) 이번 턴 적의 반격을 모두 무력화한다.`);
  }

  for (const e of enemies) {
    if (e.hp <= 0) continue;

    const dot = e.statuses.burn + e.statuses.poison;
    if (dot > 0) {
      e.hp = Math.max(0, e.hp - dot);
      log.push(
        `🔥☠️ ${e.name} 상태이상 ${dot} 피해` +
          (e.hp <= 0 ? " · 쓰러짐!" : ` (HP ${e.hp})`)
      );
      e.statuses.burn = Math.max(0, e.statuses.burn - 1);
      e.statuses.poison = Math.max(0, e.statuses.poison - 1);
      if (e.hp <= 0) continue;
    }

    // 선공이면 반격 무효 (상태이상은 위에서 이미 적용됨)
    if (hasInitiative) continue;

    if (e.statuses.chill > 0) {
      e.statuses.chill -= 1;
      log.push(`❄️ ${e.name} 빙결로 행동 불가.`);
      continue;
    }

    hp = Math.max(0, hp - e.attack);
    playerDamage += e.attack;
    log.push(`${e.emoji} ${e.name}의 반격 · ${e.attack} 피해 (내 HP ${hp})`);
  }

  const g = grantXpAndLevel(enemies, s.xp, s.level, s.maxHp, s.hp, log);
  const hitFx =
    playerDamage > 0
      ? { playerHitSeq: s.playerHitSeq + 1, playerHitAmount: playerDamage }
      : {};

  if (hp <= 0) {
    set({ enemies, hp: 0, xp: g.xp, level: g.level, log, screen: "lost", ...hitFx });
    return;
  }
  if (liveEnemies(enemies).length === 0) {
    winCombat(set, get, {
      enemies,
      hp: Math.min(g.maxHp, hp + (g.hp - s.hp)),
      maxHp: g.maxHp,
      xp: g.xp,
      level: g.level,
      log,
      ...hitFx,
    });
    return;
  }

  set({
    enemies,
    hp: Math.min(g.maxHp, hp + (g.hp - s.hp)),
    maxHp: g.maxHp,
    xp: g.xp,
    level: g.level,
    log,
    targetId: retarget(enemies, s.targetId),
    ...hitFx,
  });
  startPlayerTurn(set, get);
}

function advanceMap(set: SetFn, get: GetFn) {
  const s = get();
  if (!s.map || !s.currentNodeId) {
    set({ screen: "map" });
    return;
  }
  const node = s.map.nodes[s.currentNodeId];
  if (node.type === "boss" || node.next.length === 0) {
    set({ screen: "won" });
    return;
  }
  set({
    screen: "map",
    available: node.next,
    currentRow: node.row + 1,
    currentNodeId: null,
    currentNodeType: null,
  });
}

export { WEAPONS };
