export function showStartScreen(
    app: HTMLDivElement,
    onConnectButton: (btn: HTMLButtonElement) => void,
    onStart: () => void,
): void {
    app.innerHTML = '';
    app.removeAttribute('style');
    Object.assign(app.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0f',
        color: 'white',
        fontFamily: "'Audiowide', sans-serif",
        gap: '2rem',
    });

    // アニメーション用スタイル
    const style = document.createElement('style');
    style.textContent = `
        @keyframes kw-pulse {
            0%, 100% { opacity: 0.3; }
            50%       { opacity: 1; }
        }
        @keyframes kw-glow {
            0%, 100% { text-shadow: 0 0 20px #7ddfff88, 0 0 40px #7ddfff44; }
            50%       { text-shadow: 0 0 40px #7ddfff, 0 0 80px #7ddfff88; }
        }
        .kw-connect-btn:hover {
            background: rgba(125, 223, 255, 0.1) !important;
        }
        .kw-fs-btn:hover {
            background: rgba(255,255,255,0.05) !important;
        }
    `;
    document.head.appendChild(style);

    // タイトル
    const title = document.createElement('h1');
    title.textContent = 'keywave';
    Object.assign(title.style, {
        fontSize: '5rem',
        letterSpacing: '0.3em',
        color: '#7ddfff',
        animation: 'kw-glow 3s ease-in-out infinite',
        userSelect: 'none',
    });

    // 接続ボタン
    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect AnalogSense';
    connectBtn.className = 'kw-connect-btn';
    Object.assign(connectBtn.style, {
        padding: '0.7rem 2rem',
        background: 'transparent',
        border: '2px solid #7ddfff',
        color: '#7ddfff',
        fontFamily: "'Audiowide', sans-serif",
        fontSize: '0.9rem',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'background 0.2s',
    });

    // "Press any key"
    const pressAny = document.createElement('p');
    pressAny.textContent = 'Press any key to start';
    Object.assign(pressAny.style, {
        fontSize: '1rem',
        color: '#ffffff',
        animation: 'kw-pulse 2s ease-in-out infinite',
        letterSpacing: '0.15em',
        marginTop: '2rem',
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
        border: '1px solid #334155',
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

    app.appendChild(title);
    app.appendChild(connectBtn);
    app.appendChild(pressAny);
    app.appendChild(fsBtn);

    onConnectButton(connectBtn);

    const handler = (e: KeyboardEvent) => {
        if (e.key === 'F11') { e.preventDefault(); toggleFs(); return; }
        // ブラウザショートカットは無視
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        document.removeEventListener('keydown', handler);
        onStart();
    };
    document.addEventListener('keydown', handler);
}
