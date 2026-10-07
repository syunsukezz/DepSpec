// 打鍵の強さに応じて画面を短く揺らす（打鍵圧のフィードバック用）。
// Web Animations API で一時的に transform を揺らすだけなので、
// アニメーション終了後は自動で元の transform に戻り、他の演出と競合しない。
// stabilize に渡した要素（読ませる文字など）には逆位相の揺れを同時に掛けて打ち消し、
// 画面上では静止して見えるようにする。

/** 祖先の transform: scale を含めた実効スケール（逆位相の変位量の補正に使う） */
function effectiveScale(el: HTMLElement): number {
    const w = el.offsetWidth;
    if (w === 0) return 1;
    const s = el.getBoundingClientRect().width / w;
    return s > 0 ? s : 1;
}

/**
 * @param target 揺らす対象要素
 * @param intensity 揺れの強さ(0〜1に正規化した打鍵圧)
 * @param stabilize target の子孫のうち、揺らさずに静止させたい要素
 */
export function shakeScreen(target: HTMLElement, intensity: number, stabilize: HTMLElement[] = []): void {
    if (typeof target.animate !== 'function') return;
    const t = Math.min(1, Math.max(0, intensity));
    const amplitude = 2 + t * 14; // px
    const duration = 150 + t * 90;
    const offsets: [number, number][] = [
        [0, 0],
        [amplitude, -amplitude * 0.6],
        [-amplitude * 0.8, amplitude * 0.5],
        [amplitude * 0.5, -amplitude * 0.3],
        [0, 0],
    ];
    const options: KeyframeAnimationOptions = { duration, easing: 'ease-out' };

    // target の揺れが子孫に伝わる量は (target の実効スケール / 子孫の実効スケール) 倍で見えるため、
    // 子孫側の逆変位はその比で補正する
    const targetScale = effectiveScale(target);
    target.animate(offsets.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })), options);
    for (const el of stabilize) {
        const k = targetScale / effectiveScale(el);
        el.animate(offsets.map(([x, y]) => ({ transform: `translate(${-x * k}px, ${-y * k}px)` })), options);
    }
}
