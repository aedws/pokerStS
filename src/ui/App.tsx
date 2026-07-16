import { useEffect, useRef, useState } from "react";
import { useGame, WEAPONS } from "../state/gameStore";
import type { HitFx } from "../state/gameStore";
import type { Card } from "../engine/cards";
import { rankLabel, SUIT_SYMBOL, SUIT_ELEMENT, ELEMENT_INFO } from "../engine/cards";
import type { Element } from "../engine/cards";
import type { EnemyInstance } from "../engine/enemies";
import { xpForLevel } from "../engine/progression";

export function App() {
  const phase = useGame((s) => s.phase);
  return (
    <div className="app">
      {phase === "intro" && <Intro />}
      {(phase === "player" || phase === "enemy") && <Combat />}
      {(phase === "won" || phase === "lost") && <Result />}
    </div>
  );
}

/* ---------------- Intro ---------------- */
function Intro() {
  const chooseWeapon = useGame((s) => s.chooseWeapon);
  return (
    <div className="intro">
      <div className="title">
        pokerStS
        <small>포커 × 주사위 × SF 카우보이</small>
      </div>
      <p className="hint">
        무기를 골라 시작. <b>주사위</b>로 장전하고 <b>포커 족보</b>로 데미지를,{" "}
        <b>카드 무늬</b>로 속성을 정합니다. 낮은 눈=선공, 높은 눈=데미지↑, 재장전
        같은 눈=크리티컬.
      </p>
      <div className="weapon-grid">
        {WEAPONS.map((w) => (
          <button
            key={w.key}
            className="panel weapon-card"
            onClick={() => chooseWeapon(w)}
          >
            <div className="emoji">{w.emoji}</div>
            <h3>{w.name}</h3>
            <p>{w.blurb}</p>
            <div className="spec">
              탄창 {w.magazineCap} · {w.fireMode === "all" ? "전체" : "단일"} 대상 ·
              단일무늬 ×{w.singleSuitMult}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
function ElementChip({ el, label }: { el: Element; label?: string }) {
  const info = ELEMENT_INFO[el];
  return (
    <span className={`el-chip ${el}`}>
      {info.symbol} {label ?? info.name}
    </span>
  );
}

const shakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6px) rotate(-1deg)" },
  { transform: "translateX(6px) rotate(1deg)" },
  { transform: "translateX(-4px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(0)" },
];

/* ---------------- Enemy ---------------- */
function reactionTags(enemy: EnemyInstance) {
  const tags: { el: Element; kind: "weak" | "resist" | "immune" }[] = [];
  (Object.keys(enemy.reactions) as Element[]).forEach((el) => {
    const v = enemy.reactions[el]!;
    if (v > 1) tags.push({ el, kind: "weak" });
    else if (v === 0) tags.push({ el, kind: "immune" });
    else if (v < 1) tags.push({ el, kind: "resist" });
  });
  return tags;
}

function EnemyCard({ enemy }: { enemy: EnemyInstance }) {
  const targetId = useGame((s) => s.targetId);
  const setTarget = useGame((s) => s.setTarget);
  const weapon = useGame((s) => s.weapon);
  const fx = useGame((s) => s.fx);
  const fxSeq = useGame((s) => s.fxSeq);
  const ref = useRef<HTMLDivElement>(null);
  const [floaters, setFloaters] = useState<HitFx[]>([]);

  useEffect(() => {
    const mine = fx.filter((f) => f.enemyId === enemy.id);
    if (mine.length === 0) return;
    setFloaters((p) => [...p, ...mine]);
    ref.current?.animate(shakeKeyframes, { duration: 380, easing: "ease-in-out" });
    const ids = new Set(mine.map((m) => m.id));
    const t = setTimeout(
      () => setFloaters((p) => p.filter((f) => !ids.has(f.id))),
      1000
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxSeq]);

  const dead = enemy.hp <= 0;
  const isTarget = targetId === enemy.id && weapon?.fireMode !== "all";
  const st = enemy.statuses;

  return (
    <div
      ref={ref}
      className={`enemy ${isTarget ? "target" : ""} ${dead ? "dead" : ""}`}
      onClick={() => !dead && setTarget(enemy.id)}
    >
      <div className="floaters">
        {floaters.map((f) => (
          <span key={f.id} className={`floater ${f.element} ${f.crit ? "crit" : ""}`}>
            {f.crit ? "★" : ""}-{f.amount}
          </span>
        ))}
      </div>
      <div className="emoji">{enemy.emoji}</div>
      <div className="ename">{enemy.name}</div>
      <div className="bar hp">
        <span style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
      </div>
      <div className="estat">
        HP {enemy.hp}/{enemy.maxHp} · ⚔️{enemy.attack} · 🏃{enemy.speed}
      </div>
      <div className="react">
        {reactionTags(enemy).map((t) => (
          <span key={t.el} className={`tag ${t.kind}`}>
            {ELEMENT_INFO[t.el].symbol}
            {t.kind === "weak" ? "약점" : t.kind === "immune" ? "면역" : "저항"}
          </span>
        ))}
      </div>
      <div className="statuses">
        {st.burn > 0 && <ElementChip el="fire" label={`${st.burn}`} />}
        {st.chill > 0 && <ElementChip el="ice" label={`${st.chill}`} />}
        {st.shock > 0 && <ElementChip el="lightning" label={`${st.shock}`} />}
        {st.poison > 0 && <ElementChip el="poison" label={`${st.poison}`} />}
      </div>
    </div>
  );
}

/* ---------------- Card ---------------- */
function PlayCard({ card, index }: { card: Card; index: number }) {
  const selected = useGame((s) => s.selected);
  const toggle = useGame((s) => s.toggleSelect);
  const el = SUIT_ELEMENT[card.suit];
  const sel = selected.includes(card.id);
  return (
    <button
      className={`pcard ${el} ${sel ? "sel" : ""}`}
      style={{ animationDelay: `${index * 45}ms` }}
      onClick={() => toggle(card.id)}
    >
      <div className="rank">{rankLabel(card.rank)}</div>
      <div className="cel">{ELEMENT_INFO[el].symbol}</div>
      <div className={`suit ${card.suit}`}>{SUIT_SYMBOL[card.suit]}</div>
    </button>
  );
}

/* ---------------- Dice ---------------- */
function Dice() {
  const roll = useGame((s) => s.currentRoll);
  const crit = useGame((s) => s.crit);
  const rollSeq = useGame((s) => s.rollSeq);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.animate(
      [
        { transform: "rotate(0) scale(1)" },
        { transform: "rotate(-18deg) scale(1.18)" },
        { transform: "rotate(14deg) scale(1.1)" },
        { transform: "rotate(0) scale(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }, [rollSeq]);
  return (
    <div ref={ref} className={`die ${crit ? "crit" : ""}`}>
      {roll ?? "-"}
    </div>
  );
}

/* ---------------- Combat ---------------- */
function Combat() {
  const s = useGame();
  const preview = useGame((st) => st.preview)();
  const weapon = s.weapon!;
  const canAct = s.phase === "player";
  const [logOpen, setLogOpen] = useState(false);

  // 플레이어 피격 흔들림
  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (s.playerHitSeq > 0)
      hudRef.current?.animate(shakeKeyframes, { duration: 400 });
  }, [s.playerHitSeq]);

  const load = Math.min(s.currentRoll ?? 0, weapon.magazineCap);
  const dmgBonus = (1 + ((s.currentRoll ?? 1) - 1) * 0.1).toFixed(1);

  return (
    <div className="combat">
      {/* 화면 플래시 */}
      {s.flash && <div key={s.fxSeq} className={`flash ${s.flash}`} />}

      {/* HUD */}
      <div className="hud" ref={hudRef}>
        <div className="hud-row">
          <span className="wpn">
            {weapon.emoji} {weapon.name}
          </span>
          <span className="lv">Lv {s.level}</span>
          <span className="turn">
            T{s.turn} · 사격 {s.shotsLeft} · 재장전 {s.reloadsLeft}
          </span>
          <button className="logbtn" onClick={() => setLogOpen(true)}>
            ▤
          </button>
        </div>
        <div className="hud-row">
          <span className="hplabel">❤️ {s.playerHp}</span>
          <div className="bar hp big">
            <span style={{ width: `${(s.playerHp / s.playerMaxHp) * 100}%` }} />
          </div>
          <div className="bar xp">
            <span style={{ width: `${(s.xp / xpForLevel(s.level)) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* 적 */}
      <div className="enemies">
        {s.enemies.map((e) => (
          <EnemyCard key={e.id} enemy={e} />
        ))}
      </div>

      {/* 중앙 스테이지: 주사위 + 예상 피해 */}
      <div className="stage">
        <div className="stage-left">
          <Dice />
          <div className="rollmeta">
            <div>
              장전 <b>{load}</b>발
            </div>
            <div>
              데미지 <b>×{dmgBonus}</b>
            </div>
            {s.crit && <div className="critword">크리티컬!</div>}
          </div>
        </div>
        <div className="stage-right">
          {preview ? (
            <>
              <div className="phand">{preview.hand.type.name}</div>
              <div className="pbig">{preview.total}</div>
              <div className="pels">
                {preview.shares.map((sh) => (
                  <ElementChip
                    key={sh.element}
                    el={sh.element}
                    label={`${Math.round(sh.fraction * 100)}%`}
                  />
                ))}
                {preview.singleSuitBonus > 1 && (
                  <span className="el-chip gold">단일 ×{preview.singleSuitBonus}</span>
                )}
              </div>
            </>
          ) : (
            <div className="phint">
              카드를 눌러 족보를 만드세요
              <div className="phint2">
                같은 숫자=페어 · 같은 무늬 5장=플러시 · 연속 5장=스트레이트
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 손패 */}
      <div className="hand" key={s.fxSeq /* 매 사격마다 새로 딜 애니메이션 */}>
        {s.hand.map((c, i) => (
          <PlayCard key={c.id} card={c} index={i} />
        ))}
      </div>

      {/* 액션바 (하단 고정) */}
      <div className="actionbar">
        <button
          className="btn ghost"
          disabled={!canAct || s.reloadsLeft <= 0}
          onClick={s.reload}
        >
          🎲 재장전<small>{s.reloadsLeft}</small>
        </button>
        <button
          className="btn fire big"
          disabled={!canAct || s.selected.length === 0}
          onClick={s.shoot}
        >
          🔫 발사{s.selected.length > 0 ? ` ${s.selected.length}` : ""}
        </button>
      </div>
      <div className="aim-hint">
        {weapon.fireMode === "all" ? "샷건: 모든 적 동시 타격" : "적을 눌러 조준"}
      </div>

      {/* 로그 드로어 */}
      {logOpen && (
        <div className="drawer-bg" onClick={() => setLogOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              전투 기록 <button onClick={() => setLogOpen(false)}>✕</button>
            </div>
            <div className="log">
              {s.log
                .slice()
                .reverse()
                .map((line, i) => (
                  <div key={s.log.length - i} className="line">
                    {line}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Result ---------------- */
function Result() {
  const phase = useGame((s) => s.phase);
  const restart = useGame((s) => s.restart);
  const level = useGame((s) => s.level);
  const turn = useGame((s) => s.turn);
  const win = phase === "won";
  return (
    <div className={`result ${win ? "win" : "lose"}`}>
      <h2>{win ? "VICTORY" : "YOU DIED"}</h2>
      <p>
        {win
          ? `무법자 무리를 정리했다. Lv.${level} · ${turn}턴`
          : `황무지에 쓰러졌다. ${turn}턴까지 버텼다.`}
      </p>
      <button className="btn fire big" onClick={restart}>
        다시 도전
      </button>
    </div>
  );
}
