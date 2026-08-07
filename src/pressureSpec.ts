// 打鍵圧指定を「ひらがな本文に埋め込む」形の人間編集向けフォーマット。
// 「区間/マーク」の繰り返しで書く。マークは U(強く) / M(普通) / L(弱く) の1文字。
//   例: "いぬ/L"              → 全体を弱く
//       "あい/Lおーえす/U"     → 前半"あい"は弱く、後半"おーえす"は強く
// 末尾に `/` の無い残りのひらがなが続く場合は、そこは指定なし(無印)として扱う。
//
// ValidSpec<S> は文字列リテラル型 S がこの書式に沿っているかを型レベルで検証する。
// `/` の直後が U/M/L のいずれでもない場合や、マークの直後に文字が無い場合は S を never にし、
// sentences.ts でこの型を通した配列に不正な文字列リテラルを書くと tsc がコンパイルエラーにする。

import { keygraph } from './keygraph.js';
import type { PressureInstruction } from './pressureHeuristic';

const MARK_TO_INSTRUCTION = {
    U: 'strong',
    M: 'normal',
    L: 'weak',
} as const satisfies Record<string, PressureInstruction>;

type Mark = keyof typeof MARK_TO_INSTRUCTION;

// `/Mark` を1つ消費して残りの文字列を返す型レベル関数。
// - `/` が無ければ S 自身を返す(そこで完了)。
// - `/` の直後がマークでなければ never(不正な書式)。
type Step<S extends string> =
    S extends `${string}/${infer M0}${infer Rest}`
        ? M0 extends Mark ? Rest : never
        : S;

// これ以上 `/` が残っていなければ true (完了)
type Done<S extends string> = S extends `${string}/${string}` ? false : true;

// TypeScript の条件型は「naked な型引数を never に適用すると即 never になる」性質を持つため、
// 自己再帰の ValidSpec<Rest> をジェネリック推論(配列の各要素を検証する文脈)の中で直接呼ぶと、
// 有効な文字列まで never に潰れてしまう問題があった。そのため自己参照を避け、段ごとに named な
// 型として書き下し、各段の先頭で「前段が既に never なら即 never」を明示ガードしている。
// 実運用のフレーズで `/` が24個を超えることは無い想定だが、安全のため24段まで許容する。
type L0<S extends string> = S;
type L1<S extends string> = L0<S> extends never ? never : Done<L0<S> & string> extends true ? L0<S> : Step<L0<S> & string> extends never ? never : Step<L0<S> & string> & string;
type L2<S extends string> = L1<S> extends never ? never : Done<L1<S> & string> extends true ? L1<S> : Step<L1<S> & string> extends never ? never : Step<L1<S> & string> & string;
type L3<S extends string> = L2<S> extends never ? never : Done<L2<S> & string> extends true ? L2<S> : Step<L2<S> & string> extends never ? never : Step<L2<S> & string> & string;
type L4<S extends string> = L3<S> extends never ? never : Done<L3<S> & string> extends true ? L3<S> : Step<L3<S> & string> extends never ? never : Step<L3<S> & string> & string;
type L5<S extends string> = L4<S> extends never ? never : Done<L4<S> & string> extends true ? L4<S> : Step<L4<S> & string> extends never ? never : Step<L4<S> & string> & string;
type L6<S extends string> = L5<S> extends never ? never : Done<L5<S> & string> extends true ? L5<S> : Step<L5<S> & string> extends never ? never : Step<L5<S> & string> & string;
type L7<S extends string> = L6<S> extends never ? never : Done<L6<S> & string> extends true ? L6<S> : Step<L6<S> & string> extends never ? never : Step<L6<S> & string> & string;
type L8<S extends string> = L7<S> extends never ? never : Done<L7<S> & string> extends true ? L7<S> : Step<L7<S> & string> extends never ? never : Step<L7<S> & string> & string;
type L9<S extends string> = L8<S> extends never ? never : Done<L8<S> & string> extends true ? L8<S> : Step<L8<S> & string> extends never ? never : Step<L8<S> & string> & string;
type L10<S extends string> = L9<S> extends never ? never : Done<L9<S> & string> extends true ? L9<S> : Step<L9<S> & string> extends never ? never : Step<L9<S> & string> & string;
type L11<S extends string> = L10<S> extends never ? never : Done<L10<S> & string> extends true ? L10<S> : Step<L10<S> & string> extends never ? never : Step<L10<S> & string> & string;
type L12<S extends string> = L11<S> extends never ? never : Done<L11<S> & string> extends true ? L11<S> : Step<L11<S> & string> extends never ? never : Step<L11<S> & string> & string;
type L13<S extends string> = L12<S> extends never ? never : Done<L12<S> & string> extends true ? L12<S> : Step<L12<S> & string> extends never ? never : Step<L12<S> & string> & string;
type L14<S extends string> = L13<S> extends never ? never : Done<L13<S> & string> extends true ? L13<S> : Step<L13<S> & string> extends never ? never : Step<L13<S> & string> & string;
type L15<S extends string> = L14<S> extends never ? never : Done<L14<S> & string> extends true ? L14<S> : Step<L14<S> & string> extends never ? never : Step<L14<S> & string> & string;
type L16<S extends string> = L15<S> extends never ? never : Done<L15<S> & string> extends true ? L15<S> : Step<L15<S> & string> extends never ? never : Step<L15<S> & string> & string;
type L17<S extends string> = L16<S> extends never ? never : Done<L16<S> & string> extends true ? L16<S> : Step<L16<S> & string> extends never ? never : Step<L16<S> & string> & string;
type L18<S extends string> = L17<S> extends never ? never : Done<L17<S> & string> extends true ? L17<S> : Step<L17<S> & string> extends never ? never : Step<L17<S> & string> & string;
type L19<S extends string> = L18<S> extends never ? never : Done<L18<S> & string> extends true ? L18<S> : Step<L18<S> & string> extends never ? never : Step<L18<S> & string> & string;
type L20<S extends string> = L19<S> extends never ? never : Done<L19<S> & string> extends true ? L19<S> : Step<L19<S> & string> extends never ? never : Step<L19<S> & string> & string;
type L21<S extends string> = L20<S> extends never ? never : Done<L20<S> & string> extends true ? L20<S> : Step<L20<S> & string> extends never ? never : Step<L20<S> & string> & string;
type L22<S extends string> = L21<S> extends never ? never : Done<L21<S> & string> extends true ? L21<S> : Step<L21<S> & string> extends never ? never : Step<L21<S> & string> & string;
type L23<S extends string> = L22<S> extends never ? never : Done<L22<S> & string> extends true ? L22<S> : Step<L22<S> & string> extends never ? never : Step<L22<S> & string> & string;
type L24<S extends string> = L23<S> extends never ? never : Done<L23<S> & string> extends true ? L23<S> : Step<L23<S> & string> extends never ? never : Step<L23<S> & string> & string;

