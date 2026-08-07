// まだ打鍵圧マーク("/U" "/M" "/L")の付いていないフレーズについて、形態素解析
// (morpheme.xamrai.com)で単語ごとに分かち書きし、各語の語感(pressureHeuristic.ts)から
// "かな/マーク" 形式の指定案をコンソールに出力する。
//
// 実行: npm run generate:pressure
//
// sentences.ts は現在は人が手で編集する前提のフォーマットになっているため、
// このスクリプトは sentences.ts を直接書き換えない。出力された案をそのまま
// WORD_LISTS に貼り付けるか、手で調整して使うかは人が判断すること。
// (Mは語感からは自動で決まらないため、ここでは strong(U)/weak(L) のみ提案する)

import { computeWordPressureInstruction } from '../src/pressureHeuristic.ts';
import { pairPressureWords } from '../src/pressureSpec.ts';
import { WORD_LISTS } from '../src/sentences.ts';

const API_URL = 'https://morpheme.xamrai.com/api/';
const REQUEST_DELAY_MS = 300; // 公開APIへの配慮のため1件ずつ間隔を空ける

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

interface MorphemeApiResponse {
    STATUS_TEXT: string;
    RETURN_VALUE?: { ANALYSIS_RESULTS: string[] };
}

/** 形態素解析APIで分かち書きする。失敗・想定外レスポンス時は null(呼び出し側でフォールバック) */
async function segmentIntoWords(text: string): Promise<string[] | null> {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputtext: text }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as MorphemeApiResponse;
        if (data.STATUS_TEXT !== 'OK' || !data.RETURN_VALUE) return null;

        const words = data.RETURN_VALUE.ANALYSIS_RESULTS
            .filter(line => line !== 'EOS')
            .map(line => line.split('\t')[0]);

        // 分かち書きを結合して元の文字列と完全一致するかを検証する(ズレたら使わない)
        if (words.length === 0 || words.join('') !== text) return null;
        return words;
    } catch {
        return null;
    }
}

const MARK: Record<'strong' | 'weak', 'U' | 'L'> = { strong: 'U', weak: 'L' };

/** フレーズを単語ごとに分かち書きし、各語の語感から "かな/マーク" 形式の指定案を作る */
async function suggestSpec(text: string): Promise<string> {
    const words = await segmentIntoWords(text);
    const segments = words && words.length > 1 ? words : [text];
    return segments.map(w => `${w}/${MARK[computeWordPressureInstruction(w)]}`).join('');
}

async function main() {
    // WORD_LISTS は [表示文, 指定, 表示文, 指定, ...] の交互配列なので、指定(奇数番目)だけを見る
    const allSpecs = [...new Set(
        Object.values(WORD_LISTS).flatMap(list => pairPressureWords(list).map(p => p.spec)),
    )];
    const unmarked = allSpecs.filter(spec => !spec.includes('/'));

    console.log(`対象フレーズ数: ${allSpecs.length} (うち未指定: ${unmarked.length})`);
    if (unmarked.length === 0) {
        console.log('すべてのフレーズに打鍵圧マークが付いています。');
        return;
    }

    for (const [i, text] of unmarked.entries()) {
        const spec = await suggestSpec(text);
        console.log(`[${i + 1}/${unmarked.length}] ${JSON.stringify(spec)},`);
        await sleep(REQUEST_DELAY_MS);
    }
    console.log('\n上記の案を sentences.ts の WORD_LISTS に貼り付けてください(必要なら手で調整)。');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
