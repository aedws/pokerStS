import { useEffect, useRef, useState } from "react";
import { useGame, WEAPONS } from "../state/gameStore";
import type { HitFx } from "../state/gameStore";
import type { Card } from "../engine/cards";
import { rankLabel, SUIT_SYMBOL, SUIT_ELEMENT, ELEMENT_INFO } from "../engine/cards";
import type { Element } from "../engine/cards";
import type { EnemyInstance } from "../engine/enemies";
import { xpForLevel } from "../engine/progression";
import { NODE_INFO } from "../engine/map";
import type { MapNode } from "../engine/map";
import { relicByKey } from "../engine/relics";

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="app">
      {screen === "intro" && <Intro />}
      {screen === "map" && <MapScreen />}
      {screen === "combat" && <Combat />}
      {screen === "reward" && <Reward />}
      {screen === "cull" && <Cull />}
      {screen === "relicReward" && <RelicReward />}
      {screen === "rest" && <Rest />}
      {(screen === "won" || screen === "lost") && <Result />}
    </div>
  );
}

/* ---------- 공용 ---------- */
function ElementChip({ el, label }: { el: Element; label?: string }) {
  const info = ELEMENT_INFO[el];
  return (
    <span className={`el-chip ${el}`}>
      {info.symbol} {label ?? info.name}
    </span>
  );
}

function RelicBar() {
  const relics = useGame((s) => s.relics);
  if (relics.length === 0) return null;
  return (
    <div className="relicbar">
      {relics.map((k) => {
        const r = relicByKey(k);
        if (!r) return null;
        return (
          <span key={k} className="relic-chip" title={`${r.name}: ${r.desc}`}>
            {r.emoji}
          </span>
        );
      })}
    </div>
  );
}

