import { useGame, WEAPONS } from "../state/gameStore";
import type { Card } from "../engine/cards";
import { rankLabel, SUIT_SYMBOL, SUIT_ELEMENT, ELEMENT_INFO } from "../engine/cards";
import type { Element } from "../engine/cards";
import type { EnemyInstance } from "../engine/enemies";
import { xpForLevel } from "../engine/progression";

export function App() {
  const phase = useGame((s) => s.phase);
  return (
    <div className="app">
      <div className="title">
        pokerStS
        <small>SLAY THE SPIRE × POKER × DICE — SF COWBOY PROTOTYPE</small>
      </div>
      {phase === "intro" && <Intro />}
      {(phase === "player" || phase === "enemy") && <Combat />}
      {(phase === "won" || phase === "lost") && <Result />}
    </div>
  );
}

function Intro() {
  const chooseWeapon = useGame((s) => s.chooseWeapon);
  return (
    <div>
      <p className="hint">
        무기를 골라 전투를 시작하세요. 주사위(1D6)로 장전하고, 포커 족보로 데미지를,
        카드 무늬로 속성을 정합니다. 낮은 눈은 <b>선공</b>, 높은 눈은{" "}
        <b>데미지 보너스</b>. 재장전에서 같은 눈이 나오면 <b>크리티컬</b>.
      </p>
      <div className="weapon-grid">
        {WEAPONS.map((w) => (
          <div
            key={w.key}
            className="panel weapon-card"
            onClick={() => chooseWeapon(w)}
          >
            <div className="emoji">{w.emoji}</div>
            <h3>{w.name}</h3>
            <p>{w.blurb}</p>
            <div className="spec">
              탄창 {w.magazineCap} · {w.fireMode === "all" ? "전체 대상" : "단일 대상"} ·
              단일무늬 ×{w.singleSuitMult}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementChip({ el, label }: { el: Element; label?: string }) {
  const info = ELEMENT_INFO[el];
  return (
    <span className={`el-chip ${el}`}>
      {info.symbol} {label ?? info.name}
    </span>
  );
}

function reactionTags(enemy: EnemyInstance) {
  const tags: { el: Element; kind: "weak" | "resist" | "immune"; v: number }[] = [];
  (Object.keys(enemy.reactions) as Element[]).forEach((el) => {
    const v = enemy.reactions[el]!;
    if (v > 1) tags.push({ el, kind: "weak", v });
    else if (v === 0) tags.push({ el, kind: "immune", v });
    else if (v < 1) tags.push({ el, kind: "resist", v });
  });
  return tags;
}

function EnemyCard({ enemy }: { enemy: EnemyInstance }) {
  const targetId = useGame((s) => s.targetId);
  const setTarget = useGame((s) => s.setTarget);
  const weapon = useGame((s) => s.weapon);
  const dead = enemy.hp <= 0;
  const isTarget = targetId === enemy.id && weapon?.fireMode !== "all";
  const st = enemy.statuses;
  return (
    <div
      className={`panel enemy ${isTarget ? "target" : ""} ${dead ? "dead" : ""}`}
      onClick={() => !dead && setTarget(enemy.id)}
    >
      <div className="emoji">{enemy.emoji}</div>
      <h4>{enemy.name}</h4>
      <div className="bar hp" style={{ minWidth: 0 }}>
        <span style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
      </div>
      <div style={{ fontSize: 12, marginTop: 2 }}>
        HP {enemy.hp}/{enemy.maxHp} · ⚔️{enemy.attack} · 🏃speed {enemy.speed}
      </div>
      <div className="blurb">{enemy.blurb}</div>
      <div className="react">
        {reactionTags(enemy).map((t) => (
          <span key={t.el} className={`tag ${t.kind}`}>
            {ELEMENT_INFO[t.el].symbol}
            {t.kind === "weak" ? " 약점" : t.kind === "immune" ? " 면역" : " 저항"}
          </span>
        ))}
      </div>
      <div className="statuses">
        {st.burn > 0 && <ElementChip el="fire" label={`화상 ${st.burn}`} />}
        {st.chill > 0 && <ElementChip el="ice" label={`빙결 ${st.chill}`} />}
        {st.shock > 0 && <ElementChip el="lightning" label={`감전 ${st.shock}`} />}
        {st.poison > 0 && <ElementChip el="poison" label={`독 ${st.poison}`} />}
      </div>
    </div>
  );
}

function PlayCard({ card }: { card: Card }) {
  const selected = useGame((s) => s.selected);
  const toggle = useGame((s) => s.toggleSelect);
  const el = SUIT_ELEMENT[card.suit];
  const sel = selected.includes(card.id);
  return (
    <div
      className={`pcard ${el} ${sel ? "sel" : ""}`}
      onClick={() => toggle(card.id)}
    >
      <div className="rank">{rankLabel(card.rank)}</div>
      <div className="el">{ELEMENT_INFO[el].symbol}</div>
      <div className={`suit ${card.suit}`}>{SUIT_SYMBOL[card.suit]}</div>
    </div>
  );
}

function Combat() {
  const s = useGame();
  const preview = useGame((st) => st.preview)();
  const weapon = s.weapon!;
  const canAct = s.phase === "player";

  return (
    <div>
      <div className="hud">
        <div className="stat">
          <b>{weapon.emoji} {weapon.name}</b>
        </div>
        <div className="stat">
          HP <b>{s.playerHp}</b>/{s.playerMaxHp}
        </div>
        <div className="bar hp">
          <span style={{ width: `${(s.playerHp / s.playerMaxHp) * 100}%` }} />
        </div>
        <div className="stat">
          Lv <b>{s.level}</b>
        </div>
        <div className="bar xp">
          <span style={{ width: `${(s.xp / xpForLevel(s.level)) * 100}%` }} />
        </div>
        <div className="stat">
          턴 <b>{s.turn}</b> · 사격 <b>{s.shotsLeft}</b> · 재장전{" "}
          <b>{s.reloadsLeft}</b>
        </div>
      </div>

      <div className="combat">
        <div>
          <div className="enemies">
            {s.enemies.map((e) => (
              <EnemyCard key={e.id} enemy={e} />
            ))}
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="rollbar">
              <div className={`die ${s.crit ? "crit" : ""}`}>{s.currentRoll ?? "-"}</div>
              <div className="rollinfo">
                눈 <b>{s.currentRoll}</b> → 장전 {Math.min(s.currentRoll ?? 0, weapon.magazineCap)}발 ·
                데미지 ×{(1 + ((s.currentRoll ?? 1) - 1) * 0.1).toFixed(1)} ·{" "}
                {(s.currentRoll ?? 6) <= 6 ? "선공 판정: speed ≥ 눈인 적 무력화" : ""}
                {s.crit && (
                  <span style={{ color: "var(--gold)" }}> · 크리티컬 장전!</span>
                )}
              </div>
            </div>

            <div className="preview">
              {preview ? (
                <>
                  <div>
                    <span className="handname">{preview.hand.type.name}</span>{" "}
                    예상 피해
                  </div>
                  <div className="big">{preview.total}</div>
                  <div style={{ marginTop: 4 }}>
                    {preview.shares.map((sh) => (
                      <ElementChip
                        key={sh.element}
                        el={sh.element}
                        label={`${ELEMENT_INFO[sh.element].name} ${Math.round(
                          sh.fraction * 100
                        )}%`}
                      />
                    ))}
                    {preview.singleSuitBonus > 1 && (
                      <span className="el-chip" style={{ color: "var(--gold)" }}>
                        단일무늬 ×{preview.singleSuitBonus}
                      </span>
                    )}
                  </div>
                  <div className="formula">
                    ({preview.baseChips}칩) × {preview.handMult}배 × 속성{" "}
                    {preview.elementMult.toFixed(2)} × 주사위{" "}
                    {preview.damageBonus.toFixed(1)}
                    {preview.critMult > 1 && ` × 크리 ${preview.critMult}`}
                  </div>
                </>
              ) : (
                <div className="hint">
                  손패에서 카드를 골라 족보를 만드세요. (같은 숫자=페어/트리플, 같은
                  무늬 5장=플러시, 연속 5장=스트레이트)
                </div>
              )}
            </div>

            <div className="hand">
              {s.hand.map((c) => (
                <PlayCard key={c.id} card={c} />
              ))}
            </div>

            <div className="actions">
              <button
                className="btn fire"
                disabled={!canAct || s.selected.length === 0}
                onClick={s.shoot}
              >
                🔫 발사 {s.selected.length > 0 ? `(${s.selected.length}장)` : ""}
              </button>
              <button
                className="btn ghost"
                disabled={!canAct || s.reloadsLeft <= 0}
                onClick={s.reload}
              >
                🎲 재장전 ({s.reloadsLeft})
              </button>
              <span className="hint" style={{ alignSelf: "center" }}>
                {weapon.fireMode === "all"
                  ? "샷건: 모든 적을 동시에 타격"
                  : "적을 클릭해 조준"}
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--sand)" }}>
            전투 기록
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
    </div>
  );
}

function Result() {
  const phase = useGame((s) => s.phase);
  const restart = useGame((s) => s.restart);
  const level = useGame((s) => s.level);
  const turn = useGame((s) => s.turn);
  const win = phase === "won";
  return (
    <div className={`panel result ${win ? "win" : "lose"}`}>
      <h2>{win ? "VICTORY" : "YOU DIED"}</h2>
      <p>
        {win
          ? `무법자 무리를 정리했다. 도달 레벨 Lv.${level} · ${turn}턴 소요.`
          : `황무지에 쓰러졌다. ${turn}턴까지 버텼다.`}
      </p>
      <button className="btn fire" onClick={restart}>
        다시 도전
      </button>
    </div>
  );
}
