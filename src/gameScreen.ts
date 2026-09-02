import { keygraph } from './keygraph.js';
import {
    generatePhrase,
    INSTRUCTION_LABEL,
    resetPhraseSequence,
    type PhraseData,
    type PressureInstruction,
    type PressureLevel,
    normalizeN,
    pressureLevel,
} from './phrases';
import type { Level } from './sentences';
import { playFormant } from './audio';
import { createStage } from './stage';
import { flashRedScreen } from './rippleEffect';
import { createPressureMeter, type PressureMeter } from './pressureMeter';
import { createPressureGraph, type PressureGraph } from './pressureGraph';
import { shakeScreen } from './screenShake';
import { drawFace } from './faceDraw';
import { FONT_DISPLAY, FONT_LEVEL, PRESS_LEVEL_COLOR } from './theme';
import type { NameChar } from './playerName';

const GAME_DURATION_SEC = 60;

// 基本点: フレーズ完了ではなく打鍵ごとに一致(正解)を積算する（未完のフレーズの努力も点数に反映されるように）
const KEY_POINTS = 10;

// ローマ字表示の文字サイズ（通常/現在打つ文字）
const ROMAJI_SIZE = '1.8rem';
const ROMAJI_CURRENT_SIZE = '2.8rem';

// 指定文字のマーク表示: 強く(strong)には▲、弱く(weak)には▼を、打鍵前から常に表示する
// (INSTRUCTION_LABEL を使う)。普通(normal)は無印(マーク非表示)のまま。
// 打鍵済み・未入力にかかわらず、対象文字には同じマークを出し続ける。

// analog: アナログキーボード（打鍵圧あり・強弱判定あり）
// normal: 通常キーボード（打鍵圧なし・速度と正確性だけのベースライン）
export type GameMode = 'analog' | 'normal';

export interface GameResult {
    mode: GameMode;
    level: Level;
    name: NameChar[];
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
function comboTier(combo: number): number {
    return Math.floor((combo - 1) / COMBO_STEP);
}
function comboMultiplier(combo: number): number {
    return Math.min(MULT_BASE ** comboTier(combo), MAX_MULT);
}

// コンボが伸びるほどクリアSEのピッチを上げる（倍率が上がるほど手応えが分かりやすいように）
const SE_PITCH_BASE = 1.0;
const SE_PITCH_STEP = 0.05;
const SE_PITCH_MAX = 2.0;

// 倍率が最大の状態でさらにコンボを継続すると、1コンボごとにボーナスタイムが伸びる
const MAX_COMBO_BONUS_SEC = 0.5;

export interface GameScreenOptions {
    mode: GameMode;
    level: Level;
    name: NameChar[];
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
    const { mode, level, name, setPressureListener, clearPressureListener, setRawListener, clearRawListener, onFinish } = options;
    const isAnalog = mode === 'analog';

