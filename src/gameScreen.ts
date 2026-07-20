import { keygraph } from './keygraph.js';
import {
    generatePhrase,
    countPressureClears,
    type PhraseData,
    INSTRUCTION_LABEL,
    normalizeN,
} from './phrases';
import { playFormant } from './audio';
import { keyboard, wooting60heplus } from './keyboard';

const GAME_DURATION_SEC = 120;
const VISIBLE_BUBBLES = 5;

export interface GameResult {
    phrasesCompleted: number;
    pressureClears: number;
}

export interface GameScreenOptions {
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
// 吹き出しひとつを作成
// doneCount: アクティブ時に何文字入力済みか（グレーアウト用）
// -----------------------------------------------------------------------
function createBubble(phrase: PhraseData, isActive: boolean, doneCount = 0): HTMLDivElement {
    const { symbol, color, name } = INSTRUCTION_LABEL[phrase.instruction];
    const charSize = isActive ? '3.6rem' : '2.8rem';
    const iconSize = isActive ? '1.4rem' : '1.1rem';

    const bubble = document.createElement('div');
    Object.assign(bubble.style, {
        position: 'relative',
        background: isActive ? '#eef6fa' : '#f8fafc',
        border: isActive ? `2px solid #0891b2` : '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '0.8rem 1.2rem',
        paddingLeft: phrase.instruction === 'vibrato' ? '2.6rem' : '1.2rem',
        opacity: isActive ? '1' : '0.45',
        transition: 'opacity 0.3s',
        minHeight: '3.5rem',
        width: '900px',
        maxWidth: '92vw',
        display: 'flex',
        alignItems: 'flex-end',
    });

    // ビブラートはバブル左上にアイコン
    if (phrase.instruction === 'vibrato') {
        const icon = document.createElement('span');
        icon.textContent = symbol;
        icon.title = name;
        Object.assign(icon.style, {
            position: 'absolute',
            left: '0.6rem',
            top: '0.6rem',
            fontSize: '1rem',
            color,
            fontWeight: 'bold',
        });
        bubble.appendChild(icon);
    }

    const charsEl = document.createElement('div');
    Object.assign(charsEl.style, {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0',
        flexWrap: 'wrap',
    });

    const chars = [...phrase.text];
    const targetSet = new Set(phrase.targets);

    // アクティブ吹き出しは未入力文字のみ表示
    const displayChars = isActive ? chars.slice(doneCount) : chars;
    const indexOffset  = isActive ? doneCount : 0;

    displayChars.forEach((ch, j) => {
        const i = j + indexOffset; // 元のフレーズ内インデックス

        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        });

        // アイコン: アクティブ時は先頭文字（現在入力中）にマーク、非アクティブはターゲット文字にマーク
        const showIcon = phrase.instruction !== 'vibrato' && (
            isActive ? j === 0 : targetSet.has(i)
        );
        const iconEl = document.createElement('span');
        if (showIcon) {
            iconEl.textContent = symbol;
            iconEl.style.cssText = `font-size:${iconSize}; color:${color}; font-weight:bold; line-height:1.2;`;
            iconEl.title = name;
        } else {
            iconEl.textContent = '\u00A0';
            iconEl.style.cssText = `font-size:${iconSize}; line-height:1.2;`;
        }

        const charEl = document.createElement('span');
        charEl.textContent = ch;
        charEl.style.cssText = `font-size:${charSize}; font-family:system-ui,sans-serif; color:#1e293b;`;

        wrapper.appendChild(iconEl);
        wrapper.appendChild(charEl);
        charsEl.appendChild(wrapper);
    });

    bubble.appendChild(charsEl);
    return bubble;
}