/** S が「区間/マーク」書式に沿っていれば S 自身、そうでなければ never。 */
export type ValidSpec<S extends string> =
    L24<S> extends never ? never : Done<L24<S> & string> extends true ? S : never;

// pressureWords には [表示文, 指定, 表示文, 指定, ...] のように、漢字混じりの表示文と
// 打鍵圧指定を交互に並べた配列を渡す。表示文と指定を別々の配列で持つと、文の区切りを
// 変えるたびに両方をズレなく直す必要があり事故りやすいため、隣接するペアとして書く。
//
// 型レベルでは「先頭から2要素ずつ取り出し、奇数番目(指定)だけ ValidSpec で検証する」処理を
// 上の ValidSpec と同じ理由(自己再帰をジェネリック推論の中で直接呼ぶと有効な値まで never に
// 潰れる問題)で、段ごとに named な型として書き下している。1段で1ペア(2要素)を消費する。
// レベルごとの最大フレーズ数(現状36件)を超えないよう、余裕を見て40段まで許容する。
type PStep<S extends readonly string[]> =
    S extends readonly [string, infer Spec extends string, ...infer Rest extends readonly string[]]
        ? ValidSpec<Spec> extends never ? never : Rest
        : S;
type PDone<S extends readonly string[]> = S extends readonly [] ? true : false;