function RunHud() {
  const hp = useGame((s) => s.hp);
  const maxHp = useGame((s) => s.maxHp);
  const level = useGame((s) => s.level);
  const xp = useGame((s) => s.xp);
  const deckN = useGame((s) => s.masterDeck.length);
  const weapon = useGame((s) => s.weapon);
  return (
    <div className="hud">
      <div className="hud-row">
        <span className="wpn">
          {weapon?.emoji} {weapon?.name}
        </span>
        <span className="lv">Lv {level}</span>
        <span className="turn">🃏 덱 {deckN}장</span>
      </div>
      <div className="hud-row">
        <span className="hplabel">❤️ {hp}/{maxHp}</span>
        <div className="bar hp big">
          <span style={{ width: `${(hp / maxHp) * 100}%` }} />
        </div>
        <div className="bar xp">
          <span style={{ width: `${(xp / xpForLevel(level)) * 100}%` }} />
        </div>
      </div>
      <RelicBar />
    </div>
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

/* ---------- Intro ---------- */
function Intro() {
  const chooseWeapon = useGame((s) => s.chooseWeapon);
  return (
    <div className="intro">
      <div className="title">
        pokerStS
        <small>포커 × 주사위 × SF 카우보이</small>
      </div>
      <p className="hint">
        무기를 골라 탑을 오르세요. <b>주사위</b>로 장전, <b>포커 족보</b>로 데미지,{" "}
        <b>카드 무늬</b>로 속성. 전투 승리 시 <b>카드 획득</b>, 휴식에서{" "}
        <b>카드 제거</b>로 덱을 특화합니다.
      </p>
      <div className="weapon-grid">
        {WEAPONS.map((w) => (
          <button key={w.key} className="panel weapon-card" onClick={() => chooseWeapon(w)}>
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

/* ---------- Map ---------- */
function MapScreen() {
  const map = useGame((s) => s.map);
  const available = useGame((s) => s.available);
  const enterNode = useGame((s) => s.enterNode);
  if (!map) return null;
  const rowsTopDown = map.rows.slice().reverse();
  return (
    <div className="screen">
      <RunHud />
      <h2 className="screen-title">🗺️ 어디로 갈까</h2>
      <div className="map">
        {rowsTopDown.map((rowIds, ri) => (
          <div className="map-row" key={ri}>
            {rowIds.map((id) => {
              const node: MapNode = map.nodes[id];
              const info = NODE_INFO[node.type];
              const canGo = available.includes(id);
              return (
                <button
                  key={id}
                  className={`mapnode ${node.type} ${canGo ? "go" : ""}`}
                  disabled={!canGo}
                  onClick={() => enterNode(id)}
                >
                  <span className="ni-emoji">{info.emoji}</span>
                  <span className="ni-name">{info.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="hint">밝게 표시된 노드로 진입할 수 있습니다. 꼭대기 👑보스를 처치하면 클리어.</p>
    </div>
  );
}

/* ---------- Reward (카드 추가) ---------- */
function RewardCard({ card }: { card: Card }) {
  const pick = useGame((s) => s.pickReward);
  const el = SUIT_ELEMENT[card.suit];
  return (
    <button className={`pcard big ${el}`} onClick={() => pick(card.id)}>
      <div className="rank">{rankLabel(card.rank)}</div>
      <div className="cel">{ELEMENT_INFO[el].symbol}</div>
      <div className={`suit ${card.suit}`}>{SUIT_SYMBOL[card.suit]}</div>
    </button>
  );
}
function Reward() {
  const cards = useGame((s) => s.rewardCards);
  const skip = useGame((s) => s.skipReward);
  return (
    <div className="screen">
      <RunHud />
      <h2 className="screen-title">🃏 카드 획득</h2>
      <p className="hint">덱에 넣을 카드를 하나 고르세요. 무늬(속성)와 숫자를 보고 빌드에 맞게.</p>
      <div className="reward-row">
        {cards.map((c) => (
          <div key={c.id} className="reward-slot">
            <RewardCard card={c} />
            <div className="reward-el">
              <ElementChip el={SUIT_ELEMENT[c.suit]} />
            </div>
          </div>
        ))}
      </div>
      <button className="btn ghost wide" onClick={skip}>
        건너뛰기
      </button>
    </div>
  );
}

/* ---------- Cull (52장 초과 → 교체) ---------- */
function DeckGrid({ onPick }: { onPick: (id: string) => void }) {
  const deck = useGame((s) => s.masterDeck);
  const sorted = deck
    .slice()
    .sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank);
  return (
    <div className="deck-grid">
      {sorted.map((c) => {
        const el = SUIT_ELEMENT[c.suit];
        return (
          <button key={c.id} className={`minicard ${el}`} onClick={() => onPick(c.id)}>
            {rankLabel(c.rank)}
            <span className={`suit ${c.suit}`}>{SUIT_SYMBOL[c.suit]}</span>
          </button>
        );
      })}
    </div>
  );
}
function Cull() {
  const cull = useGame((s) => s.cullCard);
  const deckN = useGame((s) => s.masterDeck.length);
  return (
    <div className="screen">
      <RunHud />
      <h2 className="screen-title">🔁 카드 교체</h2>
      <p className="hint">
        덱이 52장을 넘었습니다 ({deckN}장). 뺄 카드를 골라 덱을 특화하세요. (넣은 만큼 빼서 52장 유지)
      </p>
      <DeckGrid onPick={cull} />
    </div>
  );
}

/* ---------- Relic Reward (엘리트 보상) ---------- */
function RelicReward() {
  const choices = useGame((s) => s.relicChoices);
  const pick = useGame((s) => s.pickRelic);
  return (
    <div className="screen">
      <RunHud />
      <h2 className="screen-title">🏺 유물 획득</h2>
      <p className="hint">
        빌드를 강화할 유물을 하나 고르세요. 덱을 특정 무늬·족보로 특화할수록 폭발합니다.
      </p>
      <div className="relic-choices">
        {choices.map((r) => (
          <button key={r.key} className="panel relic-card" onClick={() => pick(r.key)}>
            <div className="relic-emoji">{r.emoji}</div>
            <div className="relic-name">{r.name}</div>
            <div className="relic-desc">{r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Rest (회복 / 카드 제거) ---------- */
function Rest() {
  const heal = useGame((s) => s.restHeal);
  const remove = useGame((s) => s.removeCard);
  const deck = useGame((s) => s.masterDeck);
  const maxHp = useGame((s) => s.maxHp);
  const [removing, setRemoving] = useState(false);

  const sorted = deck
    .slice()
    .sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank);

  return (
    <div className="screen">
      <RunHud />
      <h2 className="screen-title">🔥 휴식</h2>
      {!removing ? (
        <>
          <p className="hint">회복하거나, 카드를 제거해 덱을 특화하세요.</p>
          <div className="rest-actions">
            <button className="btn fire wide" onClick={heal}>
              ❤️ 회복 (+{Math.round(maxHp * 0.3)})
            </button>
            <button className="btn ghost wide" onClick={() => setRemoving(true)}>
              🗑️ 카드 제거
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">덱에서 뺄 카드를 고르세요 (특화). 덱 {deck.length}장.</p>
          <div className="deck-grid">
            {sorted.map((c) => {
              const el = SUIT_ELEMENT[c.suit];
              return (
                <button
                  key={c.id}
                  className={`minicard ${el}`}
                  onClick={() => remove(c.id)}
                >
                  {rankLabel(c.rank)}
                  <span className={`suit ${c.suit}`}>{SUIT_SYMBOL[c.suit]}</span>
                </button>
              );
            })}
          </div>
          <button className="btn ghost wide" onClick={() => setRemoving(false)}>
            뒤로
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- Combat ---------- */
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
    const t = setTimeout(() => setFloaters((p) => p.filter((f) => !ids.has(f.id))), 1000);
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
        HP {enemy.hp}/{enemy.maxHp} · ⚔️{enemy.attack}
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

function Combat() {
  const s = useGame();
  const preview = useGame((st) => st.preview)();
  const weapon = s.weapon!;
  const canAct = s.combatTurn === "player";
  const [logOpen, setLogOpen] = useState(false);

  const hudRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (s.playerHitSeq > 0) hudRef.current?.animate(shakeKeyframes, { duration: 400 });
  }, [s.playerHitSeq]);

  const load = Math.min(s.currentRoll ?? 0, weapon.magazineCap);
  const dmgBonus = (1 + ((s.currentRoll ?? 1) - 1) * 0.1).toFixed(1);
  const hasInit = (s.currentRoll ?? 6) <= 3;

  return (
    <div className="combat">
      {s.flash && <div key={s.fxSeq} className={`flash ${s.flash}`} />}

      <div className="hud" ref={hudRef}>
        <div className="hud-row">
          <span className="wpn">{weapon.emoji} {weapon.name}</span>
          <span className="lv">Lv {s.level}</span>
          <span className="turn">T{s.turn} · 사격 {s.shotsLeft} · 재장전 {s.reloadsLeft}</span>
          <button className="logbtn" onClick={() => setLogOpen(true)}>▤</button>
        </div>
        <div className="hud-row">
          <span className="hplabel">❤️ {s.hp}</span>
          <div className="bar hp big">
            <span style={{ width: `${(s.hp / s.maxHp) * 100}%` }} />
          </div>
          <div className="bar xp">
            <span style={{ width: `${(s.xp / xpForLevel(s.level)) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="enemies">
        {s.enemies.map((e) => (
          <EnemyCard key={e.id} enemy={e} />
        ))}
      </div>

      <div className="stage">
        <div className="stage-left">
          <Dice />
          <div className="rollmeta">
            <div>장전 <b>{load}</b>발 · 데미지 <b>×{dmgBonus}</b></div>
            <div className={hasInit ? "initword" : "noinit"}>
              {hasInit ? "⚡ 선공 (반격 무효)" : "후공 (반격 받음)"}
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
                {preview.relicNotes.map((n, i) => (
                  <span key={i} className="el-chip relic">
                    {n.emoji}×{n.mult}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="phint">
              카드를 눌러 족보를 만드세요
              <div className="phint2">같은 숫자=페어 · 같은 무늬 5장=플러시 · 연속 5장=스트레이트</div>
            </div>
          )}
        </div>
      </div>

      <div className="hand" key={s.fxSeq}>
        {s.hand.map((c, i) => (
          <PlayCard key={c.id} card={c} index={i} />
        ))}
      </div>

      <div className="actionbar">
        <button className="btn ghost" disabled={!canAct || s.reloadsLeft <= 0} onClick={s.reload}>
          🎲 재장전<small>{s.reloadsLeft}</small>
        </button>
        <button className="btn fire big" disabled={!canAct || s.selected.length === 0} onClick={s.shoot}>
          🔫 발사{s.selected.length > 0 ? ` ${s.selected.length}` : ""}
        </button>
      </div>
      <div className="aim-hint">
        {weapon.fireMode === "all" ? "샷건: 모든 적 동시 타격" : "적을 눌러 조준"}
      </div>

      {logOpen && (
        <div className="drawer-bg" onClick={() => setLogOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              전투 기록 <button onClick={() => setLogOpen(false)}>✕</button>
            </div>
            <div className="log">
              {s.log.slice().reverse().map((line, i) => (
                <div key={s.log.length - i} className="line">{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Result ---------- */
function Result() {
  const screen = useGame((s) => s.screen);
  const restart = useGame((s) => s.restart);
  const level = useGame((s) => s.level);
  const win = screen === "won";
  return (
    <div className={`result ${win ? "win" : "lose"}`}>
      <h2>{win ? "TOWER CLEARED" : "YOU DIED"}</h2>
      <p>
        {win
          ? `탑 꼭대기의 드렛전 킹을 쓰러뜨렸다. 최종 Lv.${level}`
          : `황무지에 쓰러졌다. 최종 Lv.${level}`}
      </p>
      <button className="btn fire big" onClick={restart}>
        다시 도전
      </button>
    </div>
  );
}
