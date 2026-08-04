// 語感（音象徴）に基づく打鍵圧指定の判定ロジック。
// 参考: https://qiita.com/Hirata-Masato/items/775ecd86f26f305fd393
// 「濁音・長音・低い母音(あ/え)ほど強く/重く感じられ、半濁音・高い母音(い)ほど弱く/軽く感じられる」
// という音象徴(Frequency Code)の傾向をスコア化し、単語ごとに1つの強/弱を決定論的に決める。
//
// ランタイム(phrases.ts の生成フォールバック)と、事前計算スクリプト
// (scripts/generatePressureTargets.ts)の両方から参照する純粋関数のみを置く。

// 'normal'(普通)は語感ヒューリスティックからは決まらず、人が手動で指定した場合にのみ使う
// (pressureSpec.ts の "/M" マーク)。
export type PressureInstruction = 'strong' | 'normal' | 'weak';

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
// 5母音の平均が0になるよう中心化してあり、これで文字数(＝語の長さ)だけで
// 強寄りに偏ることを防いでいる（濁音・長音・促音の有無が結果を左右する）
const VOWEL_WEIGHT: Record<Vowel, number> = { a: 0.6, e: 0.6, o: 0.1, u: 0.1, i: -1.4 };

/**
 * 語(単語)の語感から強/弱を1つ決定論的に決める。同じ文字列なら常に同じ結果になる。
 * @param text ひらがな文字列(1単語相当。形態素解析の分かち書き単位を想定)
 */
export function computeWordPressureInstruction(text: string): PressureInstruction {
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
