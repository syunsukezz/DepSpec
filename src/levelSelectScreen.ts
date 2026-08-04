import type { Level } from './sentences';
import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { FONT_DISPLAY, PRESS_WEAK, PRESS_NORMAL, PRESS_STRONG } from './theme';
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

// 配列順は Easy -> Hard。打鍵圧レーンでは弱い(下)〜強い(上)に対応させるため、
// アナログモード時はこの配列順のまま column-reverse で並べる(index0=Easy が下、index2=Hard が上)。
const LEVELS: LevelInfo[] = [
    { level: 'Easy',   label: 'EASY',   desc: '短い単語',       example: 'いぬ / りんご / まうす',       color: '#22c55e' },
    { level: 'Normal', label: 'NORMAL', desc: '少し長い言葉',   example: 'じゃばすくりぷと / やきにくていしょく', color: '#f59e0b' },
    { level: 'Hard',   label: 'HARD',   desc: '長い文章',     example: 'えーあいをもちいたにそくほこうのろぼっと',  color: '#ef4444' },
];

// 測定した打鍵圧(弱/普通/強) -> 選ぶ難易度
const LEVEL_INDEX_BY_PRESSURE: Record<PressureLevel, number> = { weak: 0, normal: 1, strong: 2 };

export function showLevelSelectScreen(app: HTMLDivElement, options: LevelSelectOptions): void {
    const { mode, setPressureListener, clearPressureListener, setRawListener, clearRawListener, onSelect, onBack } = options;
    const isAnalog = mode === 'analog';

    // タイトル画面と同じく割合固定の等倍スケール（fit）
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
        .kw-level-card.kw-hit {
            animation: kw-level-hit 0.3s ease-out;
        }
        @keyframes kw-level-hit {
            0%   { transform: scale(1.1); box-shadow: 0 16px 36px rgba(0,0,0,0.18); }
            100% { transform: scale(1); box-shadow: none; }
        }
    `;
    document.head.appendChild(style);

    // 見出し
    const heading = document.createElement('h2');
    heading.textContent = 'レベルをえらぶ';
    Object.assign(heading.style, {
        fontSize: '2rem',
        letterSpacing: '0.15em',
        color: '#0891b2',
        margin: '0',
        userSelect: 'none',
    });

    // カード群。アナログモードは縦積み(強い/弱いのレーンに揃える)、通常は横並び。
    const cardRow = document.createElement('div');
    Object.assign(cardRow.style, {
        display: 'flex',
        flexDirection: isAnalog ? 'column-reverse' : 'row',
        gap: isAnalog ? '1rem' : '1.5rem',
        alignItems: 'stretch',
    });

    let busy = false;
    const cards: HTMLDivElement[] = [];

    function confirmLevel(index: number): void {
        if (busy) return;
        busy = true;
        cleanup();
        onSelect(LEVELS[index].level);
    }

    LEVELS.forEach(({ label, desc, example, color }, index) => {
        const card = document.createElement('div');
        card.className = 'kw-level-card';
        Object.assign(card.style, {
            width: isAnalog ? '420px' : '230px',
            padding: isAnalog ? '1rem 1.4rem' : '1.8rem 1.4rem',
            background: '#ffffff',
            border: `2px solid ${color}`,
            borderRadius: '16px',
            display: 'flex',
            flexDirection: isAnalog ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: isAnalog ? 'flex-start' : 'center',
            gap: isAnalog ? '1.2rem' : '0.9rem',
            cursor: 'pointer',
            userSelect: 'none',
        });

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = `font-size:1.8rem; letter-spacing:0.12em; color:${color}; flex-shrink:0;`;

        const descEl = document.createElement('div');
        descEl.textContent = desc;
        descEl.style.cssText = 'font-size:1.05rem; color:#334155; font-family:system-ui,sans-serif;';

        const exEl = document.createElement('div');
        exEl.textContent = example;
        exEl.style.cssText = 'font-size:0.8rem; color:#94a3b8; font-family:system-ui,sans-serif; line-height:1.5;';

        card.appendChild(labelEl);
        card.appendChild(descEl);
        if (!isAnalog) card.appendChild(exEl);

        card.addEventListener('mouseenter', () => applyFocus(index));
        card.addEventListener('click', () => confirmLevel(index));

        cards.push(card);
        cardRow.appendChild(card);
    });

    // ── フォーカス（キーボード選択・打鍵圧プレビュー共通）──────────
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

    // ── 打鍵圧レーン（アナログモードのみ）: 青(弱)→緑(普通)→赤(強)の縦グラデーション ──
    let pressureLane: HTMLDivElement | null = null;
    let laneMarker: HTMLDivElement | null = null;
    if (isAnalog) {
        pressureLane = document.createElement('div');
        Object.assign(pressureLane.style, {
            position: 'relative',
            width: '36px',
            alignSelf: 'stretch',
            borderRadius: '18px',
            background: `linear-gradient(to top, ${PRESS_WEAK}, ${PRESS_NORMAL}, ${PRESS_STRONG})`,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            flexShrink: '0',
        });

        laneMarker = document.createElement('div');
        Object.assign(laneMarker.style, {
            position: 'absolute',
            left: '-6px',
            right: '-6px',
            bottom: '0%',
            height: '6px',
            borderRadius: '3px',
            background: '#0f172a',
            boxShadow: '0 0 0 2px #ffffff',
            transition: 'bottom 0.05s linear',
        });
        pressureLane.appendChild(laneMarker);
    }

    // 戻るボタン
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

    // 操作ヒント
    const hint = document.createElement('p');
    hint.textContent = isAnalog
        ? 'キーを打った強さで難易度を選び、Enter で決定（弱く=EASY・強く=HARD／打ち直して選び直せます）'
        : 'Space / Tab で選択・Enter で決定';
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
    if (isAnalog && pressureLane) {
        const layoutRow = document.createElement('div');
        Object.assign(layoutRow.style, {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: '1.5rem',
        });
        layoutRow.appendChild(cardRow);
        layoutRow.appendChild(pressureLane);
        stage.appendChild(layoutRow);
    } else {
        stage.appendChild(cardRow);
    }
    stage.appendChild(hint);
    app.appendChild(backBtn);

    // ── キーボード操作: Space/Tab/矢印 で移動・Enter で確定 ─────────
    // アナログの縦レーンは index0(Easy)=下, index2(Hard)=上 なので ↑で index+1, ↓で index-1。
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
                applyFocus(focusIndex + (isAnalog ? 1 : -1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                applyFocus(focusIndex + (isAnalog ? -1 : 1));
                break;
            case 'Enter':
                e.preventDefault();
                confirmLevel(focusIndex);
                break;
        }
    };
    document.addEventListener('keydown', keyHandler);

    applyFocus(0); // 初期フォーカスは EASY

    // ── 打鍵圧による難易度選択（アナログモードのみ）──────────────
    if (isAnalog && pressureLane && laneMarker) {
        setRawListener((_code: string, value: number) => {
            const t = Math.min(1, Math.max(0, value));
            laneMarker!.style.bottom = `${t * 100}%`;
        });

        setPressureListener((_code: string, value: number) => {
            if (busy) return;
            // 打鍵圧はプレビュー(フォーカス移動)のみ。確定は Enter(または既存のクリック)で行う。
            // 何度でも打ち直して選び直せるようにする。
            const index = LEVEL_INDEX_BY_PRESSURE[pressureLevel(value)];
            applyFocus(index);
            const card = cards[index];
            card.classList.remove('kw-hit');
            void card.offsetWidth; // アニメーションを再トリガーするための reflow
            card.classList.add('kw-hit');
        });
    }

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        backBtn.remove();
        if (isAnalog) {
            clearPressureListener();
            clearRawListener();
        }
        disposeStage();
    }
}
