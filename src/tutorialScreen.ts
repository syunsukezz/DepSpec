import { keygraph } from './keygraph.js';
import { INSTRUCTION_LABEL, normalizeN } from './phrases';
import { playFormant } from './audio';

// 閾値 (phrases.ts と同じ値)
const STRONG_THRESHOLD = 0.55;
const WEAK_THRESHOLD   = 0.35;
const VIBRATO_STDDEV   = 0.2;
const VIBRATO_MIN_SAMPLES = 6;

export interface TutorialOptions {
    setPressureListener: (cb: (code: string, value: number) => void) => void;
    clearPressureListener: () => void;
    onComplete: () => void;
    onSkip: () => void;
}

export function showTutorialScreen(app: HTMLDivElement, options: TutorialOptions): void {
    const { setPressureListener, clearPressureListener, onComplete, onSkip } = options;

    app.innerHTML = '';
    app.removeAttribute('style');
    Object.assign(app.style, {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#0a0a0f',
        color: 'white',
        fontFamily: "'Audiowide', sans-serif",
        overflow: 'hidden',
    });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes tut-fadein {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tut-success {
            0%   { transform: scale(0.6); opacity: 0; }
            60%  { transform: scale(1.15); }
            100% { transform: scale(1);   opacity: 1; }
        }
        .tut-step { animation: tut-fadein 0.3s ease-out both; }
        .tut-next-btn:hover:not(:disabled) { background: rgba(125,223,255,0.12) !important; }
        .tut-skip-btn:hover { color: #94a3b8 !important; }
    `;
    document.head.appendChild(style);

    // ── ヘッダー ───────────────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 2rem',
        borderBottom: '1px solid #1e293b',
    });
    const titleEl = document.createElement('span');
    titleEl.textContent = 'Tutorial';
    titleEl.style.cssText = 'font-size:1.1rem; color:#7ddfff; letter-spacing:0.2em;';
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip →';
    skipBtn.className = 'tut-skip-btn';
    Object.assign(skipBtn.style, {
        background: 'transparent', border: 'none', color: '#475569',
        fontFamily: "'Audiowide', sans-serif", fontSize: '0.85rem',
        cursor: 'pointer', transition: 'color 0.2s',
    });
    skipBtn.addEventListener('click', () => { cleanup(); onSkip(); });
    header.appendChild(titleEl);
    header.appendChild(skipBtn);

    // ── 進捗ドット ─────────────────────────────────────────────
    const STEPS = 4;
    const dotsEl = document.createElement('div');
    Object.assign(dotsEl.style, {
        display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 0',
    });
    const dots: HTMLSpanElement[] = [];
    for (let i = 0; i < STEPS; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = `
            display:inline-block; width:8px; height:8px; border-radius:50%;
            background:#1e293b; border:1px solid #334155; transition:background 0.3s;
        `;
        dots.push(dot);
        dotsEl.appendChild(dot);
    }

    // ── コンテンツエリア ───────────────────────────────────────
    const contentEl = document.createElement('div');
    Object.assign(contentEl.style, {
        flex: '1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', gap: '1.5rem', overflow: 'hidden',
    });

    // ── ナビ ───────────────────────────────────────────────────
    const navEl = document.createElement('div');
    Object.assign(navEl.style, {
        display: 'flex', justifyContent: 'center',
        padding: '1.2rem 2rem', borderTop: '1px solid #1e293b',
    });
    const nextBtn = document.createElement('button');
    nextBtn.className = 'tut-next-btn';
    Object.assign(nextBtn.style, {
        padding: '0.7rem 3rem', background: 'transparent',
        border: '2px solid #7ddfff', color: '#7ddfff',
        fontFamily: "'Audiowide', sans-serif", fontSize: '1rem',
        cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s, opacity 0.2s',
        letterSpacing: '0.1em',
    });
    nextBtn.addEventListener('click', advance);

    app.appendChild(header);
    app.appendChild(dotsEl);
    app.appendChild(contentEl);
    app.appendChild(navEl);
    navEl.appendChild(nextBtn);

    // ── ステップ管理 ───────────────────────────────────────────
    let currentStep = 0;
    let stepCleanup: (() => void) | null = null;

    function setStep(n: number) {
        currentStep = n;
        if (stepCleanup) { stepCleanup(); stepCleanup = null; }
        clearPressureListener();
        dots.forEach((d, i) => { d.style.background = i <= n ? '#7ddfff' : '#1e293b'; });
        contentEl.innerHTML = '';
        setNextEnabled(false);
        STEP_RENDERERS[n]();
    }

    function advance() {
        if (currentStep < STEPS - 1) setStep(currentStep + 1);
        else { cleanup(); onComplete(); }
    }

    function setNextEnabled(enabled: boolean) {
        nextBtn.disabled = !enabled;
        nextBtn.style.opacity = enabled ? '1' : '0.3';
        nextBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    // ── 共通 UI ヘルパー ───────────────────────────────────────
    function makeCard(): HTMLDivElement {
        const card = document.createElement('div');
        card.className = 'tut-step';
        Object.assign(card.style, {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '1.4rem', width: '100%', maxWidth: '680px',
        });
        return card;
    }

    function makeHeading(symbol: string, color: string, name: string): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; align-items:center; gap:0.7rem;';
        const sym = document.createElement('span');
        sym.textContent = symbol;
        sym.style.cssText = `font-size:2.8rem; color:${color};`;
        const nm = document.createElement('span');
        nm.textContent = name;
        nm.style.cssText = `font-size:2rem; color:${color}; letter-spacing:0.15em;`;
        wrap.appendChild(sym);
        wrap.appendChild(nm);
        return wrap;
    }

    function makeDesc(text: string): HTMLParagraphElement {
        const p = document.createElement('p');
        p.textContent = text;
        Object.assign(p.style, {
            fontSize: '1rem', color: '#94a3b8', lineHeight: '1.8',
            textAlign: 'center', margin: '0', maxWidth: '500px',
            fontFamily: 'system-ui, sans-serif',
        });
        return p;
    }

    /** 圧力ゲージ: value 0~1 */
    function makePressureGauge(): { el: HTMLDivElement; update: (t: number) => void } {
        const outer = document.createElement('div');
        Object.assign(outer.style, {
            width: '320px', height: '18px', background: '#1e293b',
            borderRadius: '9px', overflow: 'hidden', position: 'relative',
        });
        const fill = document.createElement('div');
        Object.assign(fill.style, {
            height: '100%', width: '0%', borderRadius: '9px',
            background: 'linear-gradient(90deg, #3b82f6, #ef4444)',
            transition: 'width 0.08s ease-out',
        });
        outer.appendChild(fill);
        return {
            el: outer,
            update: (t: number) => { fill.style.width = `${Math.min(1, t) * 100}%`; },
        };
    }

    /** 成功メッセージ */
    function showSuccess(container: HTMLDivElement, msg = 'クリア！'): void {
        const el = document.createElement('div');
        el.textContent = `✓ ${msg}`;
        el.style.cssText = `
            font-size:1.3rem; color:#22c55e; letter-spacing:0.1em;
            animation: tut-success 0.4s ease-out both;
        `;
        container.appendChild(el);
    }

    // 顔描画（tutorialScreen 内）
    function drawFaceMini(canvas: HTMLCanvasElement, newtonValue: number, color = '#7ddfff'): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const t = normalizeN(newtonValue);
        const gapRad = ((360 - (350 - t * 50)) / 2) * (Math.PI / 180);
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.38;
        ctx.beginPath();
        ctx.arc(cx, cy, r, gapRad, 2 * Math.PI - gapRad, false);
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
        const p1x = cx + r * Math.cos(gapRad), p1y = cy + r * Math.sin(gapRad);
        const p2x = cx + r * Math.cos(-gapRad), p2y = cy + r * Math.sin(-gapRad);
        ctx.beginPath();
        ctx.moveTo(p1x, p1y); ctx.lineTo(cx, cy); ctx.lineTo(p2x, p2y);
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + r * 0.28, cy - r * 0.32, r * 0.08, 0, 2 * Math.PI);
        ctx.fillStyle = color; ctx.fill();
    }

    // ── Step 0: タイピング練習 ─────────────────────────────────
    function renderStep0() {
        nextBtn.textContent = 'Next →';
        const PRACTICE = 'あいう';
        keygraph.build(PRACTICE);

        const card = makeCard();
        const heading = document.createElement('h2');
        heading.textContent = 'タイピング練習';
        heading.style.cssText = 'font-size:1.8rem; color:#7ddfff; letter-spacing:0.15em; margin:0;';
        card.appendChild(heading);
        card.appendChild(makeDesc(`「${PRACTICE}」をローマ字で入力してください`));

        const kanaRow = document.createElement('div');
        kanaRow.style.cssText = 'display:flex; gap:0.2rem; align-items:flex-end; font-family:system-ui,sans-serif;';
        const romRow = document.createElement('div');
        romRow.style.cssText = "font-size:1.4rem; font-family:'Audiowide',monospace; letter-spacing:0.05em;";

        card.appendChild(kanaRow);
        card.appendChild(romRow);
        contentEl.appendChild(card);

        function updateDisplay() {
            const done = [...(keygraph.seq_done() ?? '')];
            const candidates = [...(keygraph.seq_candidates() ?? PRACTICE)];
            kanaRow.innerHTML = '';
            done.forEach(ch => {
                const s = document.createElement('span');
                s.textContent = ch;
                s.style.cssText = 'font-size:3.5rem; color:#475569;';
                kanaRow.appendChild(s);
            });
            candidates.forEach(ch => {
                const s = document.createElement('span');
                s.textContent = ch;
                s.style.cssText = 'font-size:3.5rem; color:#f1f5f9;';
                kanaRow.appendChild(s);
            });
            romRow.innerHTML =
                `<span style="color:#334155">${keygraph.key_done()}</span>` +
                `<span style="color:#7ddfff">${keygraph.key_candidate()}</span>`;
        }
        updateDisplay();

        function onKey(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
            e.preventDefault();
            if (keygraph.next(e.key.toLowerCase())) {
                updateDisplay();
                if (keygraph.is_finished()) {
                    showSuccess(card);
                    setNextEnabled(true);
                    document.removeEventListener('keydown', onKey);
                }
            } else {
                kanaRow.style.color = '#ef4444';
                setTimeout(() => { kanaRow.style.color = ''; }, 120);
            }
        }
        document.addEventListener('keydown', onKey);
        stepCleanup = () => document.removeEventListener('keydown', onKey);
    }

    // ── Step 1: 強く ───────────────────────────────────────────
    function renderStep1() {
        nextBtn.textContent = 'Next →';
        const { symbol, color, name } = INSTRUCTION_LABEL['strong'];

        const card = makeCard();
        card.appendChild(makeHeading(symbol, color, name));
        card.appendChild(makeDesc('キーを力強く押してください。ゲージが右端付近まで達したらクリアです。'));

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120; faceCanvas.height = 120;
        drawFaceMini(faceCanvas, 0.6, color);

        const gauge = makePressureGauge();

        // 閾値マーカー
        const gaugeWrap = document.createElement('div');
        gaugeWrap.style.cssText = 'position:relative; display:flex; flex-direction:column; align-items:flex-start;';
        gaugeWrap.appendChild(gauge.el);
        const marker = document.createElement('div');
        marker.style.cssText = `
            position:absolute; top:0; bottom:0; left:${STRONG_THRESHOLD * 100}%;
            width:2px; background:${color}; opacity:0.7;
        `;
        gauge.el.appendChild(marker);
        const markerLabel = document.createElement('div');
        markerLabel.textContent = '← ここ以上';
        markerLabel.style.cssText = `font-size:0.7rem; color:${color}; font-family:system-ui,sans-serif;
            position:absolute; top:22px; left:${STRONG_THRESHOLD * 100}%; white-space:nowrap;`;
        gauge.el.style.position = 'relative';
        gauge.el.appendChild(markerLabel);
        gaugeWrap.appendChild(gauge.el);

        card.appendChild(faceCanvas);
        card.appendChild(gaugeWrap);
        contentEl.appendChild(card);

        setPressureListener((_code, value) => {
            const t = normalizeN(value);
            gauge.update(t);
            drawFaceMini(faceCanvas, value, color);
            playFormant(value);
            if (t >= STRONG_THRESHOLD) {
                showSuccess(card, '強打を検出！');
                setNextEnabled(true);
                clearPressureListener();
            }
        });
    }

    // ── Step 2: 弱く ───────────────────────────────────────────
    function renderStep2() {
        nextBtn.textContent = 'Next →';
        const { symbol, color, name } = INSTRUCTION_LABEL['weak'];

        const card = makeCard();
        card.appendChild(makeHeading(symbol, color, name));
        card.appendChild(makeDesc('キーをそっと、やさしく押してください。ゲージが低い位置に留まったらクリアです。'));

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120; faceCanvas.height = 120;
        drawFaceMini(faceCanvas, 0.6, color);

        const gauge = makePressureGauge();
        gauge.el.style.position = 'relative';
        const marker = document.createElement('div');
        marker.style.cssText = `
            position:absolute; top:0; bottom:0; left:${WEAK_THRESHOLD * 100}%;
            width:2px; background:${color}; opacity:0.7;
        `;
        gauge.el.appendChild(marker);
        const markerLabel = document.createElement('div');
        markerLabel.textContent = 'ここ以下 →';
        markerLabel.style.cssText = `font-size:0.7rem; color:${color}; font-family:system-ui,sans-serif;
            position:absolute; top:22px; right:${(1 - WEAK_THRESHOLD) * 100}%; white-space:nowrap;`;
        gauge.el.appendChild(markerLabel);

        card.appendChild(faceCanvas);
        card.appendChild(gauge.el);
        contentEl.appendChild(card);

        setPressureListener((_code, value) => {
            const t = normalizeN(value);
            gauge.update(t);
            drawFaceMini(faceCanvas, value, color);
            playFormant(value);
            if (t <= WEAK_THRESHOLD) {
                showSuccess(card, '弱打を検出！');
                setNextEnabled(true);
                clearPressureListener();
            }
        });
    }

    // ── Step 3: ビブラート ─────────────────────────────────────
    function renderStep3() {
        nextBtn.textContent = 'ゲームスタート！';
        const { symbol, color, name } = INSTRUCTION_LABEL['vibrato'];

        const card = makeCard();
        card.appendChild(makeHeading(symbol, color, name));
        card.appendChild(makeDesc(
            `打鍵圧を強→弱→強と変化させながら${VIBRATO_MIN_SAMPLES}回以上キーを押してください。`
        ));

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120; faceCanvas.height = 120;
        drawFaceMini(faceCanvas, 0.6, color);

        // 打鍵履歴ドット
        const historyEl = document.createElement('div');
        Object.assign(historyEl.style, {
            display: 'flex', alignItems: 'flex-end', gap: '4px',
            height: '60px', padding: '4px',
            background: '#111827', borderRadius: '8px',
            width: '320px',
        });

        const pressures: number[] = [];
        let cleared = false;

        function addPressureDot(t: number) {
            const dot = document.createElement('div');
            const h = Math.max(6, t * 52);
            Object.assign(dot.style, {
                width: '16px', height: `${h}px`, borderRadius: '3px',
                background: color, opacity: '0.8', flexShrink: '0',
                transition: 'height 0.1s',
            });
            historyEl.appendChild(dot);
            // 古いドットを削除して幅を保つ
            while (historyEl.children.length > 16) {
                historyEl.removeChild(historyEl.firstChild!);
            }
        }

        // stddev チェック
        function checkVibrato(): boolean {
            if (pressures.length < VIBRATO_MIN_SAMPLES) return false;
            const logs = pressures.map(n => Math.log(Math.max(n, 0.01)));
            const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
            const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
            return Math.sqrt(variance) >= VIBRATO_STDDEV;
        }

        // カウンタ表示
        const countEl = document.createElement('div');
        countEl.style.cssText = `font-size:0.85rem; color:#64748b; font-family:system-ui,sans-serif;`;
        countEl.textContent = `0 / ${VIBRATO_MIN_SAMPLES} 回`;

        card.appendChild(faceCanvas);
        card.appendChild(historyEl);
        card.appendChild(countEl);
        contentEl.appendChild(card);

        setPressureListener((_code, value) => {
            if (cleared) return;
            const t = normalizeN(value);
            pressures.push(value);
            if (pressures.length > VIBRATO_MIN_SAMPLES) pressures.shift();
            addPressureDot(t);
            drawFaceMini(faceCanvas, value, color);
            playFormant(value);
            countEl.textContent = `${pressures.length} / ${VIBRATO_MIN_SAMPLES} 回`;
            if (checkVibrato()) {
                cleared = true;
                showSuccess(card, 'ビブラートを検出！');
                setNextEnabled(true);
                clearPressureListener();
            }
        });
    }

    // ── 後片付け ───────────────────────────────────────────────
    function cleanup() {
        if (stepCleanup) { stepCleanup(); stepCleanup = null; }
        clearPressureListener();
        style.remove();
    }

    const STEP_RENDERERS = [renderStep0, renderStep1, renderStep2, renderStep3];
    setStep(0);
}
