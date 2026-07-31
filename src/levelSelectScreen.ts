import type { Level } from './sentences';
import { createStage } from './stage';
import { FONT_DISPLAY } from './theme';

export interface LevelSelectOptions {
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

const LEVELS: LevelInfo[] = [
    { level: 'Easy',   label: 'EASY',   desc: '短い単語',       example: 'いぬ / りんご / まうす',       color: '#22c55e' },
    { level: 'Normal', label: 'NORMAL', desc: '少し長い言葉',   example: 'じゃばすくりぷと / やきにくていしょく', color: '#f59e0b' },
    { level: 'Hard',   label: 'HARD',   desc: '長い文章',     example: 'えーあいをもちいたにそくほこうのろぼっと',  color: '#ef4444' },
];

export function showLevelSelectScreen(app: HTMLDivElement, options: LevelSelectOptions): void {
    const { onSelect, onBack } = options;

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

    // カード横並び
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
        cleanup();
        onSelect(LEVELS[index].level);
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

    // ── フォーカス（キーボード選択）─────────────────────────────
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
    hint.textContent = 'Space / Tab で選択・Enter で決定';
    Object.assign(hint.style, {
        fontSize: '0.85rem',
        color: '#94a3b8',
        letterSpacing: '0.08em',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
    });

    stage.appendChild(heading);
    stage.appendChild(cardRow);
    stage.appendChild(hint);
    app.appendChild(backBtn);

    // ── キーボード操作: Space/Tab で移動・Enter で確定 ─────────────
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
            case 'Enter':
                e.preventDefault();
                confirmLevel(focusIndex);
                break;
        }
    };
    document.addEventListener('keydown', keyHandler);

    applyFocus(0); // 初期フォーカスは EASY

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        backBtn.remove();
        disposeStage();
    }
}