type P0<S extends readonly string[]> = S;
type P1<S extends readonly string[]> = P0<S> extends never ? never : PDone<P0<S>> extends true ? P0<S> : PStep<P0<S>> extends never ? never : PStep<P0<S>>;
type P2<S extends readonly string[]> = P1<S> extends never ? never : PDone<P1<S>> extends true ? P1<S> : PStep<P1<S>> extends never ? never : PStep<P1<S>>;
type P3<S extends readonly string[]> = P2<S> extends never ? never : PDone<P2<S>> extends true ? P2<S> : PStep<P2<S>> extends never ? never : PStep<P2<S>>;
type P4<S extends readonly string[]> = P3<S> extends never ? never : PDone<P3<S>> extends true ? P3<S> : PStep<P3<S>> extends never ? never : PStep<P3<S>>;
type P5<S extends readonly string[]> = P4<S> extends never ? never : PDone<P4<S>> extends true ? P4<S> : PStep<P4<S>> extends never ? never : PStep<P4<S>>;
type P6<S extends readonly string[]> = P5<S> extends never ? never : PDone<P5<S>> extends true ? P5<S> : PStep<P5<S>> extends never ? never : PStep<P5<S>>;
type P7<S extends readonly string[]> = P6<S> extends never ? never : PDone<P6<S>> extends true ? P6<S> : PStep<P6<S>> extends never ? never : PStep<P6<S>>;
type P8<S extends readonly string[]> = P7<S> extends never ? never : PDone<P7<S>> extends true ? P7<S> : PStep<P7<S>> extends never ? never : PStep<P7<S>>;
type P9<S extends readonly string[]> = P8<S> extends never ? never : PDone<P8<S>> extends true ? P8<S> : PStep<P8<S>> extends never ? never : PStep<P8<S>>;
type P10<S extends readonly string[]> = P9<S> extends never ? never : PDone<P9<S>> extends true ? P9<S> : PStep<P9<S>> extends never ? never : PStep<P9<S>>;
type P11<S extends readonly string[]> = P10<S> extends never ? never : PDone<P10<S>> extends true ? P10<S> : PStep<P10<S>> extends never ? never : PStep<P10<S>>;
type P12<S extends readonly string[]> = P11<S> extends never ? never : PDone<P11<S>> extends true ? P11<S> : PStep<P11<S>> extends never ? never : PStep<P11<S>>;
type P13<S extends readonly string[]> = P12<S> extends never ? never : PDone<P12<S>> extends true ? P12<S> : PStep<P12<S>> extends never ? never : PStep<P12<S>>;
type P14<S extends readonly string[]> = P13<S> extends never ? never : PDone<P13<S>> extends true ? P13<S> : PStep<P13<S>> extends never ? never : PStep<P13<S>>;
type P15<S extends readonly string[]> = P14<S> extends never ? never : PDone<P14<S>> extends true ? P14<S> : PStep<P14<S>> extends never ? never : PStep<P14<S>>;
type P16<S extends readonly string[]> = P15<S> extends never ? never : PDone<P15<S>> extends true ? P15<S> : PStep<P15<S>> extends never ? never : PStep<P15<S>>;
type P17<S extends readonly string[]> = P16<S> extends never ? never : PDone<P16<S>> extends true ? P16<S> : PStep<P16<S>> extends never ? never : PStep<P16<S>>;
type P18<S extends readonly string[]> = P17<S> extends never ? never : PDone<P17<S>> extends true ? P17<S> : PStep<P17<S>> extends never ? never : PStep<P17<S>>;
type P19<S extends readonly string[]> = P18<S> extends never ? never : PDone<P18<S>> extends true ? P18<S> : PStep<P18<S>> extends never ? never : PStep<P18<S>>;
type P20<S extends readonly string[]> = P19<S> extends never ? never : PDone<P19<S>> extends true ? P19<S> : PStep<P19<S>> extends never ? never : PStep<P19<S>>;
type P21<S extends readonly string[]> = P20<S> extends never ? never : PDone<P20<S>> extends true ? P20<S> : PStep<P20<S>> extends never ? never : PStep<P20<S>>;
type P22<S extends readonly string[]> = P21<S> extends never ? never : PDone<P21<S>> extends true ? P21<S> : PStep<P21<S>> extends never ? never : PStep<P21<S>>;
type P23<S extends readonly string[]> = P22<S> extends never ? never : PDone<P22<S>> extends true ? P22<S> : PStep<P22<S>> extends never ? never : PStep<P22<S>>;
type P24<S extends readonly string[]> = P23<S> extends never ? never : PDone<P23<S>> extends true ? P23<S> : PStep<P23<S>> extends never ? never : PStep<P23<S>>;
type P25<S extends readonly string[]> = P24<S> extends never ? never : PDone<P24<S>> extends true ? P24<S> : PStep<P24<S>> extends never ? never : PStep<P24<S>>;
type P26<S extends readonly string[]> = P25<S> extends never ? never : PDone<P25<S>> extends true ? P25<S> : PStep<P25<S>> extends never ? never : PStep<P25<S>>;
type P27<S extends readonly string[]> = P26<S> extends never ? never : PDone<P26<S>> extends true ? P26<S> : PStep<P26<S>> extends never ? never : PStep<P26<S>>;
type P28<S extends readonly string[]> = P27<S> extends never ? never : PDone<P27<S>> extends true ? P27<S> : PStep<P27<S>> extends never ? never : PStep<P27<S>>;
type P29<S extends readonly string[]> = P28<S> extends never ? never : PDone<P28<S>> extends true ? P28<S> : PStep<P28<S>> extends never ? never : PStep<P28<S>>;
type P30<S extends readonly string[]> = P29<S> extends never ? never : PDone<P29<S>> extends true ? P29<S> : PStep<P29<S>> extends never ? never : PStep<P29<S>>;
type P31<S extends readonly string[]> = P30<S> extends never ? never : PDone<P30<S>> extends true ? P30<S> : PStep<P30<S>> extends never ? never : PStep<P30<S>>;
type P32<S extends readonly string[]> = P31<S> extends never ? never : PDone<P31<S>> extends true ? P31<S> : PStep<P31<S>> extends never ? never : PStep<P31<S>>;
type P33<S extends readonly string[]> = P32<S> extends never ? never : PDone<P32<S>> extends true ? P32<S> : PStep<P32<S>> extends never ? never : PStep<P32<S>>;
type P34<S extends readonly string[]> = P33<S> extends never ? never : PDone<P33<S>> extends true ? P33<S> : PStep<P33<S>> extends never ? never : PStep<P33<S>>;
type P35<S extends readonly string[]> = P34<S> extends never ? never : PDone<P34<S>> extends true ? P34<S> : PStep<P34<S>> extends never ? never : PStep<P34<S>>;
type P36<S extends readonly string[]> = P35<S> extends never ? never : PDone<P35<S>> extends true ? P35<S> : PStep<P35<S>> extends never ? never : PStep<P35<S>>;
type P37<S extends readonly string[]> = P36<S> extends never ? never : PDone<P36<S>> extends true ? P36<S> : PStep<P36<S>> extends never ? never : PStep<P36<S>>;
type P38<S extends readonly string[]> = P37<S> extends never ? never : PDone<P37<S>> extends true ? P37<S> : PStep<P37<S>> extends never ? never : PStep<P37<S>>;
type P39<S extends readonly string[]> = P38<S> extends never ? never : PDone<P38<S>> extends true ? P38<S> : PStep<P38<S>> extends never ? never : PStep<P38<S>>;
type P40<S extends readonly string[]> = P39<S> extends never ? never : PDone<P39<S>> extends true ? P39<S> : PStep<P39<S>> extends never ? never : PStep<P39<S>>;

