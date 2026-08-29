import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { FONT_DISPLAY } from './theme';

export interface StartOptions {
    /** アナログキーボードに接続（必要ならダイアログ）。接続できたら true */
    connectAnalog: () => Promise<boolean>;
    /** 既に許可済みのアナログデバイスがあるか */
    hasAuthorizedDevice: () => Promise<boolean>;
    /** モードを選んでゲームへ */
    onStart: (mode: GameMode) => void;
}

export function showStartScreen(app: HTMLDivElement, options: StartOptions): void {
    const { connectAnalog, hasAuthorizedDevice, onStart } = options;

    // タイトル画面は割合を一定に保ちたいので等倍スケール（fit）
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        gap: '1rem',
    }, { fit: true, designW: 900, designH: 520 });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-glow {
            0%, 100% { text-shadow: 0 0 20px #0891b244, 0 0 40px #0891b222; }
            50%       { text-shadow: 0 0 40px #0891b288, 0 0 80px #0891b244; }
        }
        @keyframes kw-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        .kw-connect-btn:hover:not(:disabled) { background: rgba(8,145,178,0.08) !important; }
        .kw-fs-btn:hover { background: rgba(0,0,0,0.05) !important; }
        .kw-ghost-link:hover { color: #0891b2 !important; }
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
        margin: '0 0 1rem 0',
    });

    // 「Press any key」案内（主導線。許可済みデバイスがあれば暗黙でアナログ開始）
    const pressAny = document.createElement('p');
    pressAny.textContent = 'Press any key to start';
    Object.assign(pressAny.style, {
        fontSize: '1.1rem',
        color: '#475569',
        letterSpacing: '0.15em',
        margin: '0',
        animation: 'kw-pulse 2s ease-in-out infinite',
    });

    // アナログ接続済みのときだけ出す控えめなステータス文
    const statusEl = document.createElement('p');
    Object.assign(statusEl.style, {
        fontSize: '0.8rem',
        color: '#94a3b8',
        letterSpacing: '0.05em',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
        display: 'none',
    });

    // 「通常キーボードで遊ぶ」控えめな切り替えリンク（アナログ接続済みのときだけ表示）
    const normalLink = document.createElement('button');
    normalLink.className = 'kw-ghost-link';
    normalLink.textContent = '通常キーボードで遊ぶ';
    Object.assign(normalLink.style, {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontFamily: FONT_DISPLAY,
        fontSize: '0.8rem',
        cursor: 'pointer',
        padding: '0.2rem 0.5rem',
        transition: 'color 0.2s',
        display: 'none',
    });

    // アナログキーボード接続ボタン（初回接続用・控えめに左上固定）
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
    stage.appendChild(statusEl);
    stage.appendChild(normalLink);
    app.appendChild(connectBtn);
    app.appendChild(fsBtn);

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        document.removeEventListener('fullscreenchange', updateFsLabel);
        disposeStage();
    }

    // ── start（何かキー）: 許可済みならアナログへ、なければ通常モードへ ──
    let proceeding = false;
    async function proceed() {
        if (proceeding) return;
        proceeding = true;
        const has = await hasAuthorizedDevice();
        if (has) {
            const ok = await connectAnalog(); // 許可済みなのでダイアログなし・即時
            cleanup();
            onStart(ok ? 'analog' : 'normal');
        } else {
            cleanup();
            onStart('normal');
        }
    }

    // ── アナログ接続（初回）: 成功したらそのままアナログモードで開始 ──
    let connecting = false;
    async function connect() {
        if (connecting || proceeding) return;
        connecting = true;
        connectBtn.disabled = true;

        const ok = await connectAnalog();
        if (ok) {
            cleanup();
            onStart('analog');
        } else {
            connecting = false;
            connectBtn.disabled = false;
            connectBtn.style.display = 'block';
        }
    }
    connectBtn.addEventListener('click', connect);

    // ── 通常キーボードへの控えめな切り替え ──────────────────────────
    normalLink.addEventListener('click', () => {
        if (proceeding) return;
        cleanup();
        onStart('normal');
    });

    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); toggleFs(); return; }
        if (e.target instanceof HTMLButtonElement) return; // ボタンのネイティブ操作と競合させない
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        proceed();
    };
    document.addEventListener('keydown', keyHandler);

    // 既に許可済みデバイスがあれば、アナログを主導線にして案内を切り替える
    hasAuthorizedDevice().then((has) => {
        if (has) {
            connectBtn.style.display = 'none';
            statusEl.textContent = 'アナログキーボード接続済み';
            statusEl.style.display = 'block';
            normalLink.style.display = 'block';
        } else {
            connectBtn.style.display = 'block';
            connectBtn.textContent = 'アナログキーボードを接続';
            connectBtn.disabled = false;
        }
    });
}
