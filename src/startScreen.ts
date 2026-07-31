import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { FONT_DISPLAY } from './theme';

export interface StartOptions {
    /** アナログキーボードに接続（必要ならダイアログ）。接続できたら true */
    connectAnalog: () => Promise<boolean>;
    /** 既に許可済みのアナログデバイスがあるか */
    hasAuthorizedDevice: () => Promise<boolean>;
    /** キーボード選択画面へ（アナログが使える場合） */
    onSelect: () => void;
    /** モードを指定してゲームへ直行（通常モードへのスキップに使う） */
    onStart: (mode: GameMode) => void;
}

export function showStartScreen(app: HTMLDivElement, options: StartOptions): void {
    const { connectAnalog, hasAuthorizedDevice, onSelect, onStart } = options;

    // タイトル画面は割合を一定に保ちたいので等倍スケール（fit）
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        gap: '2rem',
    }, { fit: true, designW: 900, designH: 680 });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-glow {
            0%, 100% { text-shadow: 0 0 20px #0891b244, 0 0 40px #0891b222; }
            50%       { text-shadow: 0 0 40px #0891b288, 0 0 80px #0891b244; }
        }
        @keyframes kw-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        .kw-connect-btn:hover:not(:disabled) { background: rgba(8,145,178,0.08) !important; }
        .kw-fs-btn:hover { background: rgba(0,0,0,0.05) !important; }
    `;
    document.head.appendChild(style);

    // タイトル
    const title = document.createElement('h1');
    title.textContent = 'keywave';
    Object.assign(title.style, {
        fontSize: '5rem',
        letterSpacing: '0.3em',
        color: '#0891b2',
        animation: 'kw-glow 3s ease-in-out infinite',
        userSelect: 'none',
        margin: '0',
    });

    // 「Press any key」案内
    const pressAny = document.createElement('p');
    pressAny.textContent = 'Press any key to start';
    Object.assign(pressAny.style, {
        fontSize: '1.1rem',
        color: '#475569',
        letterSpacing: '0.15em',
        margin: '0',
        animation: 'kw-pulse 2s ease-in-out infinite',
    });

    // アナログキーボード接続ボタン（初回接続用）
    const connectBtn = document.createElement('button');
    connectBtn.className = 'kw-connect-btn';
    connectBtn.textContent = 'アナログキーボードを接続';
    Object.assign(connectBtn.style, {
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        padding: '0.6rem 1.4rem',
        background: 'transparent',
        border: 'none',
        color: '#0891b2',
        fontFamily: FONT_DISPLAY,
        fontSize: '0.85rem',
        cursor: 'pointer',
        borderRadius: '8px',
        transition: 'background 0.2s, opacity 0.2s',
    });

    // フルスクリーンボタン（ビューポート右上固定）
    const fsBtn = document.createElement('button');
    fsBtn.className = 'kw-fs-btn';
    fsBtn.title = 'フルスクリーン (F11)';
    const updateFsLabel = () => {
        fsBtn.textContent = document.fullscreenElement ? '⛶ Exit' : '⛶ Fullscreen';
    };
    updateFsLabel();
    Object.assign(fsBtn.style, {
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        padding: '0.4rem 0.9rem',
        background: 'transparent',
        border: '1px solid #cbd5e1',
        color: '#64748b',
        fontFamily: FONT_DISPLAY,
        fontSize: '0.75rem',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background 0.2s',
    });
    const toggleFs = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };
    fsBtn.addEventListener('click', toggleFs);
    document.addEventListener('fullscreenchange', updateFsLabel);

    stage.appendChild(title);
    stage.appendChild(pressAny);
    app.appendChild(connectBtn);
    app.appendChild(fsBtn);

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        document.removeEventListener('fullscreenchange', updateFsLabel);
        disposeStage();
    }

    // ── start（何かキー）: アナログ検出なら選択画面、なければ通常モードへ ──
    let proceeding = false;
    async function proceed() {
        if (proceeding) return;
        proceeding = true;
        const has = await hasAuthorizedDevice();
        cleanup();
        if (has) onSelect();
        else onStart('normal');
    }

    // ── アナログ接続（初回）: 成功したら選択画面へ ──
    let connecting = false;
    async function connect() {
        if (connecting || proceeding) return;
        connecting = true;
        connectBtn.disabled = true;
        
        const ok = await connectAnalog();
        if (ok) {
            cleanup();
            onSelect();
        } else {
            connecting = false;
            connectBtn.disabled = false;
            connectBtn.style.display = 'block';
        }
    }
    connectBtn.addEventListener('click', connect);

    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); toggleFs(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        proceed();
    };
    document.addEventListener('keydown', keyHandler);

    // 既に許可済みデバイスがあれば案内を更新
    hasAuthorizedDevice().then((has) => {
        if (has) {
            connectBtn.style.display = 'none';
            connectBtn.textContent = '接続済み';
            connectBtn.disabled = true;
        }
        else {
            connectBtn.style.display = 'block';
            connectBtn.textContent = 'アナログキーボードを接続';
            connectBtn.disabled = false;
        }
    });
}
