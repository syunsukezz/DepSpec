import type { GameMode } from './gameScreen';
import { createStage } from './stage';

export interface StartOptions {
    /** アナログキーボードに接続（必要ならダイアログ）。接続できたら true */
    connectAnalog: () => Promise<boolean>;
    /** 既に許可済みのアナログデバイスがあるか */
    hasAuthorizedDevice: () => Promise<boolean>;
    /** モードを選んでゲーム開始 */
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
        fontFamily: "'Audiowide', sans-serif",
        gap: '2rem',
    }, { fit: true, designW: 900, designH: 680 });

    // アニメーション用スタイル
    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-glow {
            0%, 100% { text-shadow: 0 0 20px #0891b244, 0 0 40px #0891b222; }
            50%       { text-shadow: 0 0 40px #0891b288, 0 0 80px #0891b244; }
        }
        .kw-mode-btn:hover:not(:disabled) {
            background: rgba(8, 145, 178, 0.08) !important;
        }
        .kw-normal-btn:hover:not(:disabled) {
            background: rgba(0, 0, 0, 0.05) !important;
        }
        .kw-fs-btn:hover {
            background: rgba(0,0,0,0.05) !important;
        }
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
    });

    // モード説明
    const lead = document.createElement('p');
    lead.textContent = 'キーボードを選んで start';
    Object.assign(lead.style, {
        fontSize: '1rem',
        color: '#475569',
        letterSpacing: '0.15em',
        margin: '0',
    });

    // ボタン置き場
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
        display: 'flex',
        gap: '1.2rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
    });

    const baseBtn = {
        padding: '1rem 1.8rem',
        fontFamily: "'Audiowide', sans-serif",
        fontSize: '0.95rem',
        cursor: 'pointer',
        borderRadius: '10px',
        transition: 'background 0.2s, opacity 0.2s',
        minWidth: '230px',
        lineHeight: '1.5',
    };

    // アナログキーボードで遊ぶ
    const analogBtn = document.createElement('button');
    analogBtn.className = 'kw-mode-btn';
    analogBtn.innerHTML = '▲ アナログキーボードで遊ぶ<br><small style="opacity:0.7">打鍵圧で強弱・音・可視化あり</small>';
    Object.assign(analogBtn.style, {
        ...baseBtn,
        background: 'transparent',
        border: '2px solid #0891b2',
        color: '#0891b2',
    });

    // 通常キーボードで遊ぶ
    const normalBtn = document.createElement('button');
    normalBtn.className = 'kw-normal-btn';
    normalBtn.innerHTML = '通常キーボードで遊ぶ<br><small style="opacity:0.7">速度と正確性のタイピング</small>';
    Object.assign(normalBtn.style, {
        ...baseBtn,
        background: 'transparent',
        border: '2px solid #cbd5e1',
        color: '#64748b',
    });

    btnRow.appendChild(analogBtn);
    btnRow.appendChild(normalBtn);

    // ステータス行（接続結果メッセージ）
    const statusEl = document.createElement('p');
    Object.assign(statusEl.style, {
        fontSize: '0.85rem',
        color: '#94a3b8',
        minHeight: '1.2em',
        margin: '0',
        fontFamily: 'system-ui, sans-serif',
    });

    // フルスクリーンボタン（右上固定）
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
        fontFamily: "'Audiowide', sans-serif",
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
    stage.appendChild(lead);
    stage.appendChild(btnRow);
    stage.appendChild(statusEl);
    // フルスクリーンボタンはビューポート右上に固定したいのでステージ外(app)へ
    app.appendChild(fsBtn);

    // 画面離脱時にドキュメントレベルのリスナーを外す
    function cleanup() {
        document.removeEventListener('keydown', keyHandler);
        document.removeEventListener('fullscreenchange', updateFsLabel);
        disposeStage();
    }

    // ── アナログモード開始 ──────────────────────────────
    let connecting = false;
    async function startAnalog() {
        if (connecting) return;
        connecting = true;
        analogBtn.disabled = true;
        normalBtn.disabled = true;
        statusEl.style.color = '#94a3b8';
        statusEl.textContent = 'アナログキーボードに接続中…';
        const ok = await connectAnalog();
        if (ok) {
            cleanup();
            onStart('analog');
        } else {
            connecting = false;
            analogBtn.disabled = false;
            normalBtn.disabled = false;
            statusEl.style.color = '#dc2626';
            statusEl.textContent = 'アナログキーボードに接続できませんでした。通常キーボードでも遊べます。';
        }
    }
    analogBtn.addEventListener('click', startAnalog);

    // ── 通常モード開始 ──────────────────────────────────
    normalBtn.addEventListener('click', () => {
        cleanup();
        onStart('normal');
    });

    // F11 でフルスクリーン切替（キー入力ではゲーム開始しない＝モードは明示選択）
    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); toggleFs(); }
    };
    document.addEventListener('keydown', keyHandler);

    // 既に許可済みデバイスがあれば案内を出す
    hasAuthorizedDevice().then((has) => {
        if (has) {
            statusEl.style.color = '#16a34a';
            statusEl.textContent = 'アナログキーボードを検出済み。そのまま「アナログキーボードで遊ぶ」を選べます。';
        }
    });
}
