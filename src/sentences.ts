import { keygraph } from './keygraph.js';
import type { PressureInstruction } from './pressureHeuristic';
import sentencesData from './data/sentences.json';

// 難易度レベル
export type Level = 'Easy' | 'Normal' | 'Hard';

export interface PhraseSeed {
    text: string;                                  // ひらがな(タイピング用)
    displayText: string;                           // 漢字混じり文(表示専用。タイピングには使わない)
    targets: Record<number, PressureInstruction>;   // ローマ字(キー)位置 -> 強/普通/弱
    displayTargets: Record<number, PressureInstruction>; // displayText の文字位置 -> 強/普通/弱
}

export interface Centenses {
    phrases: PhraseSeed[];
}

// ── 出題フレーズのデータは src/data/sentences.json に持つ ──────────────────
// 台本には場面ごとの流れがあるため、ランダムではなく JSON に登録された順番で出題する
// (Scrapbox「アナログキーボードを用いた打鍵圧センシングに基づくタイピングゲーム_ステージ」の
// 「claudeの案」シナリオ台本をひらがな化して収録。会議・セール・授業 / 商談・発表・ようつべ /
// 演説・説得 の各シーン)。
//
// タイピングデータ(フレーズ本文・打鍵圧指定)は別プロジェクトのGUIエディタで編集する運用に
// なったため、このTSソースには埋め込まず sentences.json を読み込む形にしている。
//
// JSON の形式: レベルごとにフレーズの配列を持ち、各フレーズは「セグメント」の配列。
// 1セグメント = { kanji: 漢字混じり文の対応部分, kana: そのひらがな読み, mark: 打鍵圧指定 }。
// セグメントを左から順に連結すると displayText(kanji)・text(kana) それぞれの全文になる。
//   例: [{kanji:"企画部の", kana:"きかくぶの", mark:"normal"},
//        {kanji:"吉田",     kana:"よしだ",     mark:"strong"},
//        {kanji:"から",     kana:"から",       mark:null}]
//   → text = "きかくぶのよしだから", displayText = "企画部の吉田から"
//     "吉田"(ローマ字・漢字とも該当区間全体)だけ強く打鍵する指定。
//
// mark は "strong"(強く) / "normal"(普通に) / "weak"(弱く) / null(指定なし)。
// null のセグメントは targets/displayTargets に一切登録されない(無印として扱う)。
//
// 数字は読み仮名ではなく数字そのもの(半角数字)をタイプさせる。単位・助数詞
// (円/名/人/万/ヶ月/年/パーセントなど)は数字ではなく語なのでひらがな読みのままでよい。
//   例: "20名" → kana "20めい" / "3ヶ月" → kana "3かげつ" / "40%" → kana "40ぱーせんと"
// keygraph が全角句読点や大文字アルファベットを扱えないため、句読点・記号は除去し、
// カタカナ・漢字・英単語はひらがな読みに置き換えている(英字は小文字にする)。

interface SegmentJson {
    kanji: string;
    kana: string;
    mark: PressureInstruction | null;
}
interface PhraseJson {
    segments: SegmentJson[];
}
type SentencesJson = Record<Level, PhraseJson[]>;

const VALID_MARKS = new Set<PressureInstruction>(['strong', 'normal', 'weak']);

/** JSONの形式(mark の値など)を実行時に検証する。GUIエディタ側の誤入力を早期に検知するため。 */
function validateSentencesData(raw: unknown): SentencesJson {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('sentences.json: トップレベルはオブジェクトである必要があります');
    }
    for (const level of ['Easy', 'Normal', 'Hard'] as const) {
        const phrases = (raw as Record<string, unknown>)[level];
        if (!Array.isArray(phrases)) {
            throw new Error(`sentences.json: "${level}" は配列である必要があります`);
        }
        phrases.forEach((phrase, phraseIdx) => {
            const segments = (phrase as { segments?: unknown })?.segments;
            if (!Array.isArray(segments) || segments.length === 0) {
                throw new Error(`sentences.json: ${level}[${phraseIdx}].segments が不正です`);
            }
            segments.forEach((seg, segIdx) => {
                const s = seg as Partial<SegmentJson>;
                if (typeof s.kanji !== 'string' || typeof s.kana !== 'string') {
                    throw new Error(`sentences.json: ${level}[${phraseIdx}].segments[${segIdx}] の kanji/kana が不正です`);
                }
                if (s.mark !== null && !VALID_MARKS.has(s.mark as PressureInstruction)) {
                    throw new Error(
                        `sentences.json: ${level}[${phraseIdx}].segments[${segIdx}].mark が不正です ("strong"/"normal"/"weak"/null のいずれかである必要があります): ${JSON.stringify(s.mark)}`,
                    );
                }
            });
        });
    }
    return raw as SentencesJson;
}

const SENTENCES_DATA = validateSentencesData(sentencesData);

function seedsOf(level: Level): PhraseSeed[] {
    return SENTENCES_DATA[level].map(({ segments }) => {
        let text = '';
        let displayText = '';
        const targets: Record<number, PressureInstruction> = {};
        const displayTargets: Record<number, PressureInstruction> = {};
        let keyOffset = 0;
        let charOffset = 0;

        for (const seg of segments) {
            text += seg.kana;
            displayText += seg.kanji;

            keygraph.build(seg.kana);
            const keyLen = keygraph.key_candidate().length;
            const charLen = [...seg.kanji].length;

            if (seg.mark !== null) {
                for (let k = 0; k < keyLen; k++) targets[keyOffset + k] = seg.mark;
                for (let c = 0; c < charLen; c++) displayTargets[charOffset + c] = seg.mark;
            }
            keyOffset += keyLen;
            charOffset += charLen;
        }

        return { text, displayText, targets, displayTargets };
    });
}

const SENTENCES: Record<Level, Centenses> = {
    Easy: { phrases: seedsOf('Easy') },
    Normal: { phrases: seedsOf('Normal') },
    Hard: { phrases: seedsOf('Hard') },
};
export default SENTENCES;