    // 設計サイズ固定のステージ。中身はここに載せ、ウィンドウに合わせて拡縮する
    // 割合を一定に保つため等倍スケール（fit）
    // 行: ヘッダー / 進捗ゲージ / タイピング表示(可変)
    const STAGE_W = 1060;
    const STAGE_H = 650;
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
    }, { fit: true, designW: STAGE_W, designH: STAGE_H });

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
    // 台本は場面の流れがあるため、セッション開始のたびに登録順の先頭から出題し直す
    resetPhraseSequence(level);
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

    // コンボ表示（中央・コンボ2以上で表示）。倍率はスコアと切り離し、大きく目立たせる。
    // コンボ数(小)＋倍率(大・段階が上がるほど拡大、最大倍率で発光)の2段構成。
    const comboWrap = document.createElement('div');
    comboWrap.style.cssText =
        'display:flex; flex-direction:column; align-items:center; line-height:1; opacity:0;' +
        'transition: opacity 0.2s;';
    const comboCountEl = document.createElement('div');
    comboCountEl.style.cssText = 'font-size:0.85rem; color:#94a3b8; letter-spacing:0.08em;';
    const comboMultEl = document.createElement('div');
    comboMultEl.style.cssText =
        'font-size: 1.6rem; color: #f59e0b; letter-spacing: 0.04em; font-weight: 700;' +
        'transition: font-size 0.15s ease-out, color 0.15s ease-out, text-shadow 0.15s ease-out, transform 0.12s ease-out;';
    comboWrap.appendChild(comboCountEl);
    comboWrap.appendChild(comboMultEl);

    header.appendChild(timerEl);
    header.appendChild(comboWrap);
    header.appendChild(scoreEl);

    // ── 進捗ゲージ (残り時間) ───────────────────────────
    const timeGaugeWrap = document.createElement('div');
    Object.assign(timeGaugeWrap.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.4rem 2rem',
        borderBottom: '1px solid #e2e8f0',
    });
    const timeGaugeLabel = document.createElement('div');
    timeGaugeLabel.style.cssText = `font-size:0.75rem; color:#94a3b8; font-family:${FONT_DISPLAY}; white-space:nowrap;`;
    const timeGaugeTrack = document.createElement('div');
    timeGaugeTrack.style.cssText = 'flex:1; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;';
    const timeGaugeFill = document.createElement('div');
    timeGaugeFill.style.cssText = 'height:100%; width:100%; background:#0891b2; border-radius:4px; transition:width 1s linear, background 0.2s ease;';
    timeGaugeTrack.appendChild(timeGaugeFill);
    timeGaugeWrap.appendChild(timeGaugeLabel);
    timeGaugeWrap.appendChild(timeGaugeTrack);

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

    // 漢字混じりの原文（表示専用。フレーズ単位の静的な表示で、打鍵の進捗には連動しない）
    // ひらがな表示は廃止したため、これがプレイヤーが読むメインの参照テキストになる。
    // そのため小さな補助表示ではなく、はっきり読める大きさで表示する。
    const sourceTextRow = document.createElement('div');
    sourceTextRow.style.cssText = 'display:flex; flex-wrap:wrap; align-items:flex-end; font-size:2rem; font-weight:600; color:#334155; font-family:system-ui,sans-serif; line-height:1.4;';

    const romRow = document.createElement('div');
    romRow.style.cssText = "display:flex; align-items:flex-end; flex-wrap:wrap; font-family:'Audiowide',monospace; letter-spacing:0.03em;";

    typingEl.appendChild(sourceTextRow);
    typingEl.appendChild(romRow);

    // 横顔は打鍵圧フィードバック用なのでアナログモードのみ表示
    if (isAnalog) bottomEl.appendChild(faceCanvas);
    bottomEl.appendChild(typingEl);

    // 打鍵圧のライブグラフ（折れ線、ステージ背景に薄く重ねる。アナログモードのみ）
    // position:absolute で重ねるため、基準となる stage 側を relative にしておく
    let pressureGraph: PressureGraph | null = null;
    if (isAnalog) {
        stage.style.position = 'relative';
        pressureGraph = createPressureGraph(PRESS_LEVEL_COLOR.strong, STAGE_W, STAGE_H);
        stage.appendChild(pressureGraph.element);
    }

    stage.appendChild(header);
    stage.appendChild(timeGaugeWrap);
    stage.appendChild(bottomEl);

    // ── ヘルパー ──────────────────────────────────────
    function getScore() {
        return baseScore + expressionScore;
    }

    function refreshScore() {
        scoreEl.textContent = `${getScore()} pt`;
    }

    // 残り時間ゲージの更新
    function updateTimeGauge() {
        const ratio = Math.max(0, timeLeft / GAME_DURATION_SEC);
        timeGaugeFill.style.width = `${ratio * 100}%`;
        timeGaugeFill.style.background = timeLeft <= 30 ? '#dc2626' : '#0891b2';
        const m = Math.floor(Math.max(0, timeLeft) / 60);
        const s = Math.max(0, timeLeft) % 60;
        timeGaugeLabel.textContent = `のこり ${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateComboBadge() {
        if (combo < 2) {
            comboWrap.style.opacity = '0';
            return;
        }
        comboWrap.style.opacity = '1';
        comboCountEl.textContent = `${combo} COMBO`;

        const mult = comboMultiplier(combo);
        const atMax = mult === MAX_MULT;
        // 倍率の段階が上がるほど文字を大きくする（直感的に「伸びている」と分かるように）
        const size = Math.min(1.6 + comboTier(combo) * 0.3, 3.6);
        comboMultEl.textContent = `×${mult}`;
        comboMultEl.style.fontSize = `${size}rem`;
        if (atMax) {
            comboMultEl.style.color = '#dc2626';
            comboMultEl.style.textShadow = '0 0 12px rgba(220,38,38,0.6)';
        } else {
            comboMultEl.style.color = '#f59e0b';
            comboMultEl.style.textShadow = 'none';
        }
    }

    // 指定文字のフォントレベルを決定する。強く/弱くの指定はそのまま、
    // 普通指定・無指定はどちらも「普通」フォントとして扱う（アイコン表示の分岐と揃える）。
    function fontLevelForInstruction(instruction: PressureInstruction | undefined): PressureLevel {
        return instruction === 'strong' || instruction === 'weak' ? instruction : 'normal';
    }

    function updateTypingDisplay() {
        const romDone = keygraph.key_done();
        const romCandidate = [...keygraph.key_candidate()];
        const phrase = queue[0];

        // ── 漢字混じりの原文（表示専用・フレーズ全体を静的に出すだけ）──
        // ひらがな表示は廃止したため、これがプレイヤーにとってのメイン参照テキストになる。
        // ローマ字欄と同様、強く(▲)/弱く(▼)の指定文字にはマークを1文字ずつ付ける。
        sourceTextRow.innerHTML = '';
        [...phrase.displayText].forEach((ch, i) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const instruction = phrase.displayTargets[i];
            const iconEl = document.createElement('span');
            if (instruction === 'strong' || instruction === 'weak') {
                const label = INSTRUCTION_LABEL[instruction];
                iconEl.textContent = label.symbol;
                iconEl.style.cssText = `font-size:1.4rem; color:${label.color}; font-weight:bold; line-height:1.2;`;
            } else {
                iconEl.innerHTML = '&nbsp;';
                iconEl.style.cssText = 'font-size:1.4rem; line-height:1.2;';
            }

            // 文字自体には color を明示しない。flashMiss() が親要素の color を
            // 赤くフラッシュさせる演出をしており、子要素で色を上書きすると継承が切れて効かなくなる。
            // font-family/font-weight は打鍵圧指定に応じて切り替える（タイプ前から見た目でヒントを出すため）。
            const displayFont = FONT_LEVEL[fontLevelForInstruction(instruction)];
            const charEl = document.createElement('span');
            charEl.textContent = ch;
            charEl.style.cssText = `line-height:1.4; font-family:${displayFont.family}; font-weight:${displayFont.weight};`;

            wrapper.appendChild(iconEl);
            wrapper.appendChild(charEl);
            sourceTextRow.appendChild(wrapper);
        });

        // ── ローマ字: メインの大きい表示（ターゲットのローマ字にマーク）──
        romRow.innerHTML = '';

        // 打鍵済みローマ字: グレーでフラット表示。強く(▲)/弱く(▼)の指定文字には
        // 未入力側と同じマークを打鍵後も表示し続ける。
        [...romDone].forEach((ch, keyIndex) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const instruction = phrase.targets[keyIndex];
            const iconEl = document.createElement('span');
            if (instruction === 'strong' || instruction === 'weak') {
                const label = INSTRUCTION_LABEL[instruction];
                iconEl.textContent = label.symbol;
                iconEl.style.cssText = `font-size:1.4rem; color:${label.color}; font-weight:bold; line-height:1.2;`;
            } else {
                iconEl.innerHTML = '&nbsp;';
                iconEl.style.cssText = 'font-size:1.4rem; line-height:1.2;';
            }

            // 打鍵済みキーは名前入力画面と同様、打鍵圧に応じてフォントを切り替える
            // （通常キーボードは打鍵圧に意味がないため常に normal 扱い）
            const level = isAnalog ? pressureLevel(phrase.keyPressures[keyIndex] ?? 0) : 'normal';
            const font = FONT_LEVEL[level];

            const keysEl = document.createElement('span');
            keysEl.textContent = ch;
            keysEl.style.cssText = `font-size:${ROMAJI_SIZE}; color:#94a3b8; line-height:1; font-family:${font.family}; font-weight:${font.weight};`;

            wrapper.appendChild(iconEl);
            wrapper.appendChild(keysEl);
            romRow.appendChild(wrapper);
        });

        // 未入力ローマ字: 1キー(ローマ字1文字)ごとに列を作り、指定があればマークを付ける
        const doneLen = romDone.length;
        romCandidate.forEach((ch, i) => {
            const keyIndex = doneLen + i; // この文字が何打鍵目か
            const instruction = phrase.targets[keyIndex];

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const iconEl = document.createElement('span');
            // 強く(▲)/弱く(▼)の指定文字には対応するマークを表示する。普通(無指定)はマーク無し。
            if (instruction === 'strong' || instruction === 'weak') {
                const label = INSTRUCTION_LABEL[instruction];
                iconEl.textContent = label.symbol;
                iconEl.style.cssText = `font-size:1.4rem; color:${label.color}; font-weight:bold; line-height:1.2;`;
            } else {
                iconEl.innerHTML = '&nbsp;';
                iconEl.style.cssText = 'font-size:1.4rem; line-height:1.2;';
            }

            // font-family/font-weight は打鍵圧指定に応じて切り替える（タイプ前から見た目でヒントを出すため）。
            const candidateFont = FONT_LEVEL[fontLevelForInstruction(instruction)];
            const isCurrent = i === 0; // 今まさに打つ文字
            const keysEl = document.createElement('span');
            keysEl.textContent = ch;
            keysEl.style.cssText = isCurrent
                ? `font-size:${ROMAJI_CURRENT_SIZE}; color:#0e7490; line-height:1; text-shadow:0 2px 8px rgba(8,145,178,0.35); font-family:${candidateFont.family}; font-weight:${candidateFont.weight};`
                : `font-size:${ROMAJI_SIZE}; color:#0891b2; line-height:1; font-family:${candidateFont.family}; font-weight:${candidateFont.weight};`;

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

    // 打鍵圧(正規化値0〜1)に応じた擬音。境界値は「これ以下」で判定し、それを超えたら次の擬音になる
    function onomatopoeiaFor(t: number): string {
        if (t <= 0.1) return 'スッ';
        if (t <= 0.3) return 'コト';
        if (t <= 0.5) return 'カタ';
        if (t <= 0.7) return 'ガタ!!!';
        return 'ド!!!!!';
    }

    // 擬音の表示位置をランダムにばらつかせる範囲（typingEl 基準の%とrem）
    const BURST_LEFT_MIN = 15;
    const BURST_LEFT_MAX = 85;
    const BURST_BOTTOM_MIN = 2.5;
    const BURST_BOTTOM_MAX = 5;

    // アナログモードの打鍵圧フィードバック: 従来の3分割(弱/普通/強)で色分けした擬音をポップさせる
    function triggerPressureBurst(pressure: number) {
        const t = normalizeN(pressure);
        const color = PRESS_LEVEL_COLOR[pressureLevel(pressure)];

        // 毎回同じ場所に出ると単調で重なりやすいので、表示位置をランダムにする
        const left = BURST_LEFT_MIN + Math.random() * (BURST_LEFT_MAX - BURST_LEFT_MIN);
        const bottom = BURST_BOTTOM_MIN + Math.random() * (BURST_BOTTOM_MAX - BURST_BOTTOM_MIN);

        const burst = document.createElement('div');
        Object.assign(burst.style, {
            position: 'absolute',
            left: `${left}%`,
            bottom: `${bottom}rem`,
            transform: 'translateX(-50%)',
            fontSize: `${1.6 + t * 2.2}rem`,
            color,
            fontFamily: FONT_DISPLAY,
            fontWeight: 'bold',
            textShadow: `0 0 12px ${color}`,
            animation: `kw-char-pop ${0.4 + t * 0.2}s ease-out forwards`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
        });
        burst.textContent = onomatopoeiaFor(t);
        effectLayer.appendChild(burst);
        burst.addEventListener('animationend', () => burst.remove());
    }

    function flashMiss() {
        // ひらがな行の廃止に伴い、ミス時の赤フラッシュは原文(sourceTextRow)に適用する
        sourceTextRow.style.color = '#dc2626';
        setTimeout(() => { sourceTextRow.style.color = '#334155'; }, 120);
        flashRedScreen(); // ミス時に画面全体を赤くフラッシュ
    }

    const clearSound = new Audio('/maou_se_system48.mp3');
    // preservesPitch を切ることで、playbackRate を上げたときに実際にピッチが上がるようにする
    // （既定では速度だけ変えてピッチを保つブラウザが多いため）
    clearSound.preservesPitch = false;
    (clearSound as any).mozPreservesPitch = false;
    (clearSound as any).webkitPreservesPitch = false;
    function playClearSound(combo: number) {
        clearSound.currentTime = 0;
        // コンボが伸びるほど再生速度(=ピッチ)を上げ、繋がっている手応えを音でも伝える
        clearSound.playbackRate = Math.min(SE_PITCH_BASE + combo * SE_PITCH_STEP, SE_PITCH_MAX);
        clearSound.play().catch(() => {});
    }

    // 指定クリア時の加点ポップ（表現点＋コンボ倍率）
    function showComboGain(gained: number, mult: number) {
        comboMultEl.style.transform = 'scale(1.25)';
        setTimeout(() => { comboMultEl.style.transform = 'scale(1)'; }, 120);

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

    // 指定文字1つを判定してコンボ・表現点を更新。クリアできたかを呼び出し側に返す(答え合わせ表示用)。
    function judgeTarget(instruction: PressureInstruction, pressure: number): boolean {
        const level = pressureLevel(pressure);
        const cleared = (instruction === 'strong' && level !== 'weak')
                     || (instruction === 'weak' && level !== 'strong')
                     || (instruction === 'normal' && level === 'normal');
        if (cleared) {
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            const mult = comboMultiplier(combo);
            const gained = 50 * mult;
            expressionScore += gained;
            pressureClears++;
            playClearSound(combo);
            showComboGain(gained, mult);
            // 倍率が最大に達した状態でコンボを継続すると、1コンボごとにボーナスタイムが伸びる
            if (mult === MAX_MULT) {
                timeLeft += MAX_COMBO_BONUS_SEC;
                updateTimeDisplay();
            }
        } else {
            combo = 0;
        }
        updateComboBadge();
        refreshScore();
        return cleared;
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

        queue.shift();
        queue.push(generatePhrase(level));
        buildCurrentPhrase();

        updateTypingDisplay();
    }

    // タイマー表示の更新。timeLeft は最大コンボのボーナスで小数になりうるので表示前に切り捨てる
    function updateTimeDisplay() {
        const shown = Math.max(0, Math.floor(timeLeft));
        const m = Math.floor(shown / 60);
        const s = shown % 60;
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        timerEl.style.color = timeLeft <= 30 ? '#dc2626' : '#0891b2';
    }

    function updateTimer() {
        timeLeft--;

        updateTimeDisplay();
        if (timeLeft <= 30) timerEl.style.color = '#dc2626';
        updateTimeGauge();
      
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            cleanup();
            onFinish({ mode, level, name, phrasesCompleted, pressureClears, totalTargets, pressures: sessionPressures, baseScore, expressionScore, maxCombo });
        }
    }

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
                // ローマ字表示のフォント切り替え用に、このキーの打鍵圧を記録
                phrase.keyPressures[keyIndex] = pressure;
            } else {
                // 通常モードはリップルで打鍵フィードバック
                triggerEffect(key, pressure);
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
            playFormant(value);
            // 打鍵圧の強さに応じた画面揺れ・擬音エフェクト
            shakeScreen(app, normalizeN(value));
            triggerPressureBurst(value);
            // ライブグラフは calcPressure の結果(底打ち毎のNewton相当値)をそのまま渡す
            pressureGraph?.push(value);
            // このコールバック＝底打ち検出。入力と検圧をここで同時に確定する。
            // code は "A" "Q" のような大文字1文字。keygraph は小文字1文字を期待。
            const key = code.toLowerCase();
            if (key.length === 1) processInput(key, value);
        });

        // ── アナログ生値（押下量 0〜1）→ ライブメーター ──────────────
        setRawListener((_code: string, value: number) => {
            pressureMeter?.update(value);
        });
    }

    // ── 後片付け ──────────────────────────────────────
    function cleanup() {
        document.removeEventListener('keydown', keydownHandler);
        pressureMeter?.dispose();
        pressureGraph?.dispose();
        disposeStage();
        clearPressureListener();
        clearRawListener();
    }

    // ── 初期描画 ──────────────────────────────────────
    updateTypingDisplay();
    updateTimeGauge();
    timerInterval = setInterval(updateTimer, 1000);
}
