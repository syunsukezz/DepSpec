// 打鍵圧(calcPressureが底打ち毎に算出するNewton相当値)の推移を折れ線グラフとして
// リアルタイムに描画し、ステージの背景に薄く重ねて表示する常設のライブグラフ。
// position: absolute で他要素のレイアウト(Grid配置)から切り離し、z-index を負にすることで
// 一番後ろに沈める。横軸は打鍵イベントの回数ではなく経過時間で進めるので、
// キーを打っていない間も requestAnimationFrame で描き直し、常時左に流れ続ける。

import { normalizeN } from './phrases';

const WINDOW_MS = 6000; // 表示する時間幅(ミリ秒)。この幅を過ぎたサンプルは左に流れて消える
const DECAY_MS = 150; // 打鍵の瞬間だけ値を立ち上げ、この時間で基線(0)まで減衰させる
const GRAPH_OPACITY = 0.1;
const LINE_WIDTH = 4;

interface Sample {
    t: number; // performance.now() 時点の時刻
    v: number; // 打鍵圧(Newton相当値、生値)
}

export interface PressureGraph {
    element: HTMLCanvasElement;
    /** 打鍵圧(Newton相当値)を1点追加する。calcPressureのコールバックからそのまま渡す */
    push(value: number): void;
    dispose(): void;
}

/**
 * @param color 折れ線の色
 * @param designW / designH ステージの設計サイズ（canvas の内部解像度に使う）
 */
export function createPressureGraph(
    color: string,
    designW: number,
    designH: number,
): PressureGraph {
    const canvas = document.createElement('canvas');
    canvas.width = designW;
    canvas.height = designH;
    Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        opacity: `${GRAPH_OPACITY}`,
        pointerEvents: 'none',
        zIndex: '-1',
    });
    const ctx = canvas.getContext('2d');
    const samples: Sample[] = [];
    let rafId = 0;

    function draw(): void {
        const now = performance.now();
        while (samples.length && now - samples[0].t > WINDOW_MS) samples.shift();

        if (ctx) {
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);
            if (samples.length >= 1) {
                const xOf = (t: number) => width - ((now - t) / WINDOW_MS) * width;
                const yOf = (v: number) => height - normalizeN(v) * height;

                // 打鍵の瞬間にだけ値を立ち上げ、DECAY_MS で基線(0)まで下ろす。
                // 直前の値をずっと保持しないよう、打鍵の合間は常に基線(0)に戻す。
                const windowStart = now - WINDOW_MS;
                ctx.beginPath();
                ctx.moveTo(xOf(windowStart), yOf(0));
                let lastT = windowStart;
                for (const s of samples) {
                    if (s.t > lastT) ctx.lineTo(xOf(s.t), yOf(0)); // 次の打鍵まで基線を維持
                    ctx.lineTo(xOf(s.t), yOf(s.v)); // 打鍵の瞬間に立ち上がる

                    const decayEndT = s.t + DECAY_MS;
                    if (decayEndT <= now) {
                        ctx.lineTo(xOf(decayEndT), yOf(0)); // 減衰完了、基線へ
                        lastT = decayEndT;
                    } else {
                        // 減衰中: 現在時刻での補間値まで描いて今回のフレームは終了
                        const frac = (now - s.t) / DECAY_MS;
                        ctx.lineTo(xOf(now), yOf(s.v * (1 - frac)));
                        lastT = now;
                    }
                }
                if (now > lastT) ctx.lineTo(xOf(now), yOf(0));

                ctx.strokeStyle = color;
                ctx.lineWidth = LINE_WIDTH;
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        }

        rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);

    return {
        element: canvas,
        push(value: number): void {
            samples.push({ t: performance.now(), v: value });
        },
        dispose(): void {
            cancelAnimationFrame(rafId);
            canvas.remove();
        },
    };
}
