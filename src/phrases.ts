import SENTENCES, { type Level } from './sentences';

export type PressureInstruction = 'strong' | 'weak';

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

const MAX_MARKS = 3; // 1文に付けられるアイコンの最大数

export interface PhraseData {
    text: string;               // ひらがな
    // ローマ字(キー)の位置(0-based) -> 強/弱。1文に強・弱が混在してよい (最大 MAX_MARKS 個)
    // ※位置は「代表的な綴りで打った場合の何打鍵目か」を表す
    targets: Record<number, PressureInstruction>;
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
}

/**
 * @param level 出題するフレーズの難易度（sentences.ts の Easy/Normal/Hard）
 * targets はローマ字の綴りが確定してから assignRomajiTargets で割り当てる。
 */
export function generatePhrase(level: Level = 'Easy'): PhraseData {
    const pool = SENTENCES[level].texts;
    const text = pool[Math.floor(Math.random() * pool.length)];
    return { text, targets: {}, charPressures: {} };
}

/**
 * ローマ字(キー)の位置ごとに強/弱指定をランダムに割り当てる。
 * @param romajiLength そのフレーズを代表的な綴りで打つときの総キー数
 * @returns 「キーの位置(0始まり) -> 強/弱」のマップ（最大 MAX_MARKS 個）
 */
export function assignRomajiTargets(romajiLength: number): Record<number, PressureInstruction> {
    const targets: Record<number, PressureInstruction> = {};
    if (romajiLength <= 0) return targets;

    // 打鍵位置を重複なくランダムに最大 MAX_MARKS 個選び、各位置に強/弱を割り当てる
    const count = Math.min(Math.floor(Math.random() * MAX_MARKS) + 1, romajiLength);
    const indices = Array.from({ length: romajiLength }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (const idx of indices.slice(0, count)) {
        targets[idx] = Math.random() < 0.5 ? 'strong' : 'weak';
    }
    return targets;
}

/**
 * フレーズの打鍵圧からクリアしたアイコン数を返す（0〜アイコン数）。
 * - 強く: 打鍵圧が「弱い」でなければクリア（普通 or 強い）
 * - 弱く: 打鍵圧が「強い」でなければクリア（弱い or 普通）
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
    }
    return cleared;
}

export const INSTRUCTION_LABEL: Record<PressureInstruction, { symbol: string; color: string; name: string }> = {
    strong:  { symbol: '▲', color: '#dc2626', name: '強く' },
    weak:    { symbol: '▼', color: '#2563eb', name: '弱く' },
};
