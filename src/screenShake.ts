// 打鍵の強さに応じて画面を短く揺らす（打鍵圧のフィードバック用）。
// Web Animations API で一時的に transform を揺らすだけなので、
// アニメーション終了後は自動で元の transform に戻り、他の演出と競合しない。

/**
 * @param target 揺らす対象要素
 * @param intensity 揺れの強さ(0〜1に正規化した打鍵圧)
 */
export function shakeScreen(target: HTMLElement, intensity: number): void {
    if (typeof target.animate !== 'function') return;
    const t = Math.min(1, Math.max(0, intensity));
    const amplitude = 2 + t * 14; // px
    const duration = 150 + t * 90;

    target.animate(
        [
            { transform: 'translate(0, 0)' },
            { transform: `translate(${amplitude}px, ${-amplitude * 0.6}px)` },
            { transform: `translate(${-amplitude * 0.8}px, ${amplitude * 0.5}px)` },
            { transform: `translate(${amplitude * 0.5}px, ${-amplitude * 0.3}px)` },
            { transform: 'translate(0, 0)' },
        ],
        { duration, easing: 'ease-out' },
    );
}
