import type { GameResult } from './gameScreen';
import { normalizeN, pressureLevel, type PressureLevel } from './phrases';
import { createStage } from './stage';
import { FONT_DISPLAY, PRESS_LEVEL_COLOR } from './theme';
import { recordScore, type RankingEntry } from './ranking';

// 称号の閾値（調整可能）
const PRECISION_HIGH = 0.7;  // 追従率がこれ以上 → 精度「高」
const SD_WIDE        = 0.15; // 標準偏差がこれ以上 → レンジ「広」

const LEVEL_META: Record<PressureLevel, { label: string; color: string }> = {
    weak:   { label: '弱', color: PRESS_LEVEL_COLOR.weak },
    normal: { label: '普通', color: PRESS_LEVEL_COLOR.normal },
    strong: { label: '強', color: PRESS_LEVEL_COLOR.strong },
};

interface ExpressionStats {
    sd: number;
    precision: number;               // 0〜1
    counts: Record<PressureLevel, number>;
    total: number;
    title: string;                   // 連結した称号
}

function computeStats(result: GameResult): ExpressionStats {
    const { pressures, pressureClears, totalTargets } = result;

    // 3ビン集計
    const counts: Record<PressureLevel, number> = { weak: 0, normal: 0, strong: 0 };
    for (const p of pressures) counts[pressureLevel(p)]++;
    const total = pressures.length;

    // 標準偏差（正規化打鍵圧 0〜1）
    const norm = pressures.map(normalizeN);
    const mean = norm.reduce((a, b) => a + b, 0) / (norm.length || 1);
    const variance = norm.reduce((a, b) => a + (b - mean) ** 2, 0) / (norm.length || 1);
    const sd = Math.sqrt(variance);

    // 追従率（コントロール精度）
    const precision = totalTargets > 0 ? pressureClears / totalTargets : 0;

    // 軸1: レンジ × 精度 → 形容詞
    const highPrecision = precision >= PRECISION_HIGH;
    const wideRange = sd >= SD_WIDE;
    const adjective = highPrecision
        ? (wideRange ? '表現豊かな' : '几帳面な')
        : (wideRange ? 'ダイナミックな' : '一本調子な');

    // 軸2: 最多ビン → 名詞（同数は 普通 を優先）
    const dominant: PressureLevel =
        counts.strong > counts.normal && counts.strong > counts.weak ? 'strong'
        : counts.weak > counts.normal && counts.weak > counts.strong ? 'weak'
        : 'normal';
    const noun = dominant === 'strong' ? 'タイピングゴリラ'
        : dominant === 'weak' ? 'タイピング紳士'
        : '安定タイパー';

    return { sd, precision, counts, total, title: adjective + noun };
}

/** ランキング欄（この端末内・localStorage）。今回のスコアの行をハイライトする */
function renderRanking(stage: HTMLDivElement, ranking: RankingEntry[], current: RankingEntry): void {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
        display: 'flex', flexDirection: 'column', gap: '0.35rem',
        width: '420px', maxWidth: '100%',
        fontFamily: 'system-ui, sans-serif',
    });

    const head = document.createElement('div');
    head.textContent = 'ランキング（この端末内）';
    head.style.cssText = 'font-size:0.8rem; color:#94a3b8; letter-spacing:0.1em;';
    wrap.appendChild(head);

    ranking.slice(0, 5).forEach((entry, i) => {
        const isCurrent = entry === current;

        const row = document.createElement('div');
        row.style.cssText =
            'display:flex; align-items:center; gap:0.6rem; padding:0.25rem 0.6rem; border-radius:6px;' +
            (isCurrent ? 'background:#ecfeff; border:1px solid #0891b2;' : '');

        const rank = document.createElement('span');
        rank.textContent = `${i + 1}`;
        rank.style.cssText = `width:1.6rem; text-align:center; font-family:${FONT_DISPLAY}; color:#0891b2; font-size:0.95rem;`;

        const sc = document.createElement('span');
        sc.textContent = `${entry.score} pt`;
        sc.style.cssText = `flex:1; font-size:0.9rem; color:${isCurrent ? '#0e7490' : '#334155'}; font-weight:${isCurrent ? '700' : '400'};`;

        const tag = document.createElement('span');
        tag.textContent = `${entry.mode === 'analog' ? 'アナログ' : '通常'} / ${entry.level}`;
        tag.style.cssText = 'font-size:0.75rem; color:#94a3b8;';

        row.appendChild(rank);
        row.appendChild(sc);
        row.appendChild(tag);
        wrap.appendChild(row);
    });

    stage.appendChild(wrap);
}

