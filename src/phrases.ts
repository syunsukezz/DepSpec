export type PressureInstruction = 'strong' | 'weak' | 'vibrato';




export function normalizeN(n: number): number {
    return Math.min(1, Math.max(0, (n - 1) / 1));
}

// 閾値
const STRONG_THRESHOLD = 0.55; // 正規化値でこれ以上 → 強く
const WEAK_THRESHOLD   = 0.35; // 正規化値でこれ以下 → 弱く
const VIBRATO_STDDEV   = 0.4;  // log空間の標準偏差でこれ以上 → ビブラート

export interface PhraseData {
    text: string;               // ひらがな
    instruction: PressureInstruction;
    targets: number[];          // strong/weak: 対象ひらがなのインデックス (0-based)
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
    allPressures: number[];     // 全キープレス時の打鍵圧 (振動判定用)
}

const PHRASE_POOL: string[] = [
    "あいうえお",
    "かきくけこ",
    "さしすせそ",
    "たちつてと",
    "なにぬねの",
    "はひふへほ",
    "まみむめも",
    "らりるれろ",
    "がぎぐげご",
    "ざじずぜぞ",
    "ばびぶべぼ",
    "ぱぴぷぺぽ",
    "こんにちは",
    "ありがとうございます",
    "すみません",
    "がんばれ",
    "さくらがさいた",
    "なつのそら",
    "ふゆはさむい",
    "はるのかぜ",
    "あきのもみじ",
    "たいぴんぐ",
    "にほんご",
    "きょうはいいてんき",
    "やまとざくら",
    "かわのながれ",
    "しろいくも",
    "あおいそら",
    "みどりのは",
    "うみのかなた",
    "そらにきらめく",
    "たのしいげーむ",
    "すばやくうつ",
    "ちからをこめて",
    "やさしくたたく",
    "いきをあわせて",
];

const INSTRUCTIONS: PressureInstruction[] = ['strong', 'weak', 'vibrato'];

export function generatePhrase(): PhraseData {
    const text = PHRASE_POOL[Math.floor(Math.random() * PHRASE_POOL.length)];
    const instruction = INSTRUCTIONS[Math.floor(Math.random() * INSTRUCTIONS.length)];
    const chars = [...text];

    let targets: number[] = [];
    if (instruction !== 'vibrato') {
        const count = Math.min(Math.floor(Math.random() * 3) + 1, chars.length);
        // ランダムに count 個選ぶ（重複なし）
        const indices = Array.from({ length: chars.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        targets = indices.slice(0, count).sort((a, b) => a - b);
    }

    return { text, instruction, targets, charPressures: {}, allPressures: [] };
}

/**
 * フレーズの打鍵圧からクリア数を返す
 * - strong/weak: クリアしたターゲット文字の数（0〜targets.length）
 * - vibrato:     クリアなら1、そうでなければ0
 */
export function countPressureClears(phrase: PhraseData): number {
    const { instruction, targets, charPressures, allPressures } = phrase;

    if (instruction === 'strong') {
        return targets.filter(idx => {
            const n = charPressures[idx];
            return n !== undefined && normalizeN(n) >= STRONG_THRESHOLD;
        }).length;
    }
    if (instruction === 'weak') {
        return targets.filter(idx => {
            const n = charPressures[idx];
            return n !== undefined && normalizeN(n) <= WEAK_THRESHOLD;
        }).length;
    }
    // vibrato: 1 or 0
    if (allPressures.length < 2) return 0;
    const logs = allPressures.map(n => Math.log(Math.max(n, 0.01)));
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
    return Math.sqrt(variance) >= VIBRATO_STDDEV ? 1 : 0;
}

export const INSTRUCTION_LABEL: Record<PressureInstruction, { symbol: string; color: string; name: string }> = {
    strong:  { symbol: '▲', color: '#dc2626', name: '強く' },
    weak:    { symbol: '▼', color: '#2563eb', name: '弱く' },
    vibrato: { symbol: '〜', color: '#16a34a', name: 'ビブラート' },
};