/** S(交互配列)の指定(奇数番目)が全てValidSpecを満たし、かつ要素数が偶数(ペアが揃っている)なら S 自身、そうでなければ never。 */
type ValidInterleaved<S extends readonly string[]> =
    P40<S> extends never ? never : PDone<P40<S>> extends true ? S : never;

/**
 * [表示文, 指定, 表示文, 指定, ...] の交互配列を受け取るヘルパー。
 * 奇数番目(指定)の要素が ValidSpec の書式を満たさない場合や、要素数が奇数(ペアが
 * 揃っていない)場合に tsc がコンパイルエラーにする。
 */
export function pressureWords<const T extends readonly string[]>(
    list: T & ValidInterleaved<T>
): T {
    return list;
}

export interface PressureWordPair {
    displayText: string; // 漢字混じりの表示文
    spec: string;         // 打鍵圧指定付きのひらがな("かな/マーク" 形式)
}

/** pressureWords で作った交互配列を [表示文, 指定] のペア配列に変換する。 */
export function pairPressureWords(list: readonly string[]): PressureWordPair[] {
    const pairs: PressureWordPair[] = [];
    for (let i = 0; i < list.length; i += 2) {
        pairs.push({ displayText: list[i], spec: list[i + 1] });
    }
    return pairs;
}

export interface ParsedPhrase {
    text: string; // マークを除いたひらがな文字列
    targets: Record<number, PressureInstruction>; // ローマ字(キー)位置 -> 強/普通/弱
}

/**
 * "いぬ/L" のような表記をパースし、マーク無しのひらがな文字列と
 * ローマ字(キー)位置ごとの打鍵圧指定を得る。
 * keygraph で区間ごとのローマ字綴りのキー数を数え、その区間の全キー位置に
 * 同じ指定を敷く(scripts/generatePressureTargets.ts の考え方を踏襲)。
 * `pressureWords` で型検証済みの文字列を渡す前提だが、想定外の入力(動的な文字列等)に
 * 備えて実行時にも書式チェックし、不正なら Error を投げる。
 */
export function parsePressureSpec(spec: string): ParsedPhrase {
    let text = '';
    const targets: Record<number, PressureInstruction> = {};
    let keyOffset = 0;
    let cursor = 0;

    while (cursor < spec.length) {
        const slashIdx = spec.indexOf('/', cursor);
        if (slashIdx === -1) {
            text += spec.slice(cursor); // 末尾の無印区間
            break;
        }
        const segment = spec.slice(cursor, slashIdx);
        const mark = spec[slashIdx + 1];
        if (mark !== 'U' && mark !== 'M' && mark !== 'L') {
            throw new Error(
                `不正な打鍵圧指定です: "${spec}" ( "/" の直後は U(強)/M(普通)/L(弱) のいずれかである必要があります )`,
            );
        }

        keygraph.build(segment);
        const keyLen = keygraph.key_candidate().length;
        const instruction = MARK_TO_INSTRUCTION[mark];
        for (let k = 0; k < keyLen; k++) targets[keyOffset + k] = instruction;
        keyOffset += keyLen;
        text += segment;
        cursor = slashIdx + 2;
    }

    return { text, targets };
}