export function showResultScreen(
    app: HTMLDivElement,
    result: GameResult,
    onRestart: () => void,
): void {
    const { mode, level, phrasesCompleted, baseScore, expressionScore } = result;
    const score = baseScore + expressionScore;

    // アナログモードかつ打鍵データがある場合のみ表現評価を出す
    const showExpression = mode === 'analog' && result.pressures.length > 0;

    // 今回のスコアをローカルランキングに記録
    const currentEntry: RankingEntry = { score, mode, level, date: new Date().toISOString() };
    const ranking = recordScore(currentEntry);

    // 割合を一定に保つため等倍スケール（fit）。ランキング欄の分、通常より縦に長め
    const { stage, dispose: disposeStage } = createStage(app, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        gap: '1.1rem',
        position: 'relative',
    }, { fit: true, designW: 1000, designH: 580 });

    // タイトル
    const heading = document.createElement('h2');
    heading.textContent = 'RESULT';
    Object.assign(heading.style, {
        fontSize: '1.2rem',
        letterSpacing: '0.4em',
        color: '#64748b',
        margin: '0',
    });

    // 大きなスコア数字
    const bigScore = document.createElement('div');
    bigScore.style.cssText = 'font-size: 4.5rem; color: #ca8a04; letter-spacing: 0.05em; line-height: 1;';
    bigScore.textContent = `${score}`;

    // スコア計算式（基本点 ＋ 表現点）
    const formula = document.createElement('div');
    formula.style.cssText = 'font-size: 1.05rem; color: #64748b; text-align: center; line-height: 1.8;';
    formula.innerHTML =
        `基本点 <span style="color:#0891b2">${baseScore}</span>` +
        ` ＋ 表現点 <span style="color:#16a34a">${expressionScore}</span>` +
        ` ＝ <span style="color:#ca8a04; font-size:1.3rem;">${score}</span> pt`;

    stage.appendChild(heading);
    stage.appendChild(bigScore);
    stage.appendChild(formula);

    if (showExpression) {
        const stats = computeStats(result);

        // 称号（連結した1フレーズ）
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:0.3rem;';
        const titleLabel = document.createElement('div');
        titleLabel.textContent = '称号';
        titleLabel.style.cssText = 'font-size:0.75rem; color:#94a3b8; letter-spacing:0.3em;';
        const titleName = document.createElement('div');
        titleName.textContent = stats.title;
        titleName.style.cssText =
            'font-size:2rem; color:#0891b2; letter-spacing:0.08em;' +
            'font-family:system-ui,sans-serif; font-weight:700;';
        titleEl.appendChild(titleLabel);
        titleEl.appendChild(titleName);
        stage.appendChild(titleEl);

        // 打鍵圧の分布（弱/普通/強 の3ビン棒）
        const distEl = document.createElement('div');
        Object.assign(distEl.style, {
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            width: '420px', maxWidth: '100%',
            fontFamily: 'system-ui, sans-serif',
        });
        const distHead = document.createElement('div');
        distHead.textContent = '打鍵圧の分布';
        distHead.style.cssText = 'font-size:0.8rem; color:#94a3b8; letter-spacing:0.1em;';
        distEl.appendChild(distHead);

        (['strong', 'normal', 'weak'] as PressureLevel[]).forEach(lv => {
            const { label, color } = LEVEL_META[lv];
            const count = stats.counts[lv];
            const ratio = stats.total > 0 ? count / stats.total : 0;

            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:0.6rem;';

            const name = document.createElement('span');
            name.textContent = label;
            name.style.cssText = `width:2.4rem; text-align:right; color:${color}; font-size:0.9rem;`;

            const track = document.createElement('div');
            track.style.cssText = 'flex:1; height:14px; background:#f1f5f9; border-radius:7px; overflow:hidden;';
            const fill = document.createElement('div');
            fill.style.cssText = `height:100%; width:${(ratio * 100).toFixed(1)}%; background:${color}; border-radius:7px; transition:width 0.4s;`;
            track.appendChild(fill);

            const num = document.createElement('span');
            num.textContent = `${count}`;
            num.style.cssText = 'width:3rem; color:#64748b; font-size:0.85rem;';

            row.appendChild(name);
            row.appendChild(track);
            row.appendChild(num);
            distEl.appendChild(row);
        });
        stage.appendChild(distEl);

        // 最大コンボ
        const comboM = document.createElement('div');
        comboM.style.cssText = 'text-align:center; font-family:system-ui,sans-serif;';
        comboM.innerHTML =
            `<div style="font-size:0.75rem; color:#94a3b8;">最大コンボ</div>` +
            `<div style="font-size:1.4rem; color:#f59e0b;">${result.maxCombo}</div>`;
        stage.appendChild(comboM);
    } else {
        // 通常モード等：純タイピングの内訳
        const detail = document.createElement('div');
        detail.style.cssText = 'font-size:0.9rem; color:#475569; text-align:center; line-height:2; font-family:system-ui,sans-serif;';
        detail.innerHTML = `タイプしたフレーズ数: <span style="color:#0891b2">${phrasesCompleted}</span>`;
        stage.appendChild(detail);
    }

    renderRanking(stage, ranking, currentEntry);

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
        fontFamily: FONT_DISPLAY,
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
    // タイトルへ戻る（ボタン / Enterキー）。二重発火とリスナー残留を防ぐ。
    let navigated = false;
    function goBack(): void {
        if (navigated) return;
        navigated = true;
        document.removeEventListener('keydown', onKeyDown);
        disposeStage();
        onRestart();
    }
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goBack();
        }
    };
    document.addEventListener('keydown', onKeyDown);

    backBtn.addEventListener('click', goBack);
    stage.appendChild(backBtn);
}
