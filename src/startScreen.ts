import type { GameMode } from './gameScreen';
import { createStage } from './stage';
import { FONT_DISPLAY } from './theme';
import { pressureLevel, type PressureLevel } from './phrases';
import { appendStyledName, type NameChar } from './playerName';

export interface StartOptions {
    /** アナログキーボードに接続（必要ならダイアログ）。接続できたら true */
    connectAnalog: () => Promise<boolean>;
    /** 既に許可済みのアナログデバイスがあるか */
    hasAuthorizedDevice: () => Promise<boolean>;
    setPressureListener: (cb: (code: string, value: number) => void) => void;
    clearPressureListener: () => void;
    setRawListener: (cb: (code: string, value: number) => void) => void;
    clearRawListener: () => void;
    /** 名前(文字ごとに打鍵圧を持つ)を入力してEnterでゲームへ */
    onStart: (mode: GameMode, name: NameChar[]) => void;
}

const MAX_NAME_LENGTH = 12;

export function showStartScreen(app: HTMLDivElement, options: StartOptions): void {
    const {
        connectAnalog, hasAuthorizedDevice,
        setPressureListener, clearPressureListener, setRawListener, clearRawListener,
        onStart,
    } = options;

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
        @keyframes kw-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
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
        margin: '0 0 0.5rem 0',
    });

    // ── 名前表示エリア（打鍵圧に応じてフォントが変わる） ─────────────────
    const nameDisplay = document.createElement('div');
    Object.assign(nameDisplay.style, {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        minHeight: '3.2rem',
        fontSize: '2.4rem',
        color: '#334155',
        userSelect: 'none',
    });

    const placeholder = document.createElement('span');
    placeholder.textContent = 'Type your name...';
    Object.assign(placeholder.style, {
        fontSize: '1.3rem',
        color: '#cbd5e1',
        fontFamily: 'system-ui, sans-serif',
    });

    const cursor = document.createElement('span');
    cursor.textContent = '|';
    Object.assign(cursor.style, {
        animation: 'kw-blink 1s step-end infinite',
        color: '#0891b2',
        marginLeft: '0.1rem',
    });

    // 「Enterで開始」案内
    const hint = document.createElement('p');
    hint.textContent = 'Type your name to start';
    Object.assign(hint.style, {
        fontSize: '1rem',
        color: '#475569',
        letterSpacing: '0.1em',
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
    stage.appendChild(nameDisplay);
    stage.appendChild(hint);
    stage.appendChild(statusEl);
    stage.appendChild(normalLink);
    app.appendChild(connectBtn);
    app.appendChild(fsBtn);

    // ── 名前の状態と描画 ──────────────────────────────────────────────
    const chars: NameChar[] = [];
    let usingAnalog = false;
    let submitted = false;

    function renderName(): void {
        nameDisplay.innerHTML = '';
        if (chars.length === 0) {
            nameDisplay.appendChild(placeholder);
        } else {
            appendStyledName(nameDisplay, chars);
        }
        nameDisplay.appendChild(cursor);
    }
    renderName();

    function appendChar(ch: string, level: PressureLevel): void {
        if (submitted || chars.length >= MAX_NAME_LENGTH) return;
        chars.push({ ch, level });
        renderName();
    }
    function deleteChar(): void {
        if (submitted || chars.length === 0) return;
        chars.pop();
        renderName();
    }
    function submit(): void {
        if (submitted || chars.length === 0) return;
        submitted = true;
        const mode: GameMode = usingAnalog ? 'analog' : 'normal';
        cleanup();
        onStart(mode, [...chars]);
    }

    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        document.removeEventListener('fullscreenchange', updateFsLabel);
        clearPressureListener();
        clearRawListener();
        disposeStage();
    }

    // ── アナログ入力の有効化（許可済みデバイスへの接続 / 手動接続共通） ──
    function activateAnalog(): void {
        usingAnalog = true;
        connectBtn.style.display = 'none';
        statusEl.textContent = 'アナログキーボード接続済み';
        statusEl.style.display = 'block';
        normalLink.style.display = 'block';
        setPressureListener((code: string, value: number) => {
            if (submitted) return;
            if (code === 'Enter') { submit(); return; }
            if (code === 'Backspace') { deleteChar(); return; }
            if (code === 'Space') { appendChar(' ', pressureLevel(value)); return; }
            if (code.length === 1) { appendChar(code.toLowerCase(), pressureLevel(value)); return; }
        });
        setRawListener(() => {}); // アナログ入力中もライブメーター等は今回不要（受け口だけ確保）
    }

    // ── アナログ接続（初回・手動）: 成功したらアナログ入力へ切り替える ──
    let connecting = false;
    async function connect() {
        if (connecting || usingAnalog) return;
        connecting = true;
        connectBtn.disabled = true;
        const ok = await connectAnalog();
        if (ok) {
            activateAnalog();
        } else {
            connecting = false;
            connectBtn.disabled = false;
        }
    }
    connectBtn.addEventListener('click', connect);

    // ── 通常キーボードへの控えめな切り替え ──────────────────────────
    normalLink.addEventListener('click', () => {
        if (submitted) return;
        usingAnalog = false;
        clearPressureListener();
        clearRawListener();
        normalLink.style.display = 'none';
        statusEl.style.display = 'none';
    });

    // ── 通常モード用: ネイティブkeydownで文字を確定する ────────────────
    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); toggleFs(); return; }
        if (usingAnalog) return; // アナログはpressureListener側で確定する
        if (e.target instanceof HTMLButtonElement) return; // ボタンのネイティブ操作と競合させない
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); deleteChar(); return; }
        if (e.key.length === 1) { e.preventDefault(); appendChar(e.key, 'normal'); return; }
    };
    document.addEventListener('keydown', keyHandler);

    // 既に許可済みデバイスがあれば、ダイアログ無しでそのままアナログ入力を有効化する
    hasAuthorizedDevice().then(async (has) => {
        if (submitted) return;
        if (has) {
            const ok = await connectAnalog();
            if (ok && !submitted) activateAnalog();
        }
    });
}