// -----------------------------------------------------------------------
// メイン
// -----------------------------------------------------------------------
export function showGameScreen(
    app: HTMLDivElement,
    options: GameScreenOptions,
): void {
    const { setPressureListener, clearPressureListener, setRawListener, clearRawListener, onFinish } = options;

    app.innerHTML = '';
    app.removeAttribute('style');
    Object.assign(app.style, {
        display: 'grid',
        gridTemplateRows: 'auto 1fr 200px auto',
        width: '100%',
        height: '100%',
        background: '#ffffff',
        color: '#1e293b',
        overflow: 'hidden',
    });

    // ── 状態 ──────────────────────────────────────────
    let queue: PhraseData[] = [];
    let phrasesCompleted = 0;
    let pressureClears = 0;
    let timeLeft = GAME_DURATION_SEC;
    let lastPressureN = 0.6;
    let timerInterval = 0;

    // フレーズキューを初期化 (queue[0]=現在, queue[1..VISIBLE_BUBBLES]=吹き出し表示分)
    for (let i = 0; i < VISIBLE_BUBBLES + 2; i++) queue.push(generatePhrase());
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
    timerEl.textContent = '2:00';

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size: 1.4rem; color: #ca8a04;';
    scoreEl.textContent = '0 pt';

    header.appendChild(timerEl);
    header.appendChild(scoreEl);

    // ── 吹き出しエリア ────────────────────────────────
    const bubblesEl = document.createElement('div');
    Object.assign(bubblesEl.style, {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '1rem 2rem',
        gap: '0.8rem',
        overflow: 'hidden',
    });

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
        maxWidth: '60vw',
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

    bottomEl.appendChild(faceCanvas);
    bottomEl.appendChild(typingEl);

    // ── キーボードエリア ───────────────────────────────
    const keyboardWrapper = document.createElement('div');
    Object.assign(keyboardWrapper.style, {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#ffffff',
        // scale(2) で高さが2倍になるが layout 上の高さは変わらないので padding で補う
        padding: '30px 0',
    });

    const keyboardEl = document.createElement('div');
    keyboardEl.style.width = "80vw";
    keyboardEl.style.transformOrigin = 'center center';

    keyboardWrapper.appendChild(keyboardEl);
    const updateKey = keyboard(keyboardEl, wooting60heplus);

    app.appendChild(header);
    app.appendChild(bubblesEl);
    app.appendChild(bottomEl);
    app.appendChild(keyboardWrapper);

    // ── ヘルパー ──────────────────────────────────────
    function getScore() {
        return phrasesCompleted * 100 + pressureClears * 50;
    }

    function renderBubbles() {
        bubblesEl.innerHTML = '';
        // queue[0] = 現在入力中（吹き出しには出さず底部表示のみ）
        // queue[1] = 次のフレーズ → 一番下の吹き出し（isActive スタイル）
        // queue[2], queue[3] = それ以降
        const visible = queue.slice(1, VISIBLE_BUBBLES + 1);
        for (let i = visible.length - 1; i >= 0; i--) {
            const bubble = createBubble(visible[i], false, 0);
            bubblesEl.appendChild(bubble);
        }
    }

    function updateTypingDisplay() {
        const done = [...(keygraph.seq_done() ?? '')];
        const candidates = [...(keygraph.seq_candidates() ?? queue[0].text)];
        const romDone = keygraph.key_done();
        const romCandidate = keygraph.key_candidate();
        const phrase = queue[0];
        const { symbol, color } = INSTRUCTION_LABEL[phrase.instruction];
        const targetSet = new Set(phrase.targets);

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
            const showIcon = phrase.instruction === 'vibrato'
                ? j === 0  // vibrato は先頭にのみ表示
                : targetSet.has(originalIdx);

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            const iconEl = document.createElement('span');
            iconEl.textContent = showIcon ? symbol : '\u00A0';
            iconEl.style.cssText = `font-size:1.2rem; color:${color}; font-weight:bold; line-height:1.2;`;

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
    }

    const clearSound = new Audio('/maou_se_system48.mp3');

    function completePhrase() {
        const phrase = queue[0];
        const clearedCount = countPressureClears(phrase);
        pressureClears += clearedCount;
        for (let i = 0; i < clearedCount; i++) {
            const delay = i * 200;
            setTimeout(() => {
                clearSound.currentTime = 0;
                clearSound.play().catch(() => {});
            }, delay);
        }
        phrasesCompleted++;
        scoreEl.textContent = `${getScore()} pt`;

        queue.shift();
        queue.push(generatePhrase());
        keygraph.build(queue[0].text);

        renderBubbles();
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
            onFinish({ phrasesCompleted, pressureClears });
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

            triggerEffect(key, pressure);
            phrase.allPressures.push(pressure);

            // keygraph.next() 後に seq_done が増えていればひらがな1文字完了
            const charsAfter = [...(keygraph.seq_done() ?? '')].length;
            if (charsAfter > charsBefore) {
                phrase.charPressures[charsBefore] = pressure;
            }

            if (keygraph.is_finished()) {
                completePhrase(); // 内部で renderBubbles / updateTypingDisplay を呼ぶ
            } else {
                renderBubbles();
                updateTypingDisplay();
            }
        } else {
            flashMiss();
        }
    };
    document.addEventListener('keydown', keydownHandler);

    // ── 打鍵圧コールバック ────────────────────────────
    setPressureListener((_code: string, value: number) => {
        lastPressureN = value;
        drawFace(faceCanvas, value);
        updateKey(_code, value);
        setTimeout(() => {
            updateKey(_code, 0);
        }, 300);
        playFormant(value);
    });

    // ── アナログ生値 → キーボード表示 ────────────────
     setRawListener((code: string, value: number) => {
         //updateKey(code, value);
         console.log(`Raw: ${code} = ${value}`);
     });

    // ── 後片付け ──────────────────────────────────────
    function cleanup() {
        document.removeEventListener('keydown', keydownHandler);
        document.removeEventListener('contextmenu', contextMenuHandler);
        clearPressureListener();
        clearRawListener();
    }

    // ── 初期描画 ──────────────────────────────────────
    renderBubbles();
    updateTypingDisplay();
    timerInterval = setInterval(updateTimer, 1000);
}
