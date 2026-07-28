import { keygraph } from './keygraph.js';
import {
    generatePhrase,
    type PhraseData,
    type PressureLevel,
    INSTRUCTION_LABEL,
    normalizeN,
    pressureLevel,
} from './phrases';
import type { Level } from './sentences';
import { playFormant } from './audio';
import { keyboard, wooting60heplus } from './keyboard';
import { createStage } from './stage';
import { flashRedScreen } from './rippleEffect';
import { createPressureMeter, type PressureMeter } from './pressureMeter';

const GAME_DURATION_SEC = 60;

// analog: アナログキーボード（打鍵圧あり・強弱判定あり）
// normal: 通常キーボード（打鍵圧なし・速度と正確性だけのベースライン）
export type GameMode = 'analog' | 'normal';

export interface GameResult {
    mode: GameMode;
    phrasesCompleted: number;
    pressureClears: number;
    totalTargets: number;      // 完了フレーズ内の指定アイコン総数
    pressures: number[];       // 全打鍵の打鍵圧(N値・アナログのみ)
    expressionScore: number;   // コンボ倍率込みの表現点
    maxCombo: number;          // セッション最大コンボ
}

// コンボ倍率: COMBO_STEP 連続クリアごとに MULT_BASE 倍（掛け算で伸びる・上限 MAX_MULT）
// 例: COMBO_STEP=3, MULT_BASE=2 → x1, x2, x4, x8, ...
const COMBO_STEP = 1;
const MULT_BASE = 2;
const MAX_MULT = 100000000;
function comboMultiplier(combo: number): number {
    const tier = Math.floor((combo - 1) / COMBO_STEP);
    return Math.min(MULT_BASE ** tier, MAX_MULT);
}

export interface GameScreenOptions {
    mode: GameMode;
    level: Level;
    setPressureListener: (cb: (code: string, value: number) => void) => void;
    clearPressureListener: () => void;
    setRawListener: (cb: (code: string, value: number) => void) => void;
    clearRawListener: () => void;
    onFinish: (result: GameResult) => void;
}

// -----------------------------------------------------------------------
// 横顔キャラクター描画
// 打鍵圧 強 → 300° (60° の口開き), 弱 → 350° (10° の口開き)
// -----------------------------------------------------------------------
function drawFace(canvas: HTMLCanvasElement, newtonValue: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 線形正規化: 0.6N〜3.0N → 0〜1
    const t = normalizeN(newtonValue);

    // 弧の角度: t=1(強) → 300°, t=0(弱) → 350°
    const arcDeg = 350 - t * 50;
    const gapDeg = 360 - arcDeg;
    const gapRad = (gapDeg / 2) * (Math.PI / 180);

    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.38;

    // 顔の輪郭弧（口部分が右側）
    ctx.beginPath();
    ctx.arc(cx, cy, r, gapRad, 2 * Math.PI - gapRad, false);
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 弧の端点から中心への線（口の上唇・下唇）
    const p1x = cx + r * Math.cos(gapRad);
    const p1y = cy + r * Math.sin(gapRad);
    const p2x = cx + r * Math.cos(-gapRad);
    const p2y = cy + r * Math.sin(-gapRad);

    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(p2x, p2y);
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 目（右上側）
    const eyeX = cx + r * 0.28;
    const eyeY = cy - r * 0.32;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, r * 0.07, 0, 2 * Math.PI);
    ctx.fillStyle = '#0891b2';
    ctx.fill();

    // 打鍵圧インジケータ（小さいテキスト）
    ctx.fillStyle = '#64748b88';
    ctx.font = `${W * 0.08}px Audiowide, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${newtonValue.toFixed(1)}N`, cx, H - 8);
}

