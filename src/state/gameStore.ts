import { create } from "zustand";
import type { Card } from "../engine/cards";
import { buildStandardDeck, shuffle, cardElement } from "../engine/cards";
import type { Element } from "../engine/cards";
import { BASE_DIE, rollDie, damageBonusFor } from "../engine/dice";
import type { DieConfig } from "../engine/dice";
import { computeAttack } from "../engine/damage";
import type { AttackBreakdown } from "../engine/damage";
import type { EnemyInstance } from "../engine/enemies";
import { defaultEncounter } from "../engine/enemies";
import type { Weapon } from "../engine/weapons";
import { WEAPONS } from "../engine/weapons";
import { xpForLevel, xpReward } from "../engine/progression";

export type Phase = "intro" | "player" | "enemy" | "won" | "lost";

// 참고: 설계 문서의 "턴당 행동 수(기본1~최대6)"를 MVP에서는
//  - shotsPerTurn = 턴당 사격 횟수(성장 대상)
//  - reloadsPerShot = 사격 전 재장전(재굴림) 허용 횟수(크리 노림/족보 개선)
// 로 분리 해석한다. (문서 8장 성장으로 확장 예정)
const RELOADS_PER_SHOT = 2;

// 속성 → 상태이상 부여량
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
  phase: Phase;

  weapon: Weapon | null;
  deck: Card[]; // 드로우 더미
  discard: Card[];
  hand: Card[];
  selected: string[]; // 선택된 카드 id

  die: DieConfig;
  currentRoll: number | null; // 이번 사격에 로드된 눈
  crit: boolean; // 현재 손패가 크리티컬인지 (재장전 연속 같은 눈)
  reloadsLeft: number;
  shotsLeft: number;
  shotsPerTurn: number;

  enemies: EnemyInstance[];
  targetId: string | null;

  playerHp: number;
  playerMaxHp: number;

  level: number;
  xp: number;
  turn: number;

  log: string[];

  // 이펙트 트리거 (UI 애니메이션용)
  fx: HitFx[]; // 이번 사격의 플로팅 데미지
  fxSeq: number; // 사격 이펙트 시퀀스
  rollSeq: number; // 주사위 굴림 애니메이션 트리거
  flash: "crit" | "flush" | null; // 화면 플래시
  playerHitSeq: number; // 플레이어 피격 트리거
  playerHitAmount: number;

  // actions
  chooseWeapon: (w: Weapon) => void;
  toggleSelect: (id: string) => void;
  setTarget: (id: string) => void;
  reload: () => void;
  shoot: () => void;
  restart: () => void;

  // derived
  preview: () => AttackBreakdown | null;
}

function drawCards(
  deck: Card[],
  discard: Card[],
  n: number
): { hand: Card[]; deck: Card[]; discard: Card[] } {
  let d = deck.slice();
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
  return { hand, deck: d, discard: dis };
}

function liveEnemies(enemies: EnemyInstance[]): EnemyInstance[] {
  return enemies.filter((e) => e.hp > 0);
}

// 조준 대상이 죽었으면 살아있는 적으로 옮긴다
function retarget(enemies: EnemyInstance[], current: string | null): string | null {
  const cur = enemies.find((e) => e.id === current);
  if (cur && cur.hp > 0) return current;
  return liveEnemies(enemies)[0]?.id ?? null;
}

