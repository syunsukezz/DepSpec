// 各フレーズを形態素解析(morpheme.xamrai.com)で単語ごとに分かち書きし、
// 各語の語感(pressureHeuristic.ts)から強/弱を決定、keygraph で代表的なローマ字の
// キー位置へマッピングして sentences.ts の PRECOMPUTED_TARGETS を書き換える。
//
// 実行: npm run generate:pressure
//
// 形態素解析の分かち書きの継ぎ目が、実際のローマ字入力のキー区切りと
// ズレる場合（分割結果のキー数合計とフレーズ全体を1回で build した場合の
// キー数が一致しない場合）は、そのフレーズだけ「フレーズ全体を1語」として
// 安全にフォールバックする。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { keygraph } from '../src/keygraph.js';
import { computeWordPressureInstruction, type PressureInstruction } from '../src/pressureHeuristic.ts';
import { WORD_LISTS } from '../src/sentences.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SENTENCES_PATH = resolve(__dirname, '../src/sentences.ts');
const API_URL = 'https://morpheme.xamrai.com/api/';
const REQUEST_DELAY_MS = 300; // 公開APIへの配慮のため1件ずつ間隔を空ける

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

interface MorphemeApiResponse {
    STATUS_TEXT: string;
    RETURN_VALUE?: { ANALYSIS_RESULTS: string[] };
}

/** 形態素解析APIで分かち書きする。失敗・想定外レスポンス時は null（呼び出し側でフォールバック） */
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

        // 分かち書きを結合して元の文字列と完全一致するかを検証する（ズレたら使わない）
        if (words.length === 0 || words.join('') !== text) return null;
        return words;
    } catch {
        return null;
    }
}

/** 1語ぶんの代表的なローマ字キー数。keygraph は状態を持つので毎回 build し直す */
function romajiKeyLength(word: string): number {
    keygraph.build(word);
    return keygraph.key_candidate().length;
}

/**
 * フレーズの targets(キー位置 -> 強/弱)を計算する。
 * 形態素解析結果の合計キー数が、フレーズ全体を1回で build した場合のキー数と
 * 一致する場合のみ単語ごとの区切りを使う。ズレる場合はフレーズ全体を1語として扱う。
 */
async function computeTargetsForPhrase(text: string): Promise<Record<number, PressureInstruction>> {
    keygraph.build(text);
    const totalLen = keygraph.key_candidate().length;

    const words = await segmentIntoWords(text);
    if (words && words.length > 1) {
        const lens = words.map(romajiKeyLength);
        const sum = lens.reduce((a, b) => a + b, 0);
        if (sum === totalLen) {
            const targets: Record<number, PressureInstruction> = {};
            let offset = 0;
            words.forEach((word, i) => {
                const instruction = computeWordPressureInstruction(word);
                for (let k = 0; k < lens[i]; k++) targets[offset + k] = instruction;
                offset += lens[i];
            });
            return targets;
        }
        console.warn(`  ! "${text}": 単語分割のキー数(${sum})が全体(${totalLen})と不一致のため、フレーズ全体を1語として扱います`);
    }

    // フォールバック: フレーズ全体を1語として扱う
    const instruction = computeWordPressureInstruction(text);
    const targets: Record<number, PressureInstruction> = {};
    for (let k = 0; k < totalLen; k++) targets[k] = instruction;
    return targets;
}

function formatTargets(targets: Record<number, PressureInstruction>): string {
    const keys = Object.keys(targets).map(Number).sort((a, b) => a - b);
    return '{ ' + keys.map(k => `${k}: '${targets[k]}'`).join(', ') + ' }';
}

async function main() {
    const allTexts = [...new Set(Object.values(WORD_LISTS).flat())];
    console.log(`対象フレーズ数: ${allTexts.length}`);

    const entries: [string, Record<number, PressureInstruction>][] = [];
    for (const [i, text] of allTexts.entries()) {
        const targets = await computeTargetsForPhrase(text);
        entries.push([text, targets]);
        console.log(`[${i + 1}/${allTexts.length}] ${text}`);
        await sleep(REQUEST_DELAY_MS);
    }

    const body = entries
        .map(([text, targets]) => `    ${JSON.stringify(text)}: ${formatTargets(targets)},`)
        .join('\n');
    const block = `const PRECOMPUTED_TARGETS: Record<string, Record<number, PressureInstruction>> = {\n${body}\n};`;

    const src = readFileSync(SENTENCES_PATH, 'utf8');
    const markerRe = /\/\/ GENERATED:BEGIN[\s\S]*?\/\/ GENERATED:END/;
    if (!markerRe.test(src)) {
        throw new Error('GENERATED:BEGIN/END マーカーが sentences.ts に見つかりませんでした');
    }
    const replaced = src.replace(markerRe, `// GENERATED:BEGIN\n${block}\n// GENERATED:END`);
    writeFileSync(SENTENCES_PATH, replaced);
    console.log(`sentences.ts を更新しました (${entries.length}件)`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
