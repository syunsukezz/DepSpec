import { keygraph } from './keygraph.js';
import {
    generatePhrase,
    type PhraseData,
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
import { drawFace } from './faceDraw';
import { FONT_DISPLAY } from './theme';

const GAME_DURATION_SEC = 60;

// 基本点: フレーズ完了ではなく打鍵ごとに一致(正解)を積算する（未完のフレーズの努力も点数に反映されるように）
const KEY_POINTS = 10;

// 残り問題数ゲージの目安総数（時間切れが本来の終了条件のため、これに達しても継続する）
const TOTAL_PHRASES = 20;

// analog: アナログキーボード（打鍵圧あり・強弱判定あり）
// normal: 通常キーボード（打鍵圧なし・速度と正確性だけのベースライン）
export type GameMode = 'analog' | 'normal';

export interface GameResult {
    mode: GameMode;
    level: Level;
    phrasesCompleted: number;
    pressureClears: number;
    totalTargets: number;      // 完了フレーズ内の指定アイコン総数
    pressures: number[];       // 全打鍵の打鍵圧(N値・アナログのみ)
    baseScore: number;         // 打鍵ごとに積算した基本点
    expressionScore: number;   // コンボ倍率込みの表現点
    maxCombo: number;          // セッション最大コンボ
}

// コンボ倍率: COMBO_STEP 連続クリアごとに MULT_BASE 倍（掛け算で伸びる・上限 MAX_MULT）
// 例: COMBO_STEP=3, MULT_BASE=2 → x1, x2, x4, x8, ...
const COMBO_STEP = 1;
const MULT_BASE = 2;
const MAX_MULT = 100;
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
    // 行: ヘッダー / 進捗ゲージ / タイピング表示(可変) / キーボード(固定)
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr 200px',
    }, { fit: true, designW: 1060, designH: 1000 });

    // ── 状態 ──────────────────────────────────────────
    let queue: PhraseData[] = [];
    let phrasesCompleted = 0;
    let baseScore = 0;                 // 打鍵ごとに積算した基本点
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
    queue.push(generatePhrase(level));
    buildCurrentPhrase();

    // ── ヘッダー ──────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 2rem',
        borderBottom: '1px solid #e2e8f0',
        fontFamily: FONT_DISPLAY,
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

    // ── 進捗ゲージ (残り問題数の目安) ───────────────────
    const progressWrap = document.createElement('div');
    Object.assign(progressWrap.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.4rem 2rem',
        borderBottom: '1px solid #e2e8f0',
    });
    const progressLabel = document.createElement('div');
    progressLabel.style.cssText = `font-size:0.75rem; color:#94a3b8; font-family:${FONT_DISPLAY}; white-space:nowrap;`;
    const progressTrack = document.createElement('div');
    progressTrack.style.cssText = 'flex:1; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;';
    const progressFill = document.createElement('div');
    progressFill.style.cssText = 'height:100%; width:0%; background:#0891b2; border-radius:4px; transition:width 0.3s ease;';
    progressTrack.appendChild(progressFill);
    progressWrap.appendChild(progressLabel);
    progressWrap.appendChild(progressTrack);

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
    drawFace(faceCanvas, lastPressureN, { showLabel: true });

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

    // ひらがなは参照用の小さめ表示。ローマ字をメインの大きい表示にする。
    const kanaRow = document.createElement('div');
    kanaRow.style.cssText = 'display:flex; align-items:flex-end; flex-wrap:wrap; gap:0 0.1rem; font-family:system-ui,sans-serif;';

    const romRow = document.createElement('div');
    romRow.style.cssText = "display:flex; align-items:flex-end; flex-wrap:wrap; font-family:'Audiowide',monospace; letter-spacing:0.03em;";

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
    stage.appendChild(progressWrap);
    stage.appendChild(bottomEl);
    stage.appendChild(keyboardWrapper);

    // ── ヘルパー ──────────────────────────────────────
    function getScore() {
        return baseScore + expressionScore;
    }

    function refreshScore() {
        scoreEl.textContent = `${getScore()} pt`;
    }

    // 残り問題数ゲージの更新。TOTAL_PHRASES はあくまで目安で、超えても時間切れまで続行する
    function updateProgress() {
        const remaining = Math.max(0, TOTAL_PHRASES - phrasesCompleted);
        const ratio = Math.min(1, phrasesCompleted / TOTAL_PHRASES);
        progressFill.style.width = `${ratio * 100}%`;
        progressLabel.textContent = `のこり ${remaining} 問`;
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
        const romCandidate = [...keygraph.key_candidate()];
        const phrase = queue[0];

        // ── ひらがな: 参照用の小さめ表示（マークなし）──
        kanaRow.innerHTML = '';
        done.forEach((ch, i) => {
            // 打鍵済みは打鍵圧でわずかにサイズ変化
            const n = phrase.charPressures[i] ?? 0.6;
            const t = normalizeN(n);
            const size = (1.1 + t * 0.7).toFixed(2) + 'rem';
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.cssText = `font-size:${size}; color:#94a3b8; font-family:system-ui,sans-serif; line-height:1; align-self:flex-end;`;
            kanaRow.appendChild(span);
        });
        candidates.forEach((ch) => {
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.cssText = 'font-size:1.4rem; color:#64748b; font-family:system-ui,sans-serif; line-height:1; align-self:flex-end;';
            kanaRow.appendChild(span);
        });

        // ── ローマ字: メインの大きい表示（ターゲットのローマ字にマーク）──
        romRow.innerHTML = '';

        // 打鍵済みローマ字: グレーでフラット表示（マークなし）
        if (romDone) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
            const spacer = document.createElement('span');
            spacer.innerHTML = '&nbsp;';
            spacer.style.cssText = 'font-size:1.4rem; line-height:1.2;';
            const keysEl = document.createElement('span');
            keysEl.textContent = romDone;
            keysEl.style.cssText = 'font-size:2.6rem; color:#94a3b8; line-height:1;';
            wrapper.appendChild(spacer);
            wrapper.appendChild(keysEl);
            romRow.appendChild(wrapper);
        }

        // 未入力ローマ字: 1キー(ローマ字1文字)ごとに列を作り、指定があればマークを付ける
        const doneLen = romDone.length;
        romCandidate.forEach((ch, i) => {
            const keyIndex = doneLen + i; // この文字が何打鍵目か
            const instruction = phrase.targets[keyIndex];

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const iconEl = document.createElement('span');
            const iconLabel = instruction ? INSTRUCTION_LABEL[instruction] : null;
            if (iconLabel) {
                iconEl.textContent = iconLabel.symbol;
                iconEl.style.cssText = `font-size:1.4rem; color:${iconLabel.color}; font-weight:bold; line-height:1.2;`;
            } else {
                iconEl.innerHTML = '&nbsp;';
                iconEl.style.cssText = 'font-size:1.4rem; line-height:1.2;';
            }

            const isCurrent = i === 0; // 今まさに打つ文字
            const keysEl = document.createElement('span');
            keysEl.textContent = ch;
            keysEl.style.cssText = isCurrent
                ? 'font-size:4rem; color:#0e7490; font-weight:bold; line-height:1; text-shadow:0 2px 8px rgba(8,145,178,0.35);'
                : 'font-size:2.6rem; color:#0891b2; line-height:1;';

            wrapper.appendChild(iconEl);
            wrapper.appendChild(keysEl);
            romRow.appendChild(wrapper);
        });
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

    // フレーズを keygraph に構築する。打鍵圧指定(phrase.targets)は sentences.ts に
    // 事前計算済みのものが generatePhrase 経由で既に入っている。通常モードはマーク非表示にする。
    function buildCurrentPhrase() {
        const phrase = queue[0];
        keygraph.build(phrase.text);
        if (!isAnalog) phrase.targets = {};
    }

    function completePhrase() {
        const phrase = queue[0];
        totalTargets += Object.keys(phrase.targets).length;
        phrasesCompleted++;
        refreshScore();
        updateProgress();

        queue.shift();
        queue.push(generatePhrase(level));
        buildCurrentPhrase();

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
            onFinish({ mode, level, phrasesCompleted, pressureClears, totalTargets, pressures: sessionPressures, baseScore, expressionScore, maxCombo });
        }
    }

    // コンテキストメニュー抑制
    const contextMenuHandler = (e: MouseEvent | Event) => e.preventDefault();
    document.addEventListener('contextmenu', contextMenuHandler);

    // ── 入力処理（1打鍵ぶんの判定・フィードバック・表示更新）──
    // key: 小文字1文字, pressure: その打鍵の検圧値
    function processInput(key: string, pressure: number) {
        const charsBefore = [...(keygraph.seq_done() ?? '')].length;
        const keyIndex = keygraph.key_done().length; // このキーが何打鍵目か（0始まり）
        if (keygraph.next(key)) {
            const phrase = queue[0];

            // 打鍵ごとに一致(正解)を積算する基本点。未完のフレーズでもここまでの
            // 打鍵は無駄にならない（タイマー切れで途中終了しても得点に反映される）
            baseScore += KEY_POINTS;
            refreshScore();

            if (isAnalog) {
                // 打鍵圧を強/普通/弱の四角形として左→右に積む
                sessionPressures.push(pressure);
            } else {
                // 通常モードはリップルで打鍵フィードバック＋keydownでキーボード点灯
                triggerEffect(key, pressure);
                const code = key.toUpperCase();
                updateKey(code, 1);
                setTimeout(() => updateKey(code, 0), 300);
            }

            // ローマ字(キー)1打ごとに判定。指定があればリアルタイムでコンボ更新（アナログのみ）
            const instruction = phrase.targets[keyIndex];
            if (isAnalog && instruction) {
                judgeTarget(instruction, pressure);
            }

            // seq_done が増えていればひらがな1文字完了 → かな表示のサイズ用に打鍵圧を記録
            const charsAfter = [...(keygraph.seq_done() ?? '')].length;
            if (charsAfter > charsBefore) {
                phrase.charPressures[charsBefore] = pressure;
            }

            if (keygraph.is_finished()) {
                completePhrase(); // 内部で updateTypingDisplay を呼ぶ
            } else {
                updateTypingDisplay();
            }
        } else {
            flashMiss();
        }
    }

    // ── キー入力ハンドラ（通常モード用）──────────────────
    // アナログモードは keydown を使わず、底打ち検出(検圧コールバック)で入力する。
    // → 半押し(作動点)では入力せず、入力と検圧を同じ底打ちイベントで確定できる。
    const keydownHandler = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length !== 1) return;
        e.preventDefault();
        if (isAnalog) return; // アナログは pressureListener 側で入力を確定する
        processInput(e.key.toLowerCase(), lastPressureN);
    };
    document.addEventListener('keydown', keydownHandler);

    // ── 打鍵圧コールバック（アナログモードのみ）────────
    let pressureMeter: PressureMeter | null = null;
    if (isAnalog) {
        pressureMeter = createPressureMeter(); // 押下量の常時ライブメーター
        setPressureListener((code: string, value: number) => {
            lastPressureN = value;
            drawFace(faceCanvas, value, { showLabel: true });
            updateKey(code, value);
            setTimeout(() => {
                updateKey(code, 0);
            }, 300);
            playFormant(value);
            // このコールバック＝底打ち検出。入力と検圧をここで同時に確定する。
            // code は "A" "Q" のような大文字1文字。keygraph は小文字1文字を期待。
            const key = code.toLowerCase();
            if (key.length === 1) processInput(key, value);
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
    updateProgress();
    timerInterval = setInterval(updateTimer, 1000);
}
