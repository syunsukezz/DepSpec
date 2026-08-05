import SENTENCES, { type Level } from './sentences';
import type { PressureInstruction } from './pressureHeuristic';
import { PRESS_NORMAL } from './theme';

export type { PressureInstruction };

export function normalizeN(n: number): number {
    return Math.min(1, Math.max(0, n*3.5 - 2.7)); // 0〜1に正規化
}

// 打鍵圧のカテゴリ: 正規化値(0〜1)を3等分して 弱い / 普通 / 強い に分類する
export type PressureLevel = 'weak' | 'normal' | 'strong';
export const LEVEL_LOW  = 1 / 3; // これ未満 → 弱い
export const LEVEL_HIGH = 2 / 3; // これ以上 → 強い

export function pressureLevel(n: number): PressureLevel {
    const t = normalizeN(n);
    if (t < LEVEL_LOW) return 'weak';
    if (t < LEVEL_HIGH) return 'normal';
    return 'strong';
}

export interface PhraseData {
    text: string;               // ひらがな(タイピング用)
    displayText: string;        // 漢字混じり文(表示専用。タイピングには使わない)
    // ローマ字(キー)の位置(0-based) -> 強/普通/弱。sentences.ts の "かな/マーク" 表記
    // (pressureSpec.ts) をパースしたもの。マークの無い区間は targets に含まれない。
    targets: Record<number, PressureInstruction>;
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
}

// 台本には場面ごとの流れがあるため、ランダムではなく WORD_LISTS に登録された順番で
// 出題する。レベルごとに次に出す位置を覚えておき、末尾まで行ったら先頭に戻る。
const phraseCursor: Record<Level, number> = { Easy: 0, Normal: 0, Hard: 0 };

/** レベルの出題順を先頭に戻す。新しいゲームセッションの開始時に呼ぶ想定。 */
export function resetPhraseSequence(level: Level): void {
    phraseCursor[level] = 0;
}

/**
 * @param level 出題するフレーズの難易度（sentences.ts の Easy/Normal/Hard）
 * targets は sentences.ts の WORD_LISTS に埋め込まれた指定をパースしたものをそのまま使う。
 */
export function generatePhrase(level: Level = 'Easy'): PhraseData {
    const pool = SENTENCES[level].phrases;
    const seed = pool[phraseCursor[level]];
    phraseCursor[level] = (phraseCursor[level] + 1) % pool.length;
    return { text: seed.text, displayText: seed.displayText, targets: { ...seed.targets }, charPressures: {} };
}

/**
 * フレーズの打鍵圧からクリアしたアイコン数を返す（0〜アイコン数）。
 * - 強く: 打鍵圧が「弱い」でなければクリア（普通 or 強い）
 * - 弱く: 打鍵圧が「強い」でなければクリア（弱い or 普通）
 * - 普通に: 打鍵圧が「普通」のときのみクリア
 */
export function countPressureClears(phrase: PhraseData): number {
    const { targets, charPressures } = phrase;
    let cleared = 0;
    for (const [idxStr, instruction] of Object.entries(targets)) {
        const n = charPressures[Number(idxStr)];
        if (n === undefined) continue;
        const level = pressureLevel(n);
        if (instruction === 'strong' && level !== 'weak') cleared++;
        else if (instruction === 'weak' && level !== 'strong') cleared++;
        else if (instruction === 'normal' && level === 'normal') cleared++;
    }
    return cleared;
}

export const INSTRUCTION_LABEL: Record<PressureInstruction, { symbol: string; color: string; name: string }> = {
    strong:  { symbol: '▲', color: '#dc2626', name: '強く' },
    normal:  { symbol: '●', color: PRESS_NORMAL, name: 'ふつうに' },
    weak:    { symbol: '▼', color: '#2563eb', name: '弱く' },
};
