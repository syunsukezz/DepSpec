// プレイヤー名は文字ごとに打鍵圧(フォント)を持つ。タイトル画面での入力から
// ゲーム結果・ランキング表示まで、この配列のまま運んで見た目を保つ。
import type { PressureLevel } from './phrases';
import { FONT_LEVEL } from './theme';

export interface NameChar {
    ch: string;
    level: PressureLevel;
}

/** 打鍵圧に応じたフォントを当てた<span>を作ってcontainerに追加する */
export function appendStyledName(container: HTMLElement, chars: NameChar[]): void {
    chars.forEach(({ ch, level }) => {
        const span = document.createElement('span');
        span.textContent = ch;
        const font = FONT_LEVEL[level];
        span.style.fontFamily = font.family;
        span.style.fontWeight = String(font.weight);
        container.appendChild(span);
    });
}

/** localStorage等、形式が保証されない値からNameChar[]を安全に取り出す */
export function coerceNameChars(value: unknown): NameChar[] {
    if (!Array.isArray(value)) return [];
    return value.filter((c): c is NameChar =>
        c && typeof c === 'object' && typeof c.ch === 'string' &&
        (c.level === 'weak' || c.level === 'normal' || c.level === 'strong'));
}
