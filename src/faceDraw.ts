// 打鍵圧に応じた横顔キャラクターの描画。
// 打鍵圧 強 → 300° (60° の口開き), 弱 → 350° (10° の口開き)
// gameScreen（本編・大きめ表示）と tutorialScreen（練習・小さめ表示）で見た目を共有する。

import { normalizeN } from './phrases';

export interface DrawFaceOptions {
    color?: string;
    lineWidth?: number;
    eyeRadiusRatio?: number; // 半径 r に対する目の大きさの比率
    showLabel?: boolean;     // 右下に "0.8N" のような打鍵圧ラベルを出す
}

export function drawFace(
    canvas: HTMLCanvasElement,
    newtonValue: number,
    opts: DrawFaceOptions = {},
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
        color = '#0891b2',
        lineWidth = 6,
        eyeRadiusRatio = 0.07,
        showLabel = false,
    } = opts;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 線形正規化: 0.6N〜3.0N → 0〜1
    const t = normalizeN(newtonValue);

    // 弧の角度: t=1(強) → 300°, t=0(弱) → 350°
    const arcDeg = 350 - t * 50;
    const gapDeg = 360 - arcDeg;
    const gapRad = (gapDeg / 2) * (Math.PI / 180);

    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.38;

    // 顔の輪郭弧（口部分が右側）
    ctx.beginPath();
    ctx.arc(cx, cy, r, gapRad, 2 * Math.PI - gapRad, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 弧の端点から中心への線（口の上唇・下唇）
    const p1x = cx + r * Math.cos(gapRad);
    const p1y = cy + r * Math.sin(gapRad);
    const p2x = cx + r * Math.cos(-gapRad);
    const p2y = cy + r * Math.sin(-gapRad);

    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(p2x, p2y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 目（右上側）
    const eyeX = cx + r * 0.28;
    const eyeY = cy - r * 0.32;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, r * eyeRadiusRatio, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // 打鍵圧インジケータ（小さいテキスト）
    if (showLabel) {
        ctx.fillStyle = '#64748b88';
        ctx.font = `${W * 0.08}px Audiowide, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${newtonValue.toFixed(1)}N`, cx, H - 8);
    }
}
