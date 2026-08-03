// 打鍵圧(押下量)の推移を折れ線グラフとしてリアルタイムに描画し、
// ステージの背景に薄く重ねて表示する常設のライブグラフ。
// CSS Grid の子要素として敷き、z-index を負にすることで他の内容の背後に沈める
// （position: absolute にしなくても、Grid/Flex アイテムは z-index があれば
//   position: relative 相当としてスタッキング順に参加する）。

const MAX_SAMPLES = 150; // 表示するサンプル数（古いものは左に流れて消える）
const GRAPH_OPACITY = 0.3;
const LINE_WIDTH = 4;

export interface PressureGraph {
    element: HTMLCanvasElement;
    /** 押下量(0〜1の生値)を1点追加する */
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
        gridColumn: '1',
        gridRow: '1 / -1',
        width: '100%',
        height: '100%',
        opacity: `${GRAPH_OPACITY}`,
        pointerEvents: 'none',
        zIndex: '-1',
    });
    const ctx = canvas.getContext('2d');
    const samples: number[] = [];

    function draw(): void {
        if (!ctx) return;
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        if (samples.length < 2) return;

        ctx.beginPath();
        const stepX = width / (MAX_SAMPLES - 1);
        samples.forEach((v, i) => {
            const x = width - (samples.length - 1 - i) * stepX;
            const y = height - v * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    return {
        element: canvas,
        push(value: number): void {
            samples.push(Math.min(1, Math.max(0, value)));
            if (samples.length > MAX_SAMPLES) samples.shift();
            draw();
        },
        dispose(): void {
            canvas.remove();
        },
    };
}
