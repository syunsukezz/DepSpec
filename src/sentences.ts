import type { PressureInstruction } from './pressureHeuristic';

// 難易度レベル
export type Level = 'Easy' | 'Normal' | 'Hard';

export interface PhraseSeed {
    text: string;                                  // ひらがな
    targets: Record<number, PressureInstruction>;   // ローマ字(キー)位置 -> 強/弱（事前計算済み）
}

export interface Centenses {
    phrases: PhraseSeed[];
}

// ── 出題フレーズ(ひらがな)。ここは手で自由に追加・編集してよい ──────────────
// 新しく単語を足したら `npm run generate:pressure` を実行して、下の
// PRECOMPUTED_TARGETS に打鍵圧指定を事前計算すること（未計算の間は指定なし＝マーク非表示で動く）。
export const WORD_LISTS: Record<Level, string[]> = {
    Easy: [
        "いぬ",
        "ねこ",
        "とり",
        "さかな",
        "うま",
        "うし",
        "ぶた",
        "ひつじ",
        "りんご",
        "みかん",
        "ぶどう",
        "もも",
        "さくら",
        "いちご",
        "すいか",
        "たこす",
        "ぴざ",
        "こめ",
        "さーばー",
        "きーぼーど",
        "まうす",
        "ぱそこん",
        "さば",
        "ぬるぽ",
    ],
    Normal: [
        "せぐふぉ",
        "あいおーえす",
        "あんどろいど",
        "うぃんどうず",
        "りなっくす",
        "まっくおーえす",
        "べーしっく",
        "ぱすかる",
        "じゃばすくりぷと",
        "たいぷすくりぷと",
        "ちゃーはん4びっと",
        "しーしゃーぷ",
        "いんたーなるさーばーえらー",
        "やきにくていしょく",
        "すーぱーまりおぶらざーず",
        "どらごんふるーつ",
        "あいすくりーむ",
        "こーひーあいす",
        "ちょこれーとけーき",
        "こんでんえいねんしざいほう",
        "ぐんぶだいじんげんえきぶかんせい",
        "とうきょうとっきょきょかきょく",
        "だけんあつ",
    ],
    Hard: [
        "ふろーとがたは32びっとのふどうしょうすうてん",
        "えーあいをもちいたにそくほこうのろぼっと",
        "すいいてきかんすうじゅうぞくせい",
        "えんたーていんめんとこんぴゅーてぃんぐ2026",
        "あなろぐきーぼーどをもちいただけんあつせんしんぐにもとづくたいぴんぐげーむ",
        "まいんくらふとにおけるけんちくてきいしょうをいかしたぼくせるでふぉるめへんかんしゅほうのていあん",
        "かんこうちにおけるかおはめぱねるとれんどうしたでじたるかぷせるといしすてむのていあん",
    ],
};

