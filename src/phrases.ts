import SENTENCES, { type Level } from './sentences';
import type { PressureInstruction } from './pressureHeuristic';

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
    text: string;               // ひらがな
    // ローマ字(キー)の位置(0-based) -> 強/弱。単語(フレーズ)全体で同じ指定になる
    // （語感から決定論的に決まるため、同じフレーズは常に同じ指定になる）
    targets: Record<number, PressureInstruction>;
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
}

/**
 * @param level 出題するフレーズの難易度（sentences.ts の Easy/Normal/Hard）
 * targets は sentences.ts に事前計算済みのものをそのまま使う
 * （`npm run generate:pressure` で生成。単語ごとの語感に基づき、単語全体の
 * キー位置に同じ強/弱が敷かれている。未計算の単語は targets が空になる）。
 */
export function generatePhrase(level: Level = 'Easy'): PhraseData {
    const pool = SENTENCES[level].phrases;
    const seed = pool[Math.floor(Math.random() * pool.length)];
    return { text: seed.text, targets: { ...seed.targets }, charPressures: {} };
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
