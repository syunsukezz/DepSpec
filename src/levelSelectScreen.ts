import type { Level } from './sentences';
import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { FONT_DISPLAY } from './theme';
import { pressureLevel, type PressureLevel } from './phrases';

export interface LevelSelectOptions {
    /** 'analog' のときだけ打鍵圧での難易度選択を有効にする */
    mode: GameMode;
    setPressureListener: (cb: (code: string, value: number) => void) => void;
    clearPressureListener: () => void;
    setRawListener: (cb: (code: string, value: number) => void) => void;
    clearRawListener: () => void;
    /** レベルを選んでゲームへ */
    onSelect: (level: Level) => void;
    /** 前の画面へ戻る */
    onBack: () => void;
}

// 各レベルの見た目と説明
interface LevelInfo {
    level: Level;
    label: string;
    desc: string;
    example: string;
    color: string;
}

// 配列順は Easy -> Hard（打鍵圧レーンでの弱い〜強いの順とも一致させる）
const LEVELS: LevelInfo[] = [
    { level: 'Easy',   label: 'EASY',   desc: '短い単語',       example: 'いぬ / りんご / まうす',       color: '#22c55e' },
    { level: 'Normal', label: 'NORMAL', desc: '少し長い言葉',   example: 'じゃばすくりぷと / やきにくていしょく', color: '#f59e0b' },
    { level: 'Hard',   label: 'HARD',   desc: '長い文章',     example: 'えーあいをもちいたにそくほこうのろぼっと',  color: '#ef4444' },
];

// 測定した打鍵圧(弱/普通/強) -> 選ぶ難易度
const LEVEL_INDEX_BY_PRESSURE: Record<PressureLevel, number> = { weak: 0, normal: 1, strong: 2 };

// ── レベル確定時のカットイン（通常/アナログ両モード共通） ──────────────
const CUTIN_MS = 900;

function playLevelCutIn(app: HTMLDivElement, info: LevelInfo, onDone: () => void): void {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-cutin-flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
        @keyframes kw-cutin-slide {
            0%   { transform: translateX(-130%) skewX(-8deg); opacity: 0; }
            12%  { opacity: 1; }
            22%  { transform: translateX(0) skewX(-8deg); }
            78%  { transform: translateX(0) skewX(-8deg); opacity: 1; }
            100% { transform: translateX(130%) skewX(-8deg); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '200',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'hidden',
    });

    const flash = document.createElement('div');
    Object.assign(flash.style, {
        position: 'absolute',
        inset: '0',
        background: '#ffffff',
        animation: 'kw-cutin-flash 0.25s ease-out forwards',
    });

    const banner = document.createElement('div');
    Object.assign(banner.style, {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '1.4rem 4rem',
        background: info.color,
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        borderTop: '4px solid rgba(255,255,255,0.8)',
        borderBottom: '4px solid rgba(0,0,0,0.25)',
        animation: `kw-cutin-slide ${CUTIN_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards`,
    });

    const label = document.createElement('div');
    label.textContent = info.label;
    Object.assign(label.style, {
        fontFamily: FONT_DISPLAY,
        fontSize: '4rem',
        letterSpacing: '0.15em',
        color: '#ffffff',
        textShadow: '0 4px 0 rgba(0,0,0,0.25)',
        transform: 'skewX(8deg)', // banner自体の傾きを打ち消して文字は直立に見せる
        whiteSpace: 'nowrap',
    });

    const sub = document.createElement('div');
    sub.textContent = 'けってい！';
    Object.assign(sub.style, {
        fontFamily: FONT_DISPLAY,
        fontSize: '1.1rem',
        letterSpacing: '0.3em',
        color: 'rgba(255,255,255,0.9)',
        transform: 'skewX(8deg)',
    });

    banner.appendChild(label);
    banner.appendChild(sub);
    overlay.appendChild(flash);
    overlay.appendChild(banner);
    app.appendChild(overlay);

    window.setTimeout(() => {
        overlay.remove();
        style.remove();
        onDone();
    }, CUTIN_MS);
}

export function showLevelSelectScreen(app: HTMLDivElement, options: LevelSelectOptions): void {
    if (options.mode === 'analog') {
        showHammerLevelSelect(app, options);
    } else {
        showCardLevelSelect(app, options);
    }
}

