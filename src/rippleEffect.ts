// 画面四方（上下左右の各辺の中央）から広がる波紋エフェクト。
// アナログキーボード接続時など「節目」の演出に使う。
// ビューポート全体に固定オーバーレイを敷き、各辺から同心円のリングを
// 少しずつ時間差で広げてフェードさせる。pointer-events: none なので操作は妨げない。

export interface EdgeRippleOptions {
    /** リングの色（既定はテーマのシアン） */
    color?: string;
    /** 1辺あたりのリング本数（時間差で重ねる） */
    ringsPerEdge?: number;
    /** 1本の広がりきる時間(ms) */
    duration?: number;
    /** リング同士の時間差(ms) */
    stagger?: number;
}

/**
 * 画面全体を一瞬だけ赤くフラッシュさせる（ミス時のフィードバック用）。
 * ビューポート固定のオーバーレイを一枚かぶせ、素早くフェードして消える。
 * pointer-events: none なので操作は妨げない。
 */
export function flashRedScreen(opts: { color?: string; duration?: number; peak?: number } = {}): void {
    const color = opts.color ?? '#ff1e1e';
    const duration = opts.duration ?? 260;
    const peak = opts.peak ?? 0.42; // フラッシュの最大不透明度

    const flash = document.createElement('div');
    Object.assign(flash.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '100001',
        background: color,
        opacity: '0',
    });
    document.body.appendChild(flash);

    if (typeof flash.animate !== 'function') {
        flash.remove();
        return;
    }
    const anim = flash.animate(
        [
            { opacity: 0 },
            { opacity: peak, offset: 0.18 },
            { opacity: 0 },
        ],
        { duration, easing: 'ease-out' },
    );
    const done = () => flash.remove();
    anim.onfinish = done;
    anim.oncancel = done;
}

/** 画面四方から波紋を1回再生する（再生後にオーバーレイは自動で片付く） */
export function playEdgeRipple(opts: EdgeRippleOptions = {}): void {
    const color = opts.color ?? '#f2d621';
    const ringsPerEdge = opts.ringsPerEdge ?? 1;
    const duration = opts.duration ?? 1400;
    const stagger = opts.stagger ?? 50;

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '99999',
        overflow: 'hidden',
    });
    document.body.appendChild(overlay);

    // 各辺の中央（left/top を % で指定、transform で中央合わせ）
    const edges = [
        { left: '50%', top: '0%' },    // 上
        { left: '50%', top: '100%' },  // 下
        { left: '0%', top: '50%' },    // 左
        { left: '100%', top: '50%' },  // 右
    ];

    // 辺の端からでも画面全体を覆えるだけ拡大する
    const base = 80;
    const diagonal = Math.hypot(window.innerWidth, window.innerHeight);
    const maxScale = (diagonal * 2.2) / base;

    let pending = edges.length * ringsPerEdge;
    const finishOne = () => {
        pending -= 1;
        if (pending <= 0) overlay.remove();
    };

    for (const edge of edges) {
        for (let i = 0; i < ringsPerEdge; i++) {
            const ring = document.createElement('div');
            Object.assign(ring.style, {
                position: 'absolute',
                left: edge.left,
                top: edge.top,
                width: `${base}px`,
                height: `${base}px`,
                marginLeft: `${-base / 2}px`,
                marginTop: `${-base / 2}px`,
                borderRadius: '50%',
                border: `3px solid ${color}`,
                boxShadow: `0 0 24px ${color}`,
                opacity: '0',
            });
            overlay.appendChild(ring);

            const anim = ring.animate(
                [
                    { transform: 'scale(0.05)', opacity: 0, offset: 0 },
                    { opacity: 0.55, offset: 0.12 },
                    { transform: `scale(${maxScale})`, opacity: 0, offset: 1 },
                ],
                {
                    duration,
                    delay: i * stagger,
                    easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
                    fill: 'forwards',
                },
            );
            anim.onfinish = finishOne;
            anim.oncancel = finishOne;
        }
    }
}
