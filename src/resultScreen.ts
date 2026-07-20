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
        background: '#ffffff',
        color: '#1e293b',
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
    formula.style.cssText = 'font-size: 1.1rem; color: #64748b; text-align: center; line-height: 2;';
    formula.innerHTML =
        `<span style="color:#0891b2">${phrasesCompleted}</span> × 100` +
        ` + ` +
        `<span style="color:#16a34a">${pressureClears}</span> × 50` +
        ` = ` +
        `<span style="color:#ca8a04; font-size: 1.6rem;">${score}</span> pt`;

    // 大きなスコア数字
    const bigScore = document.createElement('div');
    bigScore.style.cssText = 'font-size: 5rem; color: #ca8a04; letter-spacing: 0.05em;';
    bigScore.textContent = `${score}`;

    // 内訳
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size: 0.9rem; color: #475569; text-align: center; line-height: 2;';
    detail.innerHTML =
        `フレーズ数: <span style="color:#0891b2">${phrasesCompleted}</span><br>` +
        `打鍵圧クリア: <span style="color:#16a34a">${pressureClears}</span>`;

    // タイトルへ戻るボタン（左下）
    const backBtn = document.createElement('button');
    backBtn.textContent = '← タイトルへ';
    Object.assign(backBtn.style, {
        position: 'absolute',
        bottom: '2rem',
        left: '2rem',
        padding: '0.6rem 1.5rem',
        background: 'transparent',
        border: '2px solid #cbd5e1',
        color: '#64748b',
        fontFamily: "'Audiowide', sans-serif",
        fontSize: '0.85rem',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'border-color 0.2s, color 0.2s',
    });
    backBtn.addEventListener('mouseover', () => {
        backBtn.style.borderColor = '#0891b2';
        backBtn.style.color = '#0891b2';
    });
    backBtn.addEventListener('mouseout', () => {
        backBtn.style.borderColor = '#cbd5e1';
        backBtn.style.color = '#64748b';
    });
    backBtn.addEventListener('click', onRestart);

    app.appendChild(heading);
    app.appendChild(bigScore);
    app.appendChild(formula);
    app.appendChild(detail);
    app.appendChild(backBtn);
}