export const useGame = create<GameState>((set, get) => ({
  phase: "intro",
  weapon: null,
  deck: [],
  discard: [],
  hand: [],
  selected: [],
  die: { ...BASE_DIE },
  currentRoll: null,
  crit: false,
  reloadsLeft: 0,
  shotsLeft: 0,
  shotsPerTurn: 1,
  enemies: [],
  targetId: null,
  playerHp: 80,
  playerMaxHp: 80,
  level: 1,
  xp: 0,
  turn: 0,
  log: [],
  fx: [],
  fxSeq: 0,
  rollSeq: 0,
  flash: null,
  playerHitSeq: 0,
  playerHitAmount: 0,

  chooseWeapon: (w) => {
    const deck = shuffle(buildStandardDeck());
    const enemies = defaultEncounter();
    set({
      weapon: w,
      deck,
      discard: [],
      enemies,
      targetId: enemies[0].id,
      playerHp: 80,
      playerMaxHp: 80,
      level: 1,
      xp: 0,
      turn: 0,
      shotsPerTurn: 1,
      log: [
        `${w.emoji} ${w.name} 장비. 무법자 ${enemies.length}명과 대치한다.`,
      ],
    });
    startPlayerTurn(set, get);
  },

  toggleSelect: (id) => {
    const { selected, weapon } = get();
    const cap = weapon?.magazineCap ?? 5;
    if (selected.includes(id)) {
      set({ selected: selected.filter((s) => s !== id) });
    } else {
      // 족보는 최대 5장까지 의미가 있음
      if (selected.length >= Math.min(5, cap)) return;
      set({ selected: [...selected, id] });
    }
  },

  setTarget: (id) => set({ targetId: id }),

  reload: () => {
    const s = get();
    if (s.phase !== "player" || s.reloadsLeft <= 0) return;
    const prev = s.currentRoll;
    const value = rollDie(s.die);
    const crit = prev !== null && prev === value;
    const cap = s.weapon!.magazineCap;
    const loadCount = Math.min(value, cap);
    const discardAll = [...s.discard, ...s.hand];
    const drawn = drawCards(s.deck, discardAll, loadCount);
    set({
      currentRoll: value,
      crit,
      reloadsLeft: s.reloadsLeft - 1,
      hand: drawn.hand,
      deck: drawn.deck,
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
    if (s.phase !== "player") return;
    const selectedCards = s.hand.filter((c) => s.selected.includes(c.id));
    if (selectedCards.length === 0) return;

    const damageBonus = damageBonusFor(s.currentRoll ?? 1);
    let targets: EnemyInstance[];
    if (s.weapon!.fireMode === "all") {
      targets = liveEnemies(s.enemies);
    } else {
      // 조준 대상이 이미 쓰러졌으면 살아있는 적으로 자동 재조준
      const aimed =
        s.enemies.find((e) => e.id === s.targetId && e.hp > 0) ??
        liveEnemies(s.enemies)[0];
      targets = aimed ? [aimed] : [];
    }

    if (targets.length === 0) return;

    const log = [...s.log];
    let enemies = s.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } }));
    const fx: HitFx[] = [];
    let sawFlush = false;

    for (const t of targets) {
      const idx = enemies.findIndex((e) => e.id === t.id);
      if (idx < 0 || enemies[idx].hp <= 0) continue;
      const enemy = enemies[idx];
      const atk = computeAttack(selectedCards, enemy.reactions, {
        damageBonus,
        crit: s.crit,
        singleSuitMult: s.weapon!.singleSuitMult,
      });
      if (atk.hand.type.key.includes("flush")) sawFlush = true;

      // 감전: 기존 shock 스택으로 이번 피해 증폭 후 소비
      let dmg = atk.total;
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

      // 이번 사격 속성으로 상태이상 부여 (실제 피해가 있는 속성만)
      for (const share of atk.shares) {
        const add = STATUS_ON_HIT[share.element];
        for (const k of Object.keys(add) as (keyof typeof add)[]) {
          enemy.statuses[k] = (enemy.statuses[k] ?? 0) + (add[k] ?? 0);
        }
      }

      const handName = atk.hand.type.name;
      log.push(
        `${s.weapon!.emoji} ${handName} → ${enemy.name}에게 ${dmg} 피해` +
          (s.crit ? " (크리티컬!)" : "") +
          (enemy.hp <= 0 ? " · 처치!" : ` (남은 HP ${enemy.hp})`)
      );
    }

    set({
      enemies,
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

  restart: () => {
    set({
      phase: "intro",
      weapon: null,
      enemies: [],
      hand: [],
      selected: [],
      log: [],
    });
  },

  preview: () => {
    const s = get();
    if (s.phase !== "player" || !s.weapon) return null;
    const selectedCards = s.hand.filter((c) => s.selected.includes(c.id));
    if (selectedCards.length === 0) return null;
    const target =
      s.enemies.find((e) => e.id === s.targetId && e.hp > 0) ??
      liveEnemies(s.enemies)[0];
    const reactions = target?.reactions ?? {};
    return computeAttack(selectedCards, reactions, {
      damageBonus: damageBonusFor(s.currentRoll ?? 1),
      crit: s.crit,
      singleSuitMult: s.weapon.singleSuitMult,
    });
  },
}));

// ---- 턴 진행 (스토어 외부 헬퍼) ----

type SetFn = (partial: Partial<GameState>) => void;
type GetFn = () => GameState;

function startPlayerTurn(set: SetFn, get: GetFn) {
  const s = get();
  set({ phase: "player", turn: s.turn + 1, shotsLeft: s.shotsPerTurn });
  beginShot(set, get);
}

function beginShot(set: SetFn, get: GetFn) {
  const s = get();
  const value = rollDie(s.die);
  const cap = s.weapon!.magazineCap;
  const loadCount = Math.min(value, cap);
  const drawn = drawCards(s.deck, s.discard, loadCount);
  set({
    currentRoll: value,
    crit: false,
    reloadsLeft: RELOADS_PER_SHOT,
    hand: drawn.hand,
    deck: drawn.deck,
    discard: drawn.discard,
    selected: [],
    rollSeq: s.rollSeq + 1,
    flash: null,
    log: [...s.log, `🎲 장전 → ${value} (${loadCount}발 · 손패 ${drawn.hand.length}장)`],
  });
}

function afterShoot(set: SetFn, get: GetFn) {
  const s = get();
  const discard = [...s.discard, ...s.hand];

  // 처치 XP 정산
  const killed = s.enemies.filter(
    (e) => e.hp <= 0 && !(e as EnemyInstance & { counted?: boolean }).counted
  );
  let xp = s.xp;
  let level = s.level;
  const log = [...s.log];
  const enemies = s.enemies.map((e) => {
    if (e.hp <= 0 && !(e as any).counted) {
      const reward = xpReward(e);
      xp += reward;
      (e as any).counted = true;
      log.push(`💀 ${e.name} 처치 · +${reward} XP`);
    }
    return e;
  });
  void killed;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    log.push(`⭐ 레벨 업! Lv.${level}`);
  }

  if (liveEnemies(enemies).length === 0) {
    set({ enemies, discard, hand: [], xp, level, log, phase: "won" });
    return;
  }

  const shotsLeft = s.shotsLeft - 1;
  if (shotsLeft > 0) {
    set({ enemies, discard, hand: [], xp, level, log, shotsLeft });
    beginShot(set, get);
  } else {
    set({ enemies, discard, hand: [], xp, level, log, shotsLeft: 0 });
    enemyTurn(set, get);
  }
}