// -----------------------------------------------------------------------
// 通常キーボード用: 3枚カードをクリック／矢印+Enterで選ぶ、従来通りのUI
// -----------------------------------------------------------------------
function showCardLevelSelect(app: HTMLDivElement, options: LevelSelectOptions): void {
    const { onSelect, onBack } = options;

    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        gap: '2rem',
    }, { fit: true, designW: 900, designH: 520 });

    const style = document.createElement('style');
    style.textContent = `
        .kw-level-card {
            transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .kw-level-card:hover,
        .kw-level-card.kw-focus {
            transform: translateY(-6px) scale(1.03);
            box-shadow: 0 12px 30px rgba(0,0,0,0.12);
        }
    `;
    document.head.appendChild(style);

    const heading = document.createElement('h2');
    heading.textContent = 'レベルをえらぶ';
    Object.assign(heading.style, {
        fontSize: '2rem',
        letterSpacing: '0.15em',
        color: '#0891b2',
        margin: '0',
        userSelect: 'none',
    });

    const cardRow = document.createElement('div');
    Object.assign(cardRow.style, {
        display: 'flex',
        flexDirection: 'row',
        gap: '1.5rem',
        alignItems: 'stretch',
    });

    let busy = false;
    const cards: HTMLDivElement[] = [];

    function confirmLevel(index: number): void {
        if (busy) return;
        busy = true;
        playLevelCutIn(app, LEVELS[index], () => {
            cleanup();
            onSelect(LEVELS[index].level);
        });
    }

    LEVELS.forEach(({ label, desc, example, color }, index) => {
        const card = document.createElement('div');
        card.className = 'kw-level-card';
        Object.assign(card.style, {
            width: '230px',
            padding: '1.8rem 1.4rem',
            background: '#ffffff',
            border: `2px solid ${color}`,
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.9rem',
            cursor: 'pointer',
            userSelect: 'none',
        });

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = `font-size:1.8rem; letter-spacing:0.12em; color:${color};`;

        const descEl = document.createElement('div');
        descEl.textContent = desc;
        descEl.style.cssText = 'font-size:1.05rem; color:#334155; font-family:system-ui,sans-serif;';

        const exEl = document.createElement('div');
        exEl.textContent = example;
        exEl.style.cssText = 'font-size:0.8rem; color:#94a3b8; font-family:system-ui,sans-serif; line-height:1.5;';

        card.appendChild(labelEl);
        card.appendChild(descEl);
        card.appendChild(exEl);

        card.addEventListener('mouseenter', () => applyFocus(index));
        card.addEventListener('click', () => confirmLevel(index));

        cards.push(card);
        cardRow.appendChild(card);
    });

    let focusIndex = 0;
    function applyFocus(i: number): void {
        focusIndex = (i + cards.length) % cards.length;
        cards.forEach((c, idx) => {
            if (idx === focusIndex) {
                c.classList.add('kw-focus');
                c.style.outline = `3px solid ${LEVELS[idx].color}`;
                c.style.outlineOffset = '4px';
            } else {
                c.classList.remove('kw-focus');
                c.style.outline = 'none';
            }
        });
    }

    const backBtn = document.createElement('button');
    backBtn.textContent = '← もどる';
    Object.assign(backBtn.style, {
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontFamily: FONT_DISPLAY,
        fontSize: '0.85rem',
        cursor: 'pointer',
    });
    backBtn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        cleanup();
        onBack();
    });

    const hint = document.createElement('p');
    hint.textContent = 'Space / Tab で選択・Enter で決定';
    Object.assign(hint.style, {
        fontSize: '0.85rem',
        color: '#94a3b8',
        letterSpacing: '0.08em',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
        textAlign: 'center',
    });

    stage.appendChild(heading);
    stage.appendChild(cardRow);
    stage.appendChild(hint);
    app.appendChild(backBtn);

    const keyHandler = (e: KeyboardEvent) => {
        if (busy) return;
        switch (e.key) {
            case 'Tab':
            case ' ':
                e.preventDefault();
                applyFocus(focusIndex + (e.shiftKey ? -1 : 1));
                break;
            case 'ArrowRight':
                e.preventDefault();
                applyFocus(focusIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                applyFocus(focusIndex - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                applyFocus(focusIndex - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                applyFocus(focusIndex + 1);
                break;
            case 'Enter':
                e.preventDefault();
                confirmLevel(focusIndex);
                break;
        }
    };
    document.addEventListener('keydown', keyHandler);

    applyFocus(0); // 初期フォーカスは EASY

    function cleanup(): void {
        document.removeEventListener('keydown', keyHandler);
        backBtn.remove();
        disposeStage();
    }
}

// -----------------------------------------------------------------------
// アナログキーボード用: ハンマー打撃力測定機風。スペースキーの打鍵圧だけで
// 難易度を決める。1打鍵ごとに5秒の自動開始カウントダウンをリセットする。
// -----------------------------------------------------------------------
const HOLD_MS = 5000;
const HIT_FLASH_MS = 400;
const SEGMENTS_PER_BAND = 6;

function showHammerLevelSelect(app: HTMLDivElement, options: LevelSelectOptions): void {
    const { setPressureListener, clearPressureListener, clearRawListener, onSelect, onBack } = options;

    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        gap: '1.4rem',
    }, { fit: true, designW: 900, designH: 560 });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-keycap-hit {
            0%   { transform: translateY(0); }
            30%  { transform: translateY(6px); }
            100% { transform: translateY(0); }
        }
        .kw-keycap.kw-hit { animation: kw-keycap-hit 0.18s ease-out; }
        @keyframes kw-band-glow {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.35); }
        }
        .kw-band-label.kw-active { animation: kw-band-glow 0.6s ease-in-out infinite; }
    `;
    document.head.appendChild(style);

    const heading = document.createElement('h2');
    heading.textContent = 'レベルをえらぶ';
    Object.assign(heading.style, {
        fontSize: '2rem',
        letterSpacing: '0.15em',
        color: '#0891b2',
        margin: '0',
        userSelect: 'none',
    });

    const hint = document.createElement('p');
    hint.textContent = 'スペースキーを打った強さで難易度が決まります';
    Object.assign(hint.style, {
        fontSize: '0.85rem',
        color: '#94a3b8',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
    });

    // ── タワー本体: 上からHard/Normal/Easyの3バンド ────────────────
    const towerRow = document.createElement('div');
    Object.assign(towerRow.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: '1rem',
        height: '260px',
    });

    const tower = document.createElement('div');
    Object.assign(tower.style, {
        display: 'flex',
        flexDirection: 'column',
        width: '90px',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'rgba(15,23,42,0.05)',
        padding: '4px',
        gap: '4px',
    });

    const labelCol = document.createElement('div');
    Object.assign(labelCol.style, {
        display: 'flex',
        flexDirection: 'column',
    });

    // 添字は LEVELS 基準(0=Easy, 1=Normal, 2=Hard)。上から Hard->Easy の順に組み立てる。
    const bandSegments: HTMLDivElement[][] = [[], [], []];
    const bandLabels: HTMLDivElement[] = [];

    for (let levelIdx = 2; levelIdx >= 0; levelIdx--) {
        const info = LEVELS[levelIdx];

        const bandWrap = document.createElement('div');
        Object.assign(bandWrap.style, { display: 'flex', flexDirection: 'column', flex: '1', gap: '2px' });
        for (let s = 0; s < SEGMENTS_PER_BAND; s++) {
            const seg = document.createElement('div');
            Object.assign(seg.style, {
                flex: '1',
                borderRadius: '2px',
                background: '#e2e8f0',
                transition: 'background 0.15s ease',
            });
            bandSegments[levelIdx].push(seg);
            bandWrap.appendChild(seg);
        }
        tower.appendChild(bandWrap);

        const label = document.createElement('div');
        label.className = 'kw-band-label';
        label.textContent = info.label;
        Object.assign(label.style, {
            flex: '1',
            display: 'flex',
            alignItems: 'center',
            fontSize: '1.1rem',
            letterSpacing: '0.1em',
            color: '#cbd5e1',
            transition: 'color 0.15s ease, transform 0.15s ease',
        });
        bandLabels[levelIdx] = label;
        labelCol.appendChild(label);
    }

    towerRow.appendChild(tower);
    towerRow.appendChild(labelCol);

    // ── キーキャップ(正面から見たスペースキー) ─────────────────────
    const keycap = document.createElement('div');
    keycap.className = 'kw-keycap';
    Object.assign(keycap.style, {
        width: '260px',
        height: '64px',
        borderRadius: '10px',
        background: 'linear-gradient(to bottom, #f1f5f9, #cbd5e1)',
        boxShadow: '0 6px 0 #94a3b8, inset 0 2px 0 rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    });
    const keycapLabel = document.createElement('div');
    keycapLabel.textContent = 'SPACE';
    Object.assign(keycapLabel.style, {
        fontSize: '1.3rem',
        letterSpacing: '0.15em',
        color: '#334155',
        fontWeight: '700',
    });
    keycap.appendChild(keycapLabel);

    // ── カウントダウンバー ──────────────────────────────────────
    const countdownWrap = document.createElement('div');
    Object.assign(countdownWrap.style, {
        width: '420px',
        height: '10px',
        background: '#e2e8f0',
        borderRadius: '5px',
        overflow: 'hidden',
        opacity: '0',
        transition: 'opacity 0.2s',
    });
    const countdownFill = document.createElement('div');
    Object.assign(countdownFill.style, {
        height: '100%',
        width: '100%',
        background: '#0891b2',
        borderRadius: '5px',
    });
    countdownWrap.appendChild(countdownFill);

    const backBtn = document.createElement('button');
    backBtn.textContent = '← もどる';
    Object.assign(backBtn.style, {
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontFamily: FONT_DISPLAY,
        fontSize: '0.85rem',
        cursor: 'pointer',
    });

    stage.appendChild(heading);
    stage.appendChild(towerRow);
    stage.appendChild(keycap);
    stage.appendChild(countdownWrap);
    stage.appendChild(hint);
    app.appendChild(backBtn);

    // ── 状態 ──────────────────────────────────────────────────
    let currentLevelIndex = -1; // 未確定(まだ一度も打鍵していない)
    let busy = false;
    let rafId: number | null = null;
    let hitFlashTimer: number | null = null;

    function applyLevel(index: number): void {
        currentLevelIndex = index;
        for (let i = 0; i < LEVELS.length; i++) {
            const lit = i <= index;
            bandSegments[i].forEach((seg) => { seg.style.background = lit ? LEVELS[i].color : '#e2e8f0'; });
            bandLabels[i].style.color = lit ? LEVELS[i].color : '#cbd5e1';
            bandLabels[i].style.transform = i === index ? 'scale(1.15)' : 'scale(1)';
            bandLabels[i].classList.toggle('kw-active', i === index);
        }
    }

    function flashHit(): void {
        keycapLabel.textContent = 'HIT!!!';
        keycap.classList.remove('kw-hit');
        void keycap.offsetWidth; // アニメーション再トリガーのためのreflow
        keycap.classList.add('kw-hit');
        if (hitFlashTimer !== null) window.clearTimeout(hitFlashTimer);
        hitFlashTimer = window.setTimeout(() => { keycapLabel.textContent = 'SPACE'; }, HIT_FLASH_MS);
    }

    function confirm(): void {
        if (busy || currentLevelIndex < 0) return;
        busy = true;
        playLevelCutIn(app, LEVELS[currentLevelIndex], () => {
            cleanup();
            onSelect(LEVELS[currentLevelIndex].level);
        });
    }

    function startCountdown(): void {
        countdownWrap.style.opacity = '1';
        if (rafId !== null) cancelAnimationFrame(rafId);
        const start = performance.now();
        const tick = (now: number) => {
            const remain = Math.max(0, HOLD_MS - (now - start));
            countdownFill.style.width = `${(remain / HOLD_MS) * 100}%`;
            countdownFill.style.background = LEVELS[currentLevelIndex].color;
            if (remain <= 0) { rafId = null; confirm(); return; }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
    }

    function cleanup(): void {
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (hitFlashTimer !== null) window.clearTimeout(hitFlashTimer);
        backBtn.remove();
        clearPressureListener();
        clearRawListener();
        disposeStage();
    }

    backBtn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        cleanup();
        onBack();
    });

    setPressureListener((code: string, value: number) => {
        if (busy || code !== 'Space') return;
        const index = LEVEL_INDEX_BY_PRESSURE[pressureLevel(value)];
        applyLevel(index);
        flashHit();
        startCountdown();
    });
}
