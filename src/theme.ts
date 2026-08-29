// 画面共通のデザイントークン。
// 押下量(弱/普通/強)の配色は keyboard / pressureMeter / resultScreen / tutorialScreen で
// 共有するため、ここを唯一の定義元にする。

export const FONT_DISPLAY = "'Audiowide', sans-serif";

// 押下量の弱/普通/強（青→緑→赤）
export const PRESS_WEAK = '#3b82f6';
export const PRESS_NORMAL = '#22c55e';
export const PRESS_STRONG = '#ef4444';

import type { PressureLevel } from './phrases';

export const PRESS_LEVEL_COLOR: Record<PressureLevel, string> = {
    weak: PRESS_WEAK,
    normal: PRESS_NORMAL,
    strong: PRESS_STRONG,
};

// 打鍵圧に応じた名前表示フォント（弱=Klee One / 普通=Noto Sans JP / 強=Noto Serif JP）
export const FONT_LEVEL: Record<PressureLevel, { family: string; weight: number }> = {
    weak: { family: "'Klee One', cursive", weight: 400 },
    normal: { family: "'Noto Sans JP', sans-serif", weight: 400 },
    strong: { family: "'Noto Serif JP', serif", weight: 900 },
};