// -----------------------------------------------------------------------
// メイン
// -----------------------------------------------------------------------
export function showGameScreen(
    app: HTMLDivElement,
    options: GameScreenOptions,
): void {
    const { mode, level, setPressureListener, clearPressureListener, setRawListener, clearRawListener, onFinish } = options;
    const isAnalog = mode === 'analog';

    // 設計サイズ固定のステージ。中身はここに載せ、ウィンドウに合わせて拡縮する
    // 割合を一定に保つため等倍スケール（fit）
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'grid',
        // アナログはヘッダー直下に打鍵圧スタックの帯を挟む
        gridTemplateRows: isAnalog ? 'auto auto 1fr 200px auto' : 'auto 1fr 200px auto',
    }, { fit: true, designW: 1060, designH: 1000 });

    // ── 状態 ──────────────────────────────────────────
    let queue: PhraseData[] = [];
    let phrasesCompleted = 0;
    let pressureClears = 0;
    let totalTargets = 0;              // 完了フレーズ内の指定アイコン総数
    let combo = 0;                     // 指定の連続クリア数
    let maxCombo = 0;
    let expressionScore = 0;           // コンボ倍率込みの表現点
    const sessionPressures: number[] = []; // 全打鍵の打鍵圧(N値)
    let timeLeft = GAME_DURATION_SEC;
    let lastPressureN = 0.6;
    let timerInterval = 0;

    // フレーズキューを初期化 (queue[0]=現在入力中のフレーズ)
    // 通常モードは強/弱アイコンを付けない
    queue.push(generatePhrase(isAnalog, level));
    keygraph.build(queue[0].text);

    // ── ヘッダー ──────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 2rem',
        borderBottom: '1px solid #e2e8f0',
        fontFamily: "'Audiowide', sans-serif",
    });

    const timerEl = document.createElement('div');
    timerEl.style.cssText = 'font-size: 1.8rem; color: #0891b2;';
    timerEl.textContent = `${Math.floor(GAME_DURATION_SEC / 60)}:${(GAME_DURATION_SEC % 60).toString().padStart(2, '0')}`;

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size: 1.4rem; color: #ca8a04;';
    scoreEl.textContent = '0 pt';

    // コンボバッジ（中央・コンボ2以上で表示）
    const comboBadge = document.createElement('div');
    comboBadge.style.cssText =
        'font-size: 1.4rem; color: #f59e0b; letter-spacing: 0.08em; opacity: 0;' +
        'transition: opacity 0.2s, transform 0.12s ease-out;';

    header.appendChild(timerEl);
    header.appendChild(comboBadge);
    header.appendChild(scoreEl);

    // ── 打鍵圧スタック（強/普通/弱を色で、左→右へ4行ずつ積む）──
    const LEVEL_COLOR: Record<PressureLevel, string> = {
        strong: '#ef4444', // 赤
        normal: '#22c55e', // 緑
        weak:   '#3b82f6', // 青
    };
    const STACK_ROWS = 4;
    const CELL_PX = 16;
    const CELL_GAP = 3;

    const stackEl = document.createElement('div');
    Object.assign(stackEl.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: `${CELL_GAP}px`,
        height: `${STACK_ROWS * CELL_PX + (STACK_ROWS - 1) * CELL_GAP + 16}px`,
        padding: '8px 2rem',
        borderBottom: '1px solid #e2e8f0',
        overflowX: 'hidden',
        overflowY: 'hidden',
    });

    let stackFilled = 0;              // これまでに置いた四角形の総数
    let stackColumn: HTMLDivElement | null = null; // 現在積んでいる列

    function addPressureSquare(pressure: number): void {
        const row = stackFilled % STACK_ROWS;
        if (row === 0) {
            // 新しい列を作る（上から下へ積む）
            stackColumn = document.createElement('div');
            Object.assign(stackColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: `${CELL_GAP}px`,
                flexShrink: '0',
            });
            stackEl.appendChild(stackColumn);
        }
        const cell = document.createElement('div');
        Object.assign(cell.style, {
            width: `${CELL_PX}px`,
            height: `${CELL_PX}px`,
            borderRadius: '3px',
            background: LEVEL_COLOR[pressureLevel(pressure)],
        });
        stackColumn!.appendChild(cell);
        stackFilled++;
        // 右端が埋まったら最新の列が見えるよう右へスクロール
        stackEl.scrollLeft = stackEl.scrollWidth;
    }

    // ── 中央スペーサー（旧・吹き出しエリア）────────────
    const spacerEl = document.createElement('div');

    // ── ボトムエリア (横顔 + タイピング表示) ───────────
    const bottomEl = document.createElement('div');
    Object.assign(bottomEl.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '0.8rem 2rem',
        borderTop: '1px solid #e2e8f0',
    });

    // 横顔キャンバス
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 180;
    faceCanvas.height = 180;
    faceCanvas.style.flexShrink = '0';
    drawFace(faceCanvas, lastPressureN);

    // エフェクト用 CSS
    const effectStyle = document.createElement('style');
    effectStyle.textContent = `
        @keyframes kw-ripple {
            0%   { transform: scale(0.2); opacity: 0.9; }
            100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes kw-char-pop {
            0%   { transform: translateY(0)   scale(1);   opacity: 1; }
            100% { transform: translateY(-60px) scale(1.6); opacity: 0; }
        }
    `;
    document.head.appendChild(effectStyle);

    // タイピング表示領域
    const typingEl = document.createElement('div');
    Object.assign(typingEl.style, {
        width: '500px',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        position: 'relative',
    });

    // エフェクトレイヤー（typingEl 上に重ねる）
    const effectLayer = document.createElement('div');
    Object.assign(effectLayer.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        overflow: 'visible',
    });
    typingEl.appendChild(effectLayer);

    const kanaRow = document.createElement('div');
    kanaRow.style.cssText = 'display:flex; align-items:flex-end; flex-wrap:wrap; font-family:system-ui,sans-serif;';

    const romRow = document.createElement('div');
    romRow.style.cssText = "font-size: 1.6rem; font-family: 'Audiowide', monospace; letter-spacing: 0.05em;";

    typingEl.appendChild(kanaRow);
    typingEl.appendChild(romRow);

    // 横顔は打鍵圧フィードバック用なのでアナログモードのみ表示
    if (isAnalog) bottomEl.appendChild(faceCanvas);
    bottomEl.appendChild(typingEl);

    // ── キーボードエリア ───────────────────────────────
    const keyboardWrapper = document.createElement('div');
    Object.assign(keyboardWrapper.style, {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#ffffff',
        padding: '30px 0',
    });

    const keyboardEl = document.createElement('div');
    keyboardEl.style.transformOrigin = 'center center';

    keyboardWrapper.appendChild(keyboardEl);
    const updateKey = keyboard(keyboardEl, wooting60heplus);

    stage.appendChild(header);
    if (isAnalog) stage.appendChild(stackEl);
    stage.appendChild(spacerEl);
    stage.appendChild(bottomEl);
    stage.appendChild(keyboardWrapper);

    // ── ヘルパー ──────────────────────────────────────
    function getScore() {
        return phrasesCompleted * 100 + expressionScore;
    }

    function refreshScore() {
        scoreEl.textContent = `${getScore()} pt`;
    }

    function updateComboBadge() {
        if (combo >= 2) {
            comboBadge.textContent = `${combo} COMBO ×${comboMultiplier(combo)}`;
            comboBadge.style.opacity = '1';
        } else {
            comboBadge.style.opacity = '0';
        }
    }

    function updateTypingDisplay() {
        const done = [...(keygraph.seq_done() ?? '')];
        const candidates = [...(keygraph.seq_candidates() ?? queue[0].text)];
        const romDone = keygraph.key_done();
        const romCandidate = keygraph.key_candidate();
        const phrase = queue[0];

        kanaRow.innerHTML = '';

        // 打鍵済み文字: アイコンなし、打鍵圧でサイズ変化
        done.forEach((ch, i) => {
            const n = phrase.charPressures[i] ?? 0.6;
            const t = normalizeN(n);
            const size = (2 + t * 3).toFixed(2) + 'rem';
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.cssText = `font-size:${size}; color:#64748b; font-family:system-ui,sans-serif; line-height:1; align-self:flex-end;`;
            kanaRow.appendChild(span);
        });

        // 未入力文字: ターゲット文字の上にアイコン表示
        candidates.forEach((ch, j) => {
            const originalIdx = done.length + j;
            const instruction = phrase.targets[originalIdx];

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const iconEl = document.createElement('span');
            const iconLabel = instruction ? INSTRUCTION_LABEL[instruction] : null;
            iconEl.textContent = iconLabel ? iconLabel.symbol : '\u00A0';
            iconEl.style.cssText = `font-size:1.2rem; color:${iconLabel ? iconLabel.color : 'transparent'}; font-weight:bold; line-height:1.2;`;

            const charEl = document.createElement('span');
            charEl.textContent = ch;
            charEl.style.cssText = 'font-size:3rem; color:#1e293b; font-family:system-ui,sans-serif; line-height:1;';

            wrapper.appendChild(iconEl);
            wrapper.appendChild(charEl);
            kanaRow.appendChild(wrapper);
        });

        romRow.innerHTML =
            `<span style="color:#94a3b8">${romDone}</span>` +
            `<span style="color:#0891b2">${romCandidate}</span>`;
    }

    function triggerEffect(ch: string, pressure: number) {
        const t = normalizeN(pressure);

        // 色: 弱(青) → 強(赤)
        const r = Math.round(59  + t * (239 - 59));
        const g = Math.round(130 - t * 130);
        const b = Math.round(246 - t * 246);
        const col = `rgb(${r},${g},${b})`;

        // リップル円
        const ripple = document.createElement('div');
        const size = 60 + t * 100;
        Object.assign(ripple.style, {
            position: 'absolute',
            left: '50%',
            bottom: '3rem',
            width: `${size}px`,
            height: `${size}px`,
            marginLeft: `-${size / 2}px`,
            borderRadius: '50%',
            border: `3px solid ${col}`,
            animation: `kw-ripple ${0.35 + t * 0.15}s ease-out forwards`,
            pointerEvents: 'none',
        });
        effectLayer.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());

        // 文字ポップ
        const pop = document.createElement('div');
        Object.assign(pop.style, {
            position: 'absolute',
            left: '50%',
            bottom: '3.5rem',
            transform: 'translateX(-50%)',
            fontSize: `${1.5 + t * 2}rem`,
            color: col,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 'bold',
            animation: `kw-char-pop ${0.4 + t * 0.2}s ease-out forwards`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
        });
        pop.textContent = ch;
        effectLayer.appendChild(pop);
        pop.addEventListener('animationend', () => pop.remove());
    }

    function flashMiss() {
        kanaRow.style.color = '#dc2626';
        setTimeout(() => { kanaRow.style.color = ''; }, 120);
        flashRedScreen(); // ミス時に画面全体を赤くフラッシュ
    }

    const clearSound = new Audio('/maou_se_system48.mp3');
    function playClearSound() {
        clearSound.currentTime = 0;
        clearSound.play().catch(() => {});
    }

    // 指定クリア時の加点ポップ（表現点＋コンボ倍率）
    function showComboGain(gained: number, mult: number) {
        comboBadge.style.transform = 'scale(1.25)';
        setTimeout(() => { comboBadge.style.transform = 'scale(1)'; }, 120);

        const pop = document.createElement('div');
        pop.textContent = mult > 1 ? `+${gained} ×${mult}` : `+${gained}`;
        Object.assign(pop.style, {
            position: 'absolute',
            left: '50%',
            bottom: '4rem',
            transform: 'translateX(-50%)',
            fontSize: '1.5rem',
            color: '#f59e0b',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 'bold',
            animation: 'kw-char-pop 0.7s ease-out forwards',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
        });
        effectLayer.appendChild(pop);
        pop.addEventListener('animationend', () => pop.remove());
    }

    // 指定文字1つを判定してコンボ・表現点を更新
    function judgeTarget(instruction: 'strong' | 'weak', pressure: number) {
        const level = pressureLevel(pressure);
        const cleared = (instruction === 'strong' && level !== 'weak')
                     || (instruction === 'weak' && level !== 'strong');
        if (cleared) {
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            const mult = comboMultiplier(combo);
            const gained = 50 * mult;
            expressionScore += gained;
            pressureClears++;
            playClearSound();
            showComboGain(gained, mult);
        } else {
            combo = 0;
        }
        updateComboBadge();
        refreshScore();
    }

    function completePhrase() {
        const phrase = queue[0];
        totalTargets += Object.keys(phrase.targets).length;
        phrasesCompleted++;
        refreshScore();

        queue.shift();
        queue.push(generatePhrase(isAnalog, level));
        keygraph.build(queue[0].text);

        updateTypingDisplay();
    }

    function updateTimer() {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (timeLeft <= 30) timerEl.style.color = '#dc2626';
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            cleanup();
            onFinish({ mode, phrasesCompleted, pressureClears, totalTargets, pressures: sessionPressures, expressionScore, maxCombo });
        }
    }

    // コンテキストメニュー抑制
    const contextMenuHandler = (e: MouseEvent | Event) => e.preventDefault();
    document.addEventListener('contextmenu', contextMenuHandler);

    // ── キー入力ハンドラ ──────────────────────────────
    const keydownHandler = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length !== 1) return;
        e.preventDefault();

        const key = e.key.toLowerCase();
        const charsBefore = [...(keygraph.seq_done() ?? '')].length;
        if (keygraph.next(key)) {
            const pressure = lastPressureN;
            const phrase = queue[0];

            if (isAnalog) {
                // 打鍵圧を強/普通/弱の四角形として左→右に積む
                addPressureSquare(pressure);
                sessionPressures.push(pressure);
            } else {
                // 通常モードはリップルで打鍵フィードバック＋keydownでキーボード点灯
                triggerEffect(key, pressure);
                const code = key.toUpperCase();
                updateKey(code, 1);
                setTimeout(() => updateKey(code, 0), 300);
            }

            // keygraph.next() 後に seq_done が増えていればひらがな1文字完了
            const charsAfter = [...(keygraph.seq_done() ?? '')].length;
            if (charsAfter > charsBefore) {
                phrase.charPressures[charsBefore] = pressure;
                // 指定文字ならリアルタイムに判定してコンボ更新（アナログのみ）
                const instruction = phrase.targets[charsBefore];
                if (isAnalog && instruction) {
                    judgeTarget(instruction, pressure);
                }
            }

            if (keygraph.is_finished()) {
                completePhrase(); // 内部で updateTypingDisplay を呼ぶ
            } else {
                updateTypingDisplay();
            }
        } else {
            flashMiss();
        }
    };
    document.addEventListener('keydown', keydownHandler);

    // ── 打鍵圧コールバック（アナログモードのみ）────────
    let pressureMeter: PressureMeter | null = null;
    if (isAnalog) {
        pressureMeter = createPressureMeter(); // 押下量の常時ライブメーター
        setPressureListener((_code: string, value: number) => {
            lastPressureN = value;
            drawFace(faceCanvas, value);
            updateKey(_code, value);
            setTimeout(() => {
                updateKey(_code, 0);
            }, 300);
            playFormant(value);
        });

        // ── アナログ生値（押下量 0〜1）→ ライブメーター ──────
        setRawListener((_code: string, value: number) => {
            pressureMeter?.update(value);
        });
    }

    // ── 後片付け ──────────────────────────────────────
    function cleanup() {
        document.removeEventListener('keydown', keydownHandler);
        document.removeEventListener('contextmenu', contextMenuHandler);
        pressureMeter?.dispose();
        disposeStage();
        clearPressureListener();
        clearRawListener();
    }

    // ── 初期描画 ──────────────────────────────────────
    updateTypingDisplay();
    timerInterval = setInterval(updateTimer, 1000);
}
