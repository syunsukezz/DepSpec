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

/**
 * 文字列リテラル配列の各要素が ValidSpec を満たすことを型レベルで強制するヘルパー。
 * 不正な書式の要素があると、その要素で tsc がコンパイルエラーになる。
 */
export function pressureWords<const T extends readonly string[]>(
    list: T & { [K in keyof T]: ValidSpec<T[K]> }
): T {
    return list;
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
