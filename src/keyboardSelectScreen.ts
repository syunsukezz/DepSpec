import type { GameMode } from './gameScreen';
import { createStage } from './stage';

export interface KeyboardSelectOptions {
    /** アナログ接続（既に許可済みなのでリッスン開始のみ・冪等） */
    connectAnalog: () => Promise<boolean>;
    /** モードを選んでゲームへ */
    onStart: (mode: GameMode) => void;
    /** タイトルへ戻る */
    onBack: () => void;
}

// ホバー中の陣営に応じた画面全体の色
const COLOR = {
    neutral: '#ffffff',
    analog: '#0891b2', // アナログ＝シアン
    normal: '#475569', // 通常＝スレート
};

export function showKeyboardSelectScreen(app: HTMLDivElement, options: KeyboardSelectOptions): void {
    const { connectAnalog, onStart, onBack } = options;

    // 画面全体を左右2分割にするので stage 自体を横並びのフレームにする。
    // 色分割をビューポート全体に広げたいので fill モード（fit の余白が出ない）
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        transition: 'background 0.25s ease',
    });

    // 半分パネルの共通スタイル
    const halfBase: Partial<CSSStyleDeclaration> = {
        flex: '1',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.8rem',
        cursor: 'pointer',
        fontFamily: "'Audiowide', sans-serif",
        textAlign: 'center',
        padding: '0 1.5rem',
        transition: 'color 0.25s ease, transform 0.25s ease',
        userSelect: 'none',
    };

    // 左：アナログ
    const leftHalf = document.createElement('div');
    Object.assign(leftHalf.style, halfBase);
    leftHalf.innerHTML =
        '<div style="font-size:2rem; letter-spacing:0.12em;">▲ アナログキーボード</div>' +
        '<div style="font-size:0.95rem; opacity:0.75; font-family:system-ui,sans-serif;">打鍵圧で強弱・音・可視化あり</div>';

    // 右：通常
    const rightHalf = document.createElement('div');
    Object.assign(rightHalf.style, halfBase);
    rightHalf.innerHTML =
        '<div style="font-size:2rem; letter-spacing:0.12em;">通常キーボード</div>' +
        '<div style="font-size:0.95rem; opacity:0.75; font-family:system-ui,sans-serif;">速度と正確性のタイピング</div>';

    // 中央の仕切り線
    const divider = document.createElement('div');
    Object.assign(divider.style, {
        position: 'absolute',
        left: '50%',
        top: '12%',
        bottom: '12%',
        width: '1px',
        background: 'currentColor',
        opacity: '0.25',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        transition: 'background 0.25s ease',
    });

    // 見出し（上部中央・ホバー判定を邪魔しないよう pointer-events: none）
    const heading = document.createElement('h2');
    heading.textContent = 'キーボードを選ぶ';
    Object.assign(heading.style, {
        position: 'absolute',
        top: '2.5rem',
        left: '0',
        right: '0',
        textAlign: 'center',
        fontSize: '1.6rem',
        letterSpacing: '0.15em',
        margin: '0',
        fontFamily: "'Audiowide', sans-serif",
        pointerEvents: 'none',
        transition: 'color 0.25s ease',
    });

    // ステータス（下部中央・pointer-events: none）
    const statusEl = document.createElement('p');
    Object.assign(statusEl.style, {
        position: 'absolute',
        bottom: '2.5rem',
        left: '0',
        right: '0',
        textAlign: 'center',
        fontSize: '0.85rem',
        minHeight: '1.2em',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
        transition: 'color 0.25s ease',
    });

    // 戻るボタン（左下・クリックできるよう pointer-events は既定のまま）
    const backBtn = document.createElement('button');
    backBtn.textContent = '← タイトルへ';
    Object.assign(backBtn.style, {
        position: 'absolute',
        bottom: '1.5rem',
        left: '1.5rem',
        background: 'transparent',
        border: 'none',
        fontFamily: "'Audiowide', sans-serif",
        fontSize: '0.85rem',
        cursor: 'pointer',
        transition: 'color 0.25s ease',
        zIndex: '2',
    });

    stage.appendChild(leftHalf);
    stage.appendChild(rightHalf);
    stage.appendChild(divider);
    stage.appendChild(heading);
    stage.appendChild(statusEl);
    stage.appendChild(backBtn);

    // ── ホバーに応じて画面全体の色を切り替える ──────────────────────────
    type Side = 'analog' | 'normal' | null;
    function applyColors(hover: Side): void {
        if (hover === 'analog') {

            // 画面全体がシアンに。文字は白抜き。ホバー側を拡大。
            stage.style.background = COLOR.analog;
            heading.style.color = '#ffffff';
            statusEl.style.color = 'rgba(255,255,255,0.85)';
            backBtn.style.color = 'rgba(255,255,255,0.8)';
            leftHalf.style.color = '#ffffff';
            rightHalf.style.color = 'rgba(255,255,255,0.55)';
            leftHalf.style.transform = 'scale(1.18)';
            rightHalf.style.transform = 'scale(0.92)';
        } else if (hover === 'normal') {
            stage.style.background = COLOR.normal;
            heading.style.color = '#ffffff';
            statusEl.style.color = 'rgba(255,255,255,0.85)';
            backBtn.style.color = 'rgba(255,255,255,0.8)';
            leftHalf.style.color = 'rgba(255,255,255,0.55)';
            rightHalf.style.color = '#ffffff';
            leftHalf.style.transform = 'scale(0.92)';
            rightHalf.style.transform = 'scale(1.18)';
        } else {
            // 通常時：白背景・各陣営の色・等倍
            stage.style.background = COLOR.neutral;
            heading.style.color = '#0891b2';
            statusEl.style.color = '#94a3b8';
            backBtn.style.color = '#94a3b8';
            leftHalf.style.color = '#0891b2';
            rightHalf.style.color = '#64748b';
            leftHalf.style.transform = 'scale(1)';
            rightHalf.style.transform = 'scale(1)';
        }
    }
    let busy = false;

    // ── フォーカス（キーボード選択）: 色ハイライトをそのまま流用 ──────────
    let focusSide: 'analog' | 'normal' = 'analog';
    function applyFocus(side: 'analog' | 'normal'): void {
        focusSide = side;
        applyColors(side);
    }

    leftHalf.addEventListener('mouseenter', () => { if (!busy) applyFocus('analog'); });
    rightHalf.addEventListener('mouseenter', () => { if (!busy) applyFocus('normal'); });
    // カーソルが離れても最後に選んでいた側のハイライトは残す（キーボード操作と揃える）
    leftHalf.addEventListener('mouseleave', () => { if (!busy) applyColors(focusSide); });
    rightHalf.addEventListener('mouseleave', () => { if (!busy) applyColors(focusSide); });

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        disposeStage();
    }

    // ── アナログ選択 ──────────────────────────────────────────────────
    async function chooseAnalog(): Promise<void> {
        if (busy) return;
        busy = true;
        applyColors('analog');
        statusEl.style.color = 'rgba(255,255,255,0.85)';
        statusEl.textContent = 'アナログキーボードを準備中…';
        const ok = await connectAnalog();
        if (ok) {
            cleanup();
            onStart('analog');
        } else {
            busy = false;
            applyColors(focusSide);
            statusEl.style.color = '#dc2626';
            statusEl.textContent = 'アナログキーボードを準備できませんでした。通常キーボードでも遊べます。';
        }
    }

    // ── 通常選択 ─────────────────────────────────────────────────────
    function chooseNormal(): void {
        if (busy) return;
        cleanup();
        onStart('normal');
    }

    leftHalf.addEventListener('click', chooseAnalog);
    rightHalf.addEventListener('click', chooseNormal);

    backBtn.addEventListener('click', () => {
        if (busy) return;
        cleanup();
        onBack();
    });

    // ── キーボード操作: Space/Tab で左右移動・Enter で確定 ────────────────
    const keyHandler = (e: KeyboardEvent) => {
        if (busy) return;
        switch (e.key) {
            case 'Tab':
            case ' ':
                e.preventDefault();
                applyFocus(focusSide === 'analog' ? 'normal' : 'analog');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                applyFocus('analog');
                break;
            case 'ArrowRight':
                e.preventDefault();
                applyFocus('normal');
                break;
            case 'Enter':
                e.preventDefault();
                if (focusSide === 'analog') chooseAnalog();
                else chooseNormal();
                break;
        }
    };
    document.addEventListener('keydown', keyHandler);

    // 初期フォーカスと操作ヒント
    applyFocus('analog');
    statusEl.textContent = 'Space / Tab で選択・Enter で決定';
}
