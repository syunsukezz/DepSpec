export type PressureInstruction = 'strong' | 'weak';




export function normalizeN(n: number): number {
    return Math.min(1, Math.max(0, (n*5 - 4) / 2));
}

// 打鍵圧のカテゴリ: 正規化値(0〜1)を3等分して 弱い / 普通 / 強い に分類する
export type PressureLevel = 'weak' | 'normal' | 'strong';
const LEVEL_LOW  = 1 / 3; // これ未満 → 弱い
const LEVEL_HIGH = 2 / 3; // これ以上 → 強い

export function pressureLevel(n: number): PressureLevel {
    const t = normalizeN(n);
    if (t < LEVEL_LOW) return 'weak';
    if (t < LEVEL_HIGH) return 'normal';
    return 'strong';
}

const MAX_MARKS = 3; // 1文に付けられるアイコンの最大数

export interface PhraseData {
    text: string;               // ひらがな
    // 文字インデックス(0-based) -> 強/弱。1文に強・弱が混在してよい (最大 MAX_MARKS 個)
    targets: Record<number, PressureInstruction>;
    charPressures: Record<number, number>; // ひらがな完了時の打鍵圧 (index -> N)
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

/**
 * @param withTargets false の場合は強/弱アイコンを付けない（通常キーボード用ベースライン）
 */
export function generatePhrase(withTargets = true): PhraseData {
    const text = PHRASE_POOL[Math.floor(Math.random() * PHRASE_POOL.length)];
    const chars = [...text];

    if (!withTargets) {
        return { text, targets: {}, charPressures: {} };
    }

    // 対象の文字を重複なくランダムに最大 MAX_MARKS 個選び、各文字に強/弱を割り当てる
    const count = Math.min(Math.floor(Math.random() * MAX_MARKS) + 1, chars.length);
    const indices = Array.from({ length: chars.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const targets: Record<number, PressureInstruction> = {};
    for (const idx of indices.slice(0, count)) {
        targets[idx] = Math.random() < 0.5 ? 'strong' : 'weak';
    }

    return { text, targets, charPressures: {} };
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