function enemyTurn(set: SetFn, get: GetFn) {
  const s = get();
  set({ phase: "enemy" });
  const lastRoll = s.currentRoll ?? 6;
  let log = [...s.log];
  let playerHp = s.playerHp;
  let playerDamage = 0;

  const enemies = s.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } }));

  for (const e of enemies) {
    if (e.hp <= 0) continue;

    // 도트 상태이상 처리 (화상/독)
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

    // 빙결: 이번 공격 스킵
    if (e.statuses.chill > 0) {
      e.statuses.chill -= 1;
      log.push(`❄️ ${e.name} 빙결로 행동 불가.`);
      continue;
    }

    // 선공(이니셔티브): 플레이어가 이 적보다 빠르면(낮은 눈) 공격 무효
    if (lastRoll <= e.speed) {
      log.push(`⚡ 선공! ${e.name}의 공격을 앞질러 무력화.`);
      continue;
    }

    playerHp = Math.max(0, playerHp - e.attack);
    playerDamage += e.attack;
    log.push(`${e.emoji} ${e.name}의 반격 · ${e.attack} 피해 (내 HP ${playerHp})`);
  }

  // 도트로 죽은 적 XP 정산
  let xp = s.xp;
  let level = s.level;
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
    log.push(`⭐ 레벨 업! Lv.${level}`);
  }

  const hitFx =
    playerDamage > 0
      ? { playerHitSeq: s.playerHitSeq + 1, playerHitAmount: playerDamage }
      : {};

  if (playerHp <= 0) {
    set({ enemies, playerHp: 0, xp, level, log, phase: "lost", ...hitFx });
    return;
  }
  if (liveEnemies(enemies).length === 0) {
    set({ enemies, playerHp, xp, level, log, phase: "won", ...hitFx });
    return;
  }

  set({
    enemies,
    playerHp,
    xp,
    level,
    log,
    targetId: retarget(enemies, s.targetId),
    ...hitFx,
  });
  startPlayerTurn(set, get);
}

// 무기 목록 재노출 (UI 편의)
export { WEAPONS };
export function cardElementOf(card: Card): Element {
  return cardElement(card);
}
