import type { PressureInstruction } from './pressureHeuristic';
import { parsePressureSpec, pressureWords } from './pressureSpec';

// 難易度レベル
export type Level = 'Easy' | 'Normal' | 'Hard';

export interface PhraseSeed {
    text: string;                                  // ひらがな
    targets: Record<number, PressureInstruction>;   // ローマ字(キー)位置 -> 強/普通/弱
}

export interface Centenses {
    phrases: PhraseSeed[];
}

// ── 出題フレーズ。打鍵圧指定を「かな/マーク」の形でテキストに直接埋め込む(pressureSpec.ts)。
// マークは U(強く) / M(普通) / L(弱く) の1文字。区間ごとに指定でき、
//   例: "ねこ/U"            → 全体を強く
//       "あい/Lおーえす/U"   → 前半"あい"は弱く、後半"おーえす"は強く
// 末尾に `/` の無いかなが続く場合はそこは指定なし(無印)として扱う。マークを一切付けなければ
// 完全に無指定(アイコン非表示)で動く。書式を間違えると tsc がコンパイルエラーにする
// (pressureWords の型検証、詳細は pressureSpec.ts を参照)。
// 新しく単語を足す際、打鍵圧を語感から自動で提案してほしい場合は `npm run generate:pressure`
// (scripts/generatePressureTargets.ts) を実行すると候補が表示される。
export const WORD_LISTS: Record<Level, readonly string[]> = {
    Easy: pressureWords([
        "いぬ/L",
        "ねこ/U",
        "とり/L",
        "さかな/U",
        "うま/U",
        "うし/L",
        "ぶた/U",
        "ひつじ/L",
        "りんご/U",
        "みかん/L",
        "ぶどう/U",
        "もも/U",
        "さくら/U",
        "いちご/L",
        "すいか/L",
        "たこす/U",
        "ぴざ/L",
        "こめ/U",
        "さーばー/U",
        "きーぼーど/U",
        "まうす/U",
        "ぱそこん/L",
        "さば/U",
        "ぬるぽ/L",
    ] as const),
    Normal: pressureWords([
        "せぐふぉ/U",
        "あい/Lおーえす/U",
        "あんどろ/Uい/Lど/U",
        "うぃんどうず/U",
        "り/Lなっくす/U",
        "まっくおーえす/U",
        "べーしっく/U",
        "ぱすかる/L",
        "じゃば/Uすくりぷと/L",
        "たいぷすくりぷと/L",
        "ちゃーはん/U4/Lびっと/U",
        "し/Lー/Uしゃーぷ/L",
        "いんたーなるさーばーえらー/U",
        "やきにく/Lて/Uいしょく/L",
        "すーぱーま/Uりお/Lぶらざーず/U",
        "どらごんふるーつ/U",
        "あいすくりーむ/L",
        "こー/Uひ/Lー/Uあいす/L",
        "ちょこれーとけーき/U",
        "こんでんえ/Uいねんし/Lざいほう/U",
        "ぐんぶだいじんげんえきぶかんせい/U",
        "とうきょうとっきょきょかきょく/L",
        "だけんあつ/U",
    ] as const),
    Hard: pressureWords([
        "ふろーとがたは/U32/Lびっとのふどう/Uしょうすうてん/L",
        "えー/Uあい/Lを/Uもちい/Lた/Uに/Lそくほこうのろぼっと/U",
        "すいいてきかん/Lすうじゅうぞくせい/U",
        "えんたーていんめんとこんぴゅーてぃんぐ2026/U",
        "あなろぐきーぼーどを/Uもちい/Lただけ/Uん/Lあつせ/Uん/Lしんぐ/Uに/Lもとづく/Uたいぴん/Lぐげーむ/U",
        "まいんくらふとにおけるけんちくてきいしょうをいかしたぼくせるでふぉるめへんかんしゅほうのていあん/U",
        "かんこ/Uうちにおける/Lかおはめ/Uぱねる/Lとれんどう/Uした/Lでじたるか/Uぷせるといしすてむのていあん/L",
    ] as const),
};

const SENTENCES: Record<Level, Centenses> = {
    Easy: { phrases: WORD_LISTS.Easy.map(parsePressureSpec) },
    Normal: { phrases: WORD_LISTS.Normal.map(parsePressureSpec) },
    Hard: { phrases: WORD_LISTS.Hard.map(parsePressureSpec) },
};
export default SENTENCES;
