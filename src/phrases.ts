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

export interface PhraseData {
    text: string;               // ひらがな
    // ローマ字(キー)の位置(0-based) -> 強/弱。単語(フレーズ)全体で同じ指定になる
    // （語感から決定論的に決まるため、同じフレーズは常に同じ指定になる）
    targets: Record<number, PressureInstruction>;
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
}

/**
 * @param level 出題するフレーズの難易度（sentences.ts の Easy/Normal/Hard）
 * targets はローマ字の綴りが確定してから assignWordTargets で割り当てる。
 */
export function generatePhrase(level: Level = 'Easy'): PhraseData {
    const pool = SENTENCES[level].texts;
    const text = pool[Math.floor(Math.random() * pool.length)];
    return { text, targets: {}, charPressures: {} };
}

// ── 語感（音象徴）に基づく打鍵圧指定 ──────────────────────────────────
// 参考: https://qiita.com/Hirata-Masato/items/775ecd86f26f305fd393
// 「濁音・長音・低い母音(あ/え)ほど強く/重く感じられ、半濁音・高い母音(い)ほど弱く/軽く感じられる」
// という音象徴(Frequency Code)の傾向をスコア化し、フレーズ全体で1つの強/弱を決定論的に決める。

const DAKUON = new Set(['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ','ゔ']);
const HANDAKUON = new Set(['ぱ','ぴ','ぷ','ぺ','ぽ']);

type Vowel = 'a' | 'i' | 'u' | 'e' | 'o';
const VOWEL_OF: Record<string, Vowel> = {
    'あ':'a','か':'a','が':'a','さ':'a','ざ':'a','た':'a','だ':'a','な':'a','は':'a','ば':'a','ぱ':'a','ま':'a','や':'a','ゃ':'a','ら':'a','わ':'a',
    'い':'i','き':'i','ぎ':'i','し':'i','じ':'i','ち':'i','ぢ':'i','に':'i','ひ':'i','び':'i','ぴ':'i','み':'i','り':'i',
    'う':'u','く':'u','ぐ':'u','す':'u','ず':'u','つ':'u','づ':'u','ぬ':'u','ふ':'u','ぶ':'u','ぷ':'u','む':'u','ゆ':'u','ゅ':'u','る':'u',
    'え':'e','け':'e','げ':'e','せ':'e','ぜ':'e','て':'e','で':'e','ね':'e','へ':'e','べ':'e','ぺ':'e','め':'e','れ':'e',
    'お':'o','こ':'o','ご':'o','そ':'o','ぞ':'o','と':'o','ど':'o','の':'o','ほ':'o','ぼ':'o','ぽ':'o','も':'o','よ':'o','ょ':'o','ろ':'o','を':'o',
};
// 低い母音(あ/え) → 強く重い印象、高い母音(い) → 弱く軽い印象。う/おはあ寄りとして弱めに加点。
// 5母音の平均が0になるよう中心化してあり、これで文字数(＝文の長さ)だけで
// 強寄りに偏ることを防いでいる（濁音・長音・促音の有無が結果を左右する）
const VOWEL_WEIGHT: Record<Vowel, number> = { a: 0.6, e: 0.6, o: 0.1, u: 0.1, i: -1.4 };

/**
 * フレーズ(単語)の語感から強/弱を1つ決定論的に決める。同じ文字列なら常に同じ結果になる。
 */
function computeWordPressureInstruction(text: string): PressureInstruction {
    let score = 0;
    for (const ch of text) {
        if (DAKUON.has(ch)) score += 2;
        else if (HANDAKUON.has(ch)) score -= 2;
        if (ch === 'ー') score += 1; // 長音
        if (ch === 'っ') score += 1; // 促音（勢いのある印象）
        const vowel = VOWEL_OF[ch];
        if (vowel) score += VOWEL_WEIGHT[vowel];
    }
    return score > 0 ? 'strong' : 'weak';
}

/**
 * フレーズ全体(単語)に対して語感から決めた強/弱を1つ割り当て、
 * 代表的な綴りの全キー位置に同じ指定を敷く（マークは単語の文字全ての上に表示される）。
 * @param text フレーズのひらがな文字列（語感の判定に使う）
 * @param romajiLength そのフレーズを代表的な綴りで打つときの総キー数
 */
export function assignWordTargets(text: string, romajiLength: number): Record<number, PressureInstruction> {
    const targets: Record<number, PressureInstruction> = {};
    if (romajiLength <= 0) return targets;

    const instruction = computeWordPressureInstruction(text);
    for (let i = 0; i < romajiLength; i++) {
        targets[i] = instruction;
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
