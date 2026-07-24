// 押下量の常時ライブメーター。
// 画面右端に縦バーを常設し、今まさに押している深さ(0〜1)をリアルタイムに表示する。
// 弱/普通/強の3段階で色が変わり、境界(1/3・2/3)に目盛り線を引く。
// ゲーム・チュートリアル共通で使う。

type PressureLevel = 'weak' | 'normal' | 'strong';

const LEVEL_COLOR: Record<PressureLevel, string> = {
    strong: '#ef4444', // 赤
    normal: '#22c55e', // 緑
    weak:   '#3b82f6', // 青
};

const LEVEL_LOW = 1 / 3;
const LEVEL_HIGH = 2 / 3;

export interface PressureMeter {
    /** 押下量(0〜1の生値。AnalogsenseHandler で取れる値をそのまま)を反映する */
    update(pressure: number): void;
    /** DOM から取り除く */
    dispose(): void;
}

/** 押下量(0〜1)を 3 等分して 弱/普通/強 の色分けに使う */
function levelOf(t: number): PressureLevel {
    if (t < LEVEL_LOW) return 'weak';
    if (t < LEVEL_HIGH) return 'normal';
    return 'strong';
}

/**
 * 押下量メーターを document.body に常設する（position: fixed でビューポート右端）。
 * 画面を離れるときは dispose() を呼ぶこと。
 */
export function createPressureMeter(): PressureMeter {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
        position: 'fixed',
        right: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: '90',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'none',
        userSelect: 'none',
    });

    const caption = document.createElement('div');
    caption.textContent = '押下量';
    caption.style.cssText =
        "font-size:0.7rem; letter-spacing:0.15em; color:#94a3b8; font-family:'Audiowide',sans-serif;";

    // 縦トラック
    const track = document.createElement('div');
    Object.assign(track.style, {
        position: 'relative',
        width: '30px',
        height: '320px',
        background: '#e2e8f0',
        borderRadius: '15px',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
    });

    // 下から伸びるフィル
    const fill = document.createElement('div');
    Object.assign(fill.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        bottom: '0',
        height: '0%',
        background: LEVEL_COLOR.weak,
        borderRadius: '15px',
        transition: 'height 0.06s linear, background 0.12s ease',
    });
    track.appendChild(fill);

    // 閾値の目盛り線（下からの割合なので bottom で配置）
    for (const ratio of [LEVEL_LOW, LEVEL_HIGH]) {
        const tick = document.createElement('div');
        Object.assign(tick.style, {
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: `${ratio * 100}%`,
            height: '2px',
            background: 'rgba(0,0,0,0.18)',
        });
        track.appendChild(tick);
    }

    // 現在値(%)
    const readout = document.createElement('div');
    readout.textContent = '0%';
    readout.style.cssText =
        "font-size:0.85rem; color:#64748b; font-family:'Audiowide',sans-serif; min-width:3em; text-align:center;";

    wrap.appendChild(caption);
    wrap.appendChild(track);
    wrap.appendChild(readout);
    document.body.appendChild(wrap);

    return {
        update(pressure: number): void {
            const t = Math.min(1, Math.max(0, pressure));
            fill.style.height = `${t * 100}%`;
            fill.style.background = LEVEL_COLOR[levelOf(t)];
            readout.textContent = `${Math.round(t * 100)}%`;
        },
        dispose(): void {
            wrap.remove();
        },
    };
}
