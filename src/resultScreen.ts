import type { GameResult } from './gameScreen';

export function showResultScreen(
    app: HTMLDivElement,
    result: GameResult,
    onRestart: () => void,
): void {
    const { phrasesCompleted, pressureClears } = result;
    const score = phrasesCompleted * 100 + pressureClears * 50;

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
        position: 'relative',
    });

    // タイトル
    const heading = document.createElement('h2');
    heading.textContent = 'RESULT';
    Object.assign(heading.style, {
        fontSize: '1.2rem',
        letterSpacing: '0.4em',
        color: '#64748b',
    });

    // スコア計算式
    const formula = document.createElement('div');
    formula.style.cssText = 'font-size: 1.1rem; color: #94a3b8; text-align: center; line-height: 2;';
    formula.innerHTML =
        `<span style="color:#7ddfff">${phrasesCompleted}</span> × 100` +
        ` + ` +
        `<span style="color:#22c55e">${pressureClears}</span> × 50` +
        ` = ` +
        `<span style="color:#fde047; font-size: 1.6rem;">${score}</span> pt`;

    // 大きなスコア数字
    const bigScore = document.createElement('div');
    bigScore.style.cssText = 'font-size: 5rem; color: #fde047; letter-spacing: 0.05em;';
    bigScore.textContent = `${score}`;

    // 内訳
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size: 0.9rem; color: #475569; text-align: center; line-height: 2;';
    detail.innerHTML =
        `フレーズ数: <span style="color:#7ddfff">${phrasesCompleted}</span><br>` +
        `打鍵圧クリア: <span style="color:#22c55e">${pressureClears}</span>`;

    // タイトルへ戻るボタン（左下）
    const backBtn = document.createElement('button');
    backBtn.textContent = '← タイトルへ';
    Object.assign(backBtn.style, {
        position: 'absolute',
        bottom: '2rem',
        left: '2rem',
        padding: '0.6rem 1.5rem',
        background: 'transparent',
        border: '2px solid #334155',
        color: '#94a3b8',
        fontFamily: "'Audiowide', sans-serif",
        fontSize: '0.85rem',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'border-color 0.2s, color 0.2s',
    });
    backBtn.addEventListener('mouseover', () => {
        backBtn.style.borderColor = '#7ddfff';
        backBtn.style.color = '#7ddfff';
    });
    backBtn.addEventListener('mouseout', () => {
        backBtn.style.borderColor = '#334155';
        backBtn.style.color = '#94a3b8';
    });
    backBtn.addEventListener('click', onRestart);

    app.appendChild(heading);
    app.appendChild(bigScore);
    app.appendChild(formula);
    app.appendChild(detail);
    app.appendChild(backBtn);
}