// ── ここから下は `npm run generate:pressure`（scripts/generatePressureTargets.ts）で自動生成 ──
// 形態素解析(morpheme.xamrai.com)で単語ごとに分かち書きし、各語の語感(pressureHeuristic.ts)から
// 強/弱を決めて、代表的なローマ字綴りのキー位置に敷いたもの。手で編集しないこと。
// GENERATED:BEGIN
const PRECOMPUTED_TARGETS: Record<string, Record<number, PressureInstruction>> = {
    "いぬ": { 0: 'weak', 1: 'weak', 2: 'weak' },
    "ねこ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong' },
    "とり": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak' },
    "さかな": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "うま": { 0: 'strong', 1: 'strong', 2: 'strong' },
    "うし": { 0: 'weak', 1: 'weak', 2: 'weak' },
    "ぶた": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong' },
    "ひつじ": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak' },
    "りんご": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "みかん": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak' },
    "ぶどう": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong' },
    "もも": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong' },
    "さくら": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "いちご": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak' },
    "すいか": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak' },
    "たこす": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "ぴざ": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak' },
    "こめ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong' },
    "さーばー": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "きーぼーど": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong' },
    "まうす": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong' },
    "ぱそこん": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak' },
    "さば": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong' },
    "ぬるぽ": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak' },
    "せぐふぉ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong' },
    "あいおーえす": { 0: 'weak', 1: 'weak', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong' },
    "あんどろいど": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'weak', 8: 'strong', 9: 'strong' },
    "うぃんどうず": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong' },
    "りなっくす": { 0: 'weak', 1: 'weak', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong' },
    "まっくおーえす": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong' },
    "べーしっく": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong' },
    "ぱすかる": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak' },
    "じゃばすくりぷと": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak' },
    "たいぷすくりぷと": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak', 14: 'weak' },
    "ちゃーはん4びっと": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'weak', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong' },
    "しーしゃーぷ": { 0: 'weak', 1: 'weak', 2: 'strong', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak' },
    "いんたーなるさーばーえらー": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong' },
    "やきにくていしょく": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'strong', 9: 'strong', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak', 14: 'weak', 15: 'weak' },
    "すーぱーまりおぶらざーず": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong' },
    "どらごんふるーつ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong' },
    "あいすくりーむ": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak' },
    "こーひーあいす": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'weak', 4: 'weak', 5: 'strong', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak' },
    "ちょこれーとけーき": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong' },
    "こんでんえいねんしざいほう": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak', 14: 'weak', 15: 'weak', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong' },
    "ぐんぶだいじんげんえきぶかんせい": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'strong', 28: 'strong' },
    "とうきょうとっきょきょかきょく": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak', 14: 'weak', 15: 'weak', 16: 'weak', 17: 'weak', 18: 'weak', 19: 'weak', 20: 'weak', 21: 'weak', 22: 'weak' },
    "だけんあつ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong' },
    "ふろーとがたは32びっとのふどうしょうすうてん": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'weak', 14: 'weak', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'weak', 28: 'weak', 29: 'weak', 30: 'weak', 31: 'weak', 32: 'weak', 33: 'weak', 34: 'weak', 35: 'weak', 36: 'weak', 37: 'weak' },
    "えーあいをもちいたにそくほこうのろぼっと": { 0: 'strong', 1: 'strong', 2: 'weak', 3: 'weak', 4: 'strong', 5: 'strong', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'strong', 13: 'strong', 14: 'weak', 15: 'weak', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'strong', 28: 'strong', 29: 'strong', 30: 'strong', 31: 'strong', 32: 'strong', 33: 'strong' },
    "すいいてきかんすうじゅうぞくせい": { 0: 'weak', 1: 'weak', 2: 'weak', 3: 'weak', 4: 'weak', 5: 'weak', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong' },
    "えんたーていんめんとこんぴゅーてぃんぐ2026": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'strong', 28: 'strong', 29: 'strong', 30: 'strong', 31: 'strong', 32: 'strong', 33: 'strong', 34: 'strong', 35: 'strong' },
    "あなろぐきーぼーどをもちいただけんあつせんしんぐにもとづくたいぴんぐげーむ": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'weak', 18: 'weak', 19: 'weak', 20: 'weak', 21: 'weak', 22: 'weak', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'strong', 28: 'strong', 29: 'weak', 30: 'weak', 31: 'strong', 32: 'strong', 33: 'strong', 34: 'strong', 35: 'strong', 36: 'weak', 37: 'weak', 38: 'strong', 39: 'strong', 40: 'strong', 41: 'strong', 42: 'strong', 43: 'strong', 44: 'weak', 45: 'weak', 46: 'strong', 47: 'strong', 48: 'strong', 49: 'strong', 50: 'strong', 51: 'strong', 52: 'strong', 53: 'strong', 54: 'weak', 55: 'weak', 56: 'weak', 57: 'weak', 58: 'weak', 59: 'weak', 60: 'weak', 61: 'strong', 62: 'strong', 63: 'strong', 64: 'strong', 65: 'strong', 66: 'strong', 67: 'strong' },
    "まいんくらふとにおけるけんちくてきいしょうをいかしたぼくせるでふぉるめへんかんしゅほうのていあん": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'strong', 7: 'strong', 8: 'strong', 9: 'strong', 10: 'strong', 11: 'strong', 12: 'strong', 13: 'strong', 14: 'strong', 15: 'strong', 16: 'strong', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'strong', 25: 'strong', 26: 'strong', 27: 'strong', 28: 'strong', 29: 'strong', 30: 'strong', 31: 'strong', 32: 'strong', 33: 'strong', 34: 'strong', 35: 'strong', 36: 'strong', 37: 'strong', 38: 'strong', 39: 'strong', 40: 'strong', 41: 'strong', 42: 'strong', 43: 'strong', 44: 'strong', 45: 'strong', 46: 'strong', 47: 'strong', 48: 'strong', 49: 'strong', 50: 'strong', 51: 'strong', 52: 'strong', 53: 'strong', 54: 'strong', 55: 'strong', 56: 'strong', 57: 'strong', 58: 'strong', 59: 'strong', 60: 'strong', 61: 'strong', 62: 'strong', 63: 'strong', 64: 'strong', 65: 'strong', 66: 'strong', 67: 'strong', 68: 'strong', 69: 'strong', 70: 'strong', 71: 'strong', 72: 'strong', 73: 'strong', 74: 'strong', 75: 'strong', 76: 'strong', 77: 'strong', 78: 'strong', 79: 'strong', 80: 'strong', 81: 'strong', 82: 'strong', 83: 'strong', 84: 'strong' },
    "かんこうちにおけるかおはめぱねるとれんどうしたでじたるかぷせるといしすてむのていあん": { 0: 'strong', 1: 'strong', 2: 'strong', 3: 'strong', 4: 'strong', 5: 'strong', 6: 'weak', 7: 'weak', 8: 'weak', 9: 'weak', 10: 'weak', 11: 'weak', 12: 'weak', 13: 'weak', 14: 'weak', 15: 'weak', 16: 'weak', 17: 'strong', 18: 'strong', 19: 'strong', 20: 'strong', 21: 'strong', 22: 'strong', 23: 'strong', 24: 'weak', 25: 'weak', 26: 'weak', 27: 'weak', 28: 'weak', 29: 'weak', 30: 'strong', 31: 'strong', 32: 'strong', 33: 'strong', 34: 'strong', 35: 'strong', 36: 'strong', 37: 'strong', 38: 'strong', 39: 'weak', 40: 'weak', 41: 'weak', 42: 'weak', 43: 'strong', 44: 'strong', 45: 'strong', 46: 'strong', 47: 'strong', 48: 'strong', 49: 'strong', 50: 'strong', 51: 'strong', 52: 'strong', 53: 'weak', 54: 'weak', 55: 'weak', 56: 'weak', 57: 'weak', 58: 'weak', 59: 'weak', 60: 'weak', 61: 'weak', 62: 'weak', 63: 'weak', 64: 'weak', 65: 'weak', 66: 'weak', 67: 'weak', 68: 'weak', 69: 'weak', 70: 'weak', 71: 'weak', 72: 'weak', 73: 'weak', 74: 'weak', 75: 'weak', 76: 'weak', 77: 'weak' },
};
// GENERATED:END

function seedOf(text: string): PhraseSeed {
    return { text, targets: PRECOMPUTED_TARGETS[text] ?? {} };
}

const SENTENCES: Record<Level, Centenses> = {
    Easy: { phrases: WORD_LISTS.Easy.map(seedOf) },
    Normal: { phrases: WORD_LISTS.Normal.map(seedOf) },
    Hard: { phrases: WORD_LISTS.Hard.map(seedOf) },
};
export default SENTENCES;
