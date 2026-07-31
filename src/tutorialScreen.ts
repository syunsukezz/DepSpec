import { INSTRUCTION_LABEL, normalizeN, pressureLevel, LEVEL_LOW, LEVEL_HIGH } from './phrases';
import { playFormant } from './audio';
import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { createPressureMeter } from './pressureMeter';
import { drawFace } from './faceDraw';
import { FONT_DISPLAY, PRESS_WEAK, PRESS_STRONG } from './theme';

export interface TutorialOptions {
    mode: GameMode;
    setPressureListener: (cb: (code: string, value: number) => void) => void;
    clearPressureListener: () => void;
    setRawListener: (cb: (code: string, value: number) => void) => void;
    clearRawListener: () => void;
    onComplete: () => void;
    onSkip: () => void;
}

export function showTutorialScreen(app: HTMLDivElement, options: TutorialOptions): void {
    const { mode, setPressureListener, clearPressureListener, setRawListener, clearRawListener, onComplete, onSkip } = options;
    const isAnalog = mode === 'analog';
    // アナログは打鍵圧(強/弱)の練習ステップのみ。通常モードは教える内容が無いのでスキップ。
    const STEP_RENDERERS = isAnalog
        ? [renderStep1, renderStep2, renderStep3]
        : [];
    const STEPS = STEP_RENDERERS.length;

    // 割合を一定に保つため等倍スケール（fit）
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_DISPLAY,
    }, { fit: true, designW: 1000, designH: 720 });

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
        .tut-skip-btn:hover { color: #334155 !important; }
    `;
    document.head.appendChild(style);

    // ── ヘッダー ───────────────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 2rem',
        borderBottom: '1px solid #e2e8f0',
    });
    const titleEl = document.createElement('span');
    titleEl.textContent = 'Tutorial';
    titleEl.style.cssText = 'font-size:1.1rem; color:#0891b2; letter-spacing:0.2em;';
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip →';
    skipBtn.className = 'tut-skip-btn';
    Object.assign(skipBtn.style, {
        background: 'transparent', border: 'none', color: '#94a3b8',
        fontFamily: FONT_DISPLAY, fontSize: '0.85rem',
        cursor: 'pointer', transition: 'color 0.2s',
    });
    skipBtn.addEventListener('click', () => { cleanup(); onSkip(); });
    header.appendChild(titleEl);
    header.appendChild(skipBtn);

    // ── 進捗ドット ─────────────────────────────────────────────
    const dotsEl = document.createElement('div');
    Object.assign(dotsEl.style, {
        display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 0',
    });
    const dots: HTMLSpanElement[] = [];
    for (let i = 0; i < STEPS; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = `
            display:inline-block; width:8px; height:8px; border-radius:50%;
            background:#e2e8f0; border:1px solid #cbd5e1; transition:background 0.3s;
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

    stage.appendChild(header);
    stage.appendChild(dotsEl);
    stage.appendChild(contentEl);

    // ── 押下量の常時ライブメーター（アナログのみ）───────────────
    // メーターは calcPressure に通す前の生の押下量(0〜1)を使う。
    // 生値は rawListener で取れるので、ステップに関係なく一度だけ張って常時更新する。
    const meter = isAnalog ? createPressureMeter() : null;
    if (meter) setRawListener((_c, v) => meter.update(v));
    /** ステップ用の打鍵圧(calcPressure後)リスナーを張る */
    function listenPressure(cb: (code: string, value: number) => void): void {
        setPressureListener(cb);
    }

    // ── ステップ管理 ───────────────────────────────────────────
    let currentStep = 0;
    let stepCleanup: (() => void) | null = null;
    let autoAdvanceTimer = 0;

    function setStep(n: number) {
        currentStep = n;
        clearTimeout(autoAdvanceTimer);
        if (stepCleanup) { stepCleanup(); stepCleanup = null; }
        clearPressureListener();
        dots.forEach((d, i) => { d.style.background = i <= n ? '#0891b2' : '#e2e8f0'; });
        contentEl.innerHTML = '';
        STEP_RENDERERS[n]();
    }

    function advance() {
        clearTimeout(autoAdvanceTimer);
        if (currentStep < STEPS - 1) setStep(currentStep + 1);
        else { cleanup(); onComplete(); }
    }

    /** クリア判定後、少し間を置いて自動的に次のステップへ */
    function scheduleAdvance(delay = 800): void {
        autoAdvanceTimer = window.setTimeout(advance, delay);
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
            fontSize: '1rem', color: '#64748b', lineHeight: '1.8',
            textAlign: 'center', margin: '0', maxWidth: '500px',
            fontFamily: 'system-ui, sans-serif',
        });
        return p;
    }

    /** 圧力ゲージ: value 0~1 */
    function makePressureGauge(): { el: HTMLDivElement; update: (t: number) => void } {
        const outer = document.createElement('div');
        Object.assign(outer.style, {
            width: '320px', height: '18px', background: '#e2e8f0',
            borderRadius: '9px', overflow: 'hidden', position: 'relative',
        });
        const fill = document.createElement('div');
        Object.assign(fill.style, {
            height: '100%', width: '0%', borderRadius: '9px',
            background: `linear-gradient(90deg, ${PRESS_WEAK}, ${PRESS_STRONG})`,
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
            font-size:1.3rem; color:#16a34a; letter-spacing:0.1em;
            animation: tut-success 0.4s ease-out both;
        `;
        container.appendChild(el);
    }

    /** tutorialScreen 用の小さめ横顔（本編と同じ描画ロジックを faceDraw.ts で共有） */
    function drawFaceMini(canvas: HTMLCanvasElement, newtonValue: number, color = '#0891b2'): void {
        drawFace(canvas, newtonValue, { color, lineWidth: 4, eyeRadiusRatio: 0.08 });
    }

    // ── Step 1: 強く ───────────────────────────────────────────
    function renderStep1() {
        const { symbol, color, name } = INSTRUCTION_LABEL['strong'];

        const card = makeCard();
        card.appendChild(makeHeading(symbol, color, name));
        card.appendChild(makeDesc('キーを押してください。「弱い」ゾーンを超えればクリアです。'));

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120; faceCanvas.height = 120;
        drawFaceMini(faceCanvas, 0.6, color);

        const gauge = makePressureGauge();

        // 閾値マーカー: 「弱い」との境界（ここ以上でクリア）
        const gaugeWrap = document.createElement('div');
        gaugeWrap.style.cssText = 'position:relative; display:flex; flex-direction:column; align-items:flex-start;';
        gaugeWrap.appendChild(gauge.el);
        const marker = document.createElement('div');
        marker.style.cssText = `
            position:absolute; top:0; bottom:0; left:${LEVEL_LOW * 100}%;
            width:2px; background:${color}; opacity:0.7;
        `;
        gauge.el.appendChild(marker);
        const markerLabel = document.createElement('div');
        markerLabel.textContent = '← ここ以上';
        markerLabel.style.cssText = `font-size:0.7rem; color:${color}; font-family:system-ui,sans-serif;
            position:absolute; top:22px; left:${LEVEL_LOW * 100}%; white-space:nowrap;`;
        gauge.el.style.position = 'relative';
        gauge.el.appendChild(markerLabel);
        gaugeWrap.appendChild(gauge.el);

        card.appendChild(faceCanvas);
        card.appendChild(gaugeWrap);
        contentEl.appendChild(card);

        listenPressure((_code, value) => {
            const t = normalizeN(value);
            gauge.update(t);
            drawFaceMini(faceCanvas, value, color);
            playFormant(value);
            if (pressureLevel(value) !== 'weak') {
                showSuccess(card, '強打を検出！');
                clearPressureListener();
                scheduleAdvance();
            }
        });
    }

    // ── Step 2: 弱く ───────────────────────────────────────────
    function renderStep2() {
        const { symbol, color, name } = INSTRUCTION_LABEL['weak'];

        const card = makeCard();
        card.appendChild(makeHeading(symbol, color, name));
        card.appendChild(makeDesc('キーをそっと押してください。「強い」ゾーンに入らなければクリアです。'));

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120; faceCanvas.height = 120;
        drawFaceMini(faceCanvas, 0.6, color);

        const gauge = makePressureGauge();
        gauge.el.style.position = 'relative';
        // 閾値マーカー: 「強い」との境界（ここ以下でクリア）
        const marker = document.createElement('div');
        marker.style.cssText = `
            position:absolute; top:0; bottom:0; left:${LEVEL_HIGH * 100}%;
            width:2px; background:${color}; opacity:0.7;
        `;
        gauge.el.appendChild(marker);
        const markerLabel = document.createElement('div');
        markerLabel.textContent = 'ここ以下 →';
        markerLabel.style.cssText = `font-size:0.7rem; color:${color}; font-family:system-ui,sans-serif;
            position:absolute; top:22px; right:${(1 - LEVEL_HIGH) * 100}%; white-space:nowrap;`;
        gauge.el.appendChild(markerLabel);

        card.appendChild(faceCanvas);
        card.appendChild(gauge.el);
        contentEl.appendChild(card);

        listenPressure((_code, value) => {
            const t = normalizeN(value);
            gauge.update(t);
            drawFaceMini(faceCanvas, value, color);
            playFormant(value);
            if (pressureLevel(value) !== 'strong') {
                showSuccess(card, '弱打を検出！');
                clearPressureListener();
                scheduleAdvance();
            }
        });
    }

    // ── Step 3: 打鍵圧マークの説明 ─────────────────────────────
    function renderStep3() {
        const strong = INSTRUCTION_LABEL['strong'];
        const weak = INSTRUCTION_LABEL['weak'];

        const card = makeCard();
        const heading = document.createElement('h2');
        heading.textContent = '打鍵圧マーク';
        heading.style.cssText = 'font-size:1.8rem; color:#0891b2; letter-spacing:0.15em; margin:0;';
        card.appendChild(heading);
        card.appendChild(makeDesc('ゲームでは文字の上にマークが付きます。指示どおりの打鍵圧で打つとボーナス点です。'));

        // 2種類のマークの凡例
        const legend = document.createElement('div');
        legend.style.cssText = 'display:flex; gap:3rem; font-family:system-ui,sans-serif;';
        ([
            { m: strong, desc: 'この字を強く打つ' },
            { m: weak,   desc: 'この字を弱く打つ' },
        ] as const).forEach(({ m, desc }) => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:0.3rem;';
            const sym = document.createElement('div');
            sym.textContent = m.symbol;
            sym.style.cssText = `font-size:2.6rem; color:${m.color}; font-weight:bold; line-height:1;`;
            const nm = document.createElement('div');
            nm.textContent = m.name;
            nm.style.cssText = `font-size:1.3rem; color:${m.color};`;
            const ds = document.createElement('div');
            ds.textContent = desc;
            ds.style.cssText = 'font-size:0.9rem; color:#64748b;';
            item.appendChild(sym);
            item.appendChild(nm);
            item.appendChild(ds);
            legend.appendChild(item);
        });
        card.appendChild(legend);

        // ゲームと同じ見た目のフレーズ見本（対象文字の上にマーク）
        const exampleText = 'さくらがさいた';
        const marks: Record<number, 'strong' | 'weak'> = { 0: 'strong', 4: 'weak' };
        const exampleRow = document.createElement('div');
        exampleRow.style.cssText =
            'display:flex; align-items:flex-end; gap:0; padding:0.6rem 1.2rem;' +
            'background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;';
        [...exampleText].forEach((ch, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
            const icon = document.createElement('span');
            const mk = marks[i];
            if (mk) {
                const lbl = INSTRUCTION_LABEL[mk];
                icon.textContent = lbl.symbol;
                icon.style.cssText = `font-size:1.3rem; color:${lbl.color}; font-weight:bold; line-height:1.2;`;
            } else {
                icon.textContent = ' ';
                icon.style.cssText = 'font-size:1.3rem; line-height:1.2;';
            }
            const c = document.createElement('span');
            c.textContent = ch;
            c.style.cssText = 'font-size:2.6rem; color:#1e293b; font-family:system-ui,sans-serif; line-height:1;';
            wrap.appendChild(icon);
            wrap.appendChild(c);
            exampleRow.appendChild(wrap);
        });
        card.appendChild(exampleRow);

        card.appendChild(makeDesc('指定どおりに打てると +50pt。連続で決めるとコンボで倍増します。'));

        // 続行プロンプト（何かキーで開始）
        const prompt = document.createElement('div');
        prompt.textContent = '何かキーを押してゲーム開始';
        prompt.style.cssText = 'font-size:1rem; color:#0891b2; letter-spacing:0.1em; margin-top:0.4rem;';
        card.appendChild(prompt);

        contentEl.appendChild(card);

        function onKey(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
            e.preventDefault();
            document.removeEventListener('keydown', onKey);
            advance();
        }
        document.addEventListener('keydown', onKey);
        stepCleanup = () => document.removeEventListener('keydown', onKey);
    }

    // ── 後片付け ───────────────────────────────────────────────
    function cleanup() {
        clearTimeout(autoAdvanceTimer);
        if (stepCleanup) { stepCleanup(); stepCleanup = null; }
        clearPressureListener();
        clearRawListener();
        meter?.dispose();
        style.remove();
        disposeStage();
    }

    // 教えるステップが無い（通常モード）ならチュートリアルを見せずに次へ
    if (STEPS === 0) {
        cleanup();
        onComplete();
        return;
    }
    setStep(0);
}
